import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
const load = async file => import('data:text/javascript;base64,'+Buffer.from(await readFile(new URL('../public/js/features/coleccion/'+file,import.meta.url),'utf8')).toString('base64'));
const { filterCards,progress,canPurchase,errorMessage } = await load('model.js');
const { createCollectionStore,purchaseJournal } = await load('store.js');
const { artwork,cardTile,safeImage } = await load('view.js');
const uid = '11111111-1111-4111-8111-111111111111';
const card = { id:1, name:'Ramiro Peña',slug:'ramiro-pena',team_slug:'sultanes-mty',team_name:'Sultanes',card_type:'mvp_player',cost:500,unlock_method:'points',is_owned:false };
const mascot = {...card,id:2,name:'Mascota',card_type:'mascot',cost:0,unlock_method:'ar'};
const snapshot = () => ({cards:[{...card},{...mascot}],points_balance:1000,total_cards:2,owned_cards:0});
function setup(overrides={}, memory=new Map()) {
    const storage = {getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
    const calls=[];
    const api={catalog:async()=>({cards:[card,mascot],total_cards:2}),collection:async()=>snapshot(),
        purchase:async(id,key)=>{calls.push({id,key});return {user_id:uid,card_id:id,reward_id:'reward',points_balance:500,already_processed:false};},...overrides};
    const journal=purchaseJournal(storage);
    const store=createCollectionStore({api,journal,newKey:()=> 'stable-key',timeout:50});
    return {store,journal,calls,memory};
}
test('catálogo de invitado no calcula saldo ni propiedad personal',async()=>{
    const {store}=setup();await store.setUser(null);assert.equal(store.state.data.cards.length,2);assert.equal(store.state.data.points_balance,undefined);assert.equal(canPurchase(store.state,card),false);
});
test('filtros combinan propiedad, equipo, tipo y orden sin mutar catálogo',()=>{
    const cards=[card,{...card,id:3,name:'Otra',cost:250,is_owned:true},mascot];
    assert.deepEqual(filterCards(cards,{ownership:'owned',team:'sultanes-mty',type:'mvp_player'}).map(c=>c.id),[3]);
    assert.deepEqual(filterCards(cards,{ownership:'locked',sort:'price'}).map(c=>c.id),[2,1]);
    assert.equal(cards[0],card);assert.deepEqual(progress(cards),{owned:1,total:3,percent:33});assert.equal(progress([]).percent,0);
});
test('confirmación envía ID y clave; saldo sólo procede del resultado del servidor',async()=>{
    const {store,calls}=setup();await store.setUser(uid);await store.purchase(card);
    assert.deepEqual(calls,[{id:1,key:'stable-key'}]);assert.equal(store.state.data.points_balance,500);assert.equal(store.state.data.cards[0].is_owned,true);assert.equal(store.state.pending,null);assert.equal(store.state.success,1);
});
test('doble clic comparte una operación y no duplica la petición',async()=>{
    let resolve, count=0;
    const {store}=setup({purchase:()=>{count++;return new Promise(r=>resolve=r);}});await store.setUser(uid);
    const first=store.purchase(card);await store.purchase(card);assert.equal(count,1);
    resolve({card_id:1,user_id:uid,reward_id:'r',points_balance:500});await first;
});
for(const [name,change] of [['mascota',mascot],['adquirida',{...card,is_owned:true}],['saldo insuficiente',{...card,cost:2000}]])test('bloquea compra: '+name,async()=>{
    const {store,calls}=setup();await store.setUser(uid);await store.purchase(change);assert.equal(calls.length,0);
});
test('respuesta perdida se reconcilia mediante inventario persistente sin anunciar compra ficticia',async()=>{
    let owned=false;
    const {store}=setup({purchase:async()=>{owned=true;throw new TypeError('network');},collection:async()=>({...snapshot(),points_balance:owned?500:1000,cards:[{...card,is_owned:owned},mascot]})});
    await store.setUser(uid);await store.purchase(card);assert.equal(store.state.pending,null);assert.equal(store.state.data.cards[0].is_owned,true);assert.equal(store.state.success,null);assert.equal(store.state.data.points_balance,500);
});
test('respuesta incierta conserva clave entre recargas y reintenta la misma operación',async()=>{
    const first=setup({purchase:async()=>{throw new Error('lost');}});await first.store.setUser(uid);await first.store.purchase(card);
    assert.equal(first.store.state.pending.key,'stable-key');first.store.destroy();
    const second=setup({},first.memory);await second.store.setUser(uid);await second.store.purchase(null,true);
    assert.equal(second.calls[0].key,'stable-key');assert.equal(second.store.state.pending,null);
});
test('operación incierta impide iniciar la compra de otra carta',async()=>{
    const {store,calls}=setup({purchase:async()=>{calls.push(1);throw new Error('lost');}});await store.setUser(uid);await store.purchase(card);await store.purchase({...card,id:3});assert.equal(calls.length,1);
});
test('error de lectura conserva datos e impide gastar mientras están desactualizados',async()=>{
    let fail=false;const {store,calls}=setup({collection:async()=>{if(fail)throw new Error('offline');return snapshot();}});
    await store.setUser(uid);fail=true;await store.refresh();assert.equal(store.state.data.points_balance,1000);assert.equal(store.state.stale,true);await store.purchase(card);assert.equal(calls.length,0);
});
test('cambio de usuario elimina saldo/propiedad anterior y aísla el journal',async()=>{
    const {store,journal}=setup({purchase:async()=>{throw new Error('offline');}});await store.setUser(uid);await store.purchase(card);
    await store.setUser('otro');assert.equal(store.state.pending,null);assert.equal(journal.read(uid).key,'stable-key');await store.setUser(null);assert.equal(store.state.data.points_balance,undefined);
});
test('respuesta tardía no contamina una sesión nueva',async()=>{
    let resolve;const {store}=setup({collection:()=>new Promise(r=>resolve=r)});const previous=store.setUser(uid);await store.setUser(null);resolve(snapshot());await previous;assert.equal(store.state.uid,null);assert.equal(store.state.data.points_balance,undefined);
});
test('401 mantiene recuperación y bloquea nuevos gastos hasta iniciar sesión',async()=>{
    const fail=Object.assign(new Error('expired'),{status:401});let expired=false;
    const {store}=setup({collection:async()=>{if(expired)throw fail;return snapshot();},purchase:async()=>{expired=true;throw fail;}});
    await store.setUser(uid);await store.purchase(card);assert.equal(store.state.expired,true);assert.ok(store.state.pending);assert.equal(canPurchase(store.state,card),false);
});
test('409 reconcilia saldo y propiedad sin descontar localmente',async()=>{
    let balance=1000;const {store}=setup({collection:async()=>({...snapshot(),points_balance:balance}),purchase:async()=>{balance=20;throw Object.assign(new Error('Insufficient points'),{status:409});}});
    await store.setUser(uid);await store.purchase(card);assert.equal(store.state.data.points_balance,20);assert.equal(store.state.pending,null);assert.equal(store.state.success,null);
});
test('almacenamiento no disponible bloquea la operación antes del POST',async()=>{
    let posted=false;const store=createCollectionStore({api:{collection:async()=>snapshot(),purchase:async()=>{posted=true;}},journal:{read:()=>null,write:()=>{throw new Error('quota');}},newKey:()=> 'key'});
    await store.setUser(uid);await store.purchase(card);assert.equal(posted,false);assert.equal(store.state.storageError,true);
});
test('timeout incierto conserva clave, sin éxito ficticio',async()=>{
    const {store}=setup({purchase:(id,key,signal)=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('timeout'))))});
    await store.setUser(uid);await store.purchase(card);assert.equal(store.state.pending.key,'stable-key');assert.equal(store.state.success,null);
});
test('respuesta inválida o de otro usuario nunca cambia el saldo/inventario',async()=>{
    const {store}=setup({purchase:async()=>({card_id:1,user_id:'otro',reward_id:'r',points_balance:99999})});await store.setUser(uid);await store.purchase(card);assert.equal(store.state.data.points_balance,1000);assert.equal(store.state.data.cards[0].is_owned,false);assert.ok(store.state.pending);
});
test('el journal rechaza metadatos corruptos sin tratarlos como propiedad',()=>{
    const journal=purchaseJournal({getItem:()=> '{"cardId":-1,"key":"x"}'});assert.throws(()=>journal.read(uid));
});
test('representación escapa texto, evita URLs ejecutables y no inventa retratos',()=>{
    const team={imagenes:{logoFondo:'https://example.test/logo.webp'},detalles:{mvp:{nombre:'Otra persona',imagen:'https://example.test/other.webp'}}};
    assert.equal(artwork(card,team,'https://example.test/').image,team.imagenes.logoFondo);
    assert.equal(artwork(card,team,'https://example.test/').portrait,false);
    assert.equal(safeImage('javascript:alert(1)','https://example.test/'),'');
    const html=cardTile({...card,name:'<script>alert(1)</script>'},team,'https://example.test/');assert.ok(!html.includes('<script>'));assert.ok(html.includes('&lt;script&gt;'));
});
test('errores HTTP reciben mensajes seguros y breves',()=>{
    for(const status of [400,401,403,404,409,422,429,500,502,0])assert.ok(errorMessage({status}).length>0);
});

test('login sólo habilita envío después de instalar el controlador y evita GET nativo',async()=>{
    const html=await readFile(new URL('../public/pages/auth/login.html',import.meta.url),'utf8');
    assert.match(html,/<form[^>]+id="login-form"[^>]+method="post"/);
    assert.match(html,/<button[^>]+type="submit"[^>]+disabled/);
    const events={};let enabled=false;
    const button={set disabled(value){if(!value){assert.ok(events.submit);enabled=true;}}};
    const form={addEventListener:(name,fn)=>{events[name]=fn;},querySelector:()=>button};
    const source=await readFile(new URL('../public/js/features/auth/login.js',import.meta.url),'utf8');
    const initialize=vm.runInNewContext(source.replace(/^import .*;\r?\n/gm,'').replace('export function','function')+';iniciarLogin;',{
        document:{getElementById:id=>id==='login-form'?form:{}},location:{search:''},URLSearchParams,
        iniciarControlesContrasena:()=>{},establecerEstado:()=>{}
    });
    initialize();assert.equal(enabled,true);
});
