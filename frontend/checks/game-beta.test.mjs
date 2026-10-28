import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadGame, loadModule, rules, art } from './game-module-loader.mjs';
const state = await loadGame('game-state.js');
const {createGameEngine} = await loadGame('game-engine.js');
const media = await loadGame('game-media.js');
const {bindBatInput} = await loadGame('game-input.js');
const {createPracticeSession,practiceRecords} = await loadGame('game-session.js');
const {createGameServerClient} = await loadModule(new URL('../public/js/api/game-client.js',import.meta.url));
const fresh = mode => state.advance(state.createMatch(rules,mode),rules.timing.countdownMs,rules);
function hit(game,type='perfect') {
    const at = type==='perfect'?game.plan.contactMs:type==='hit'?game.plan.contactMs+game.plan.perfectWindowMs+1:type==='early'?0:game.plan.contactMs+game.plan.validWindowMs+1;
    const feedback=state.swing(state.advance(game,at,rules),rules);
    return state.advance(feedback,feedback.last.duration,rules);
}
test('ventanas inclusivas y centro perfecto, independientes de FPS',()=>{
 const p=state.pitchPlan(rules,1);
 for(const d of [-p.perfectWindowMs,0,p.perfectWindowMs])assert.equal(state.classifySwing(p.contactMs+d,p),'perfect');
 for(const d of [-p.validWindowMs,p.validWindowMs])assert.equal(state.classifySwing(p.contactMs+d,p),'hit');
 assert.equal(state.classifySwing(p.contactMs-p.validWindowMs-1,p),'early');assert.equal(state.classifySwing(p.contactMs+p.validWindowMs+1,p),'late');assert.equal(state.classifySwing(NaN,p),'invalid');
});
test('un golpe perfecto suma 20 en total y un solo acierto/racha',()=>{
 let game=hit(fresh('classic'));assert.equal(game.stats.score,20);assert.equal(game.stats.hits,1);assert.equal(game.stats.perfects,1);assert.equal(game.stats.streak,1);assert.equal(game.stats.resolved,1);
});
test('bateo normal suma 10; fallos no suman',()=>{
 let game=hit(fresh('classic'),'hit');game=hit(game,'early');game=hit(game,'late');assert.equal(game.stats.score,10);assert.equal(game.stats.hits,1);assert.equal(game.stats.misses,2);
});
test('no batear resuelve un único fallo y continúa el siguiente lanzamiento',()=>{
 const game=fresh('classic'),feedback=state.advance(game,game.plan.flightMs,rules);
 assert.equal(feedback.last.type,'no_swing');assert.equal(feedback.stats.resolved,1);assert.equal(state.swing(feedback,rules),feedback);assert.equal(state.advance(feedback,feedback.last.duration,rules).pitchIndex,2);
});
test('entradas múltiples durante feedback no agregan puntos o lanzamientos',()=>{
 const game=fresh('classic'),first=state.swing(state.advance(game,1200,rules),rules);
 for(let i=0;i<10;i++)assert.equal(state.swing(first,rules),first);assert.equal(first.stats.score,20);
});
test('racha actual se reinicia con fallo y máxima se conserva',()=>{
 let g=hit(hit(fresh('streak')));g=hit(g,'early');assert.equal(g.stats.streak,0);assert.equal(g.stats.bestStreak,2);g=hit(g);assert.equal(g.stats.streak,1);assert.equal(g.stats.bestStreak,2);
});
test('Clásica no termina al sexto acierto: gana al resolver los diez',()=>{
 let g=fresh('classic');for(let i=0;i<6;i++)g=hit(g);assert.equal(g.outcome,null);assert.equal(g.phase,'pitch');
 for(let i=0;i<4;i++)g=hit(g,'early');assert.equal(g.outcome,'won');assert.equal(g.phase,'finished');assert.equal(g.stats.hits,6);assert.equal(g.stats.misses,4);
});
test('Clásica pierde con cinco aciertos; no finaliza antes',()=>{
 let g=fresh('classic');for(let i=0;i<5;i++)g=hit(g);for(let i=0;i<4;i++)g=hit(g,'early');assert.equal(g.phase,'pitch');g=hit(g,'early');assert.equal(g.outcome,'lost');assert.equal(g.stats.resolved,10);
});
test('Racha gana exactamente al quinto acierto consecutivo',()=>{
 let g=fresh('streak');for(let i=0;i<4;i++)g=hit(g);assert.equal(g.outcome,null);g=hit(g);assert.equal(g.outcome,'won');assert.equal(g.stats.resolved,5);assert.equal(g.stats.score,100);
});
test('Racha sólo pierde al agotar quince sin lograr cinco consecutivos',()=>{
 let g=fresh('streak');for(let i=0;i<14;i++)g=hit(g,i%3===2?'early':'perfect');assert.equal(g.outcome,null);g=hit(g,'early');assert.equal(g.outcome,'lost');assert.equal(g.stats.resolved,15);
});
test('resultado terminal ignora reloj, golpes, pausa y reanudación',()=>{
 let g=fresh('streak');for(let i=0;i<5;i++)g=hit(g);
 for(const action of [x=>state.advance(x,1e6,rules),x=>state.swing(x,rules),state.pause,state.resume,state.abandon])assert.equal(action(g),g);
 let pending=fresh('streak');for(let i=0;i<4;i++)pending=hit(pending);pending=state.swing(state.advance(pending,pending.plan.contactMs,rules),rules);
 assert.equal(pending.phase,'feedback');assert.equal(pending.outcome,'won');const exited=state.abandon(pending);assert.equal(exited.phase,'abandoned');assert.equal(exited.outcome,null);assert.equal(state.advance(exited,10000,rules),exited);
});
test('reinicio limpio no conserva métricas ni fase del juego anterior',()=>{
 const old=hit(hit(fresh('classic'))),next=state.createMatch(rules,'streak','next');assert.equal(next.stats.score,0);assert.equal(next.stats.streak,0);assert.equal(next.pitchIndex,0);assert.equal(old.stats.score,40);
});
test('progresión modifica tiempos desde configuración y no decide resultados al azar',()=>{
 const a=state.pitchPlan(rules,1),b=state.pitchPlan(rules,6),c=state.pitchPlan(rules,11);assert.ok(a.contactMs>b.contactMs&&b.contactMs>c.contactMs);assert.deepEqual(state.pitchPlan(rules,6),b);assert.equal(state.classifySwing(b.contactMs,b),'perfect');
});
test('pasos pequeños y grandes producen el mismo resultado sin bateo',()=>{
 const initial=state.createMatch(rules,'classic');let stepped=initial;for(let i=0;i<500;i++)stepped=state.advance(stepped,100,rules);const large=state.advance(initial,50000,rules);assert.deepEqual(stepped,large);assert.equal(large.outcome,'lost');
});
test('reglas, modo y tiempo inválidos se rechazan explícitamente',()=>{
 assert.throws(()=>state.createMatch(rules,'other'));assert.throws(()=>state.validateRules({}));assert.throws(()=>state.advance(fresh('classic'),-1,rules));assert.throws(()=>state.advance(fresh('classic'),NaN,rules));
 const bad=structuredClone(rules);bad.timing.perfectWindowMs=9999;assert.throws(()=>state.validateRules(bad));
});
function runtime(){
 let time=0,n=0;const pending=new Map(),history=[];const game=createGameEngine({rules,mode:'classic',now:()=>time,requestFrame:fn=>{pending.set(++n,fn);history.push(fn);return n;},cancelFrame:id=>pending.delete(id)});
 return {game,pending,history,setTime:t=>{time=t;},step(ms){time+=ms;const batch=[...pending.values()];pending.clear();batch.forEach(fn=>fn());}};
}
test('RAF viejo después de pausar/reanudar no duplica el loop',()=>{
 const r=runtime();r.game.start();const old=r.history[0];r.game.pause();r.setTime(9000);r.game.resume();assert.equal(r.pending.size,1);old();assert.equal(r.pending.size,1);assert.equal(r.game.state.elapsed,0);r.game.destroy();assert.equal(r.pending.size,0);
});
test('input tardío no se aplica a un lanzamiento nuevo tras bloqueo del hilo',()=>{
 const r=runtime();r.game.start();r.step(3000);r.setTime(5100);assert.equal(r.game.swing(),false);assert.equal(r.game.state.pitchIndex,2);assert.equal(r.game.state.stats.resolved,1);r.game.destroy();
});
test('pausa congela pelota y estadística con el reloj real inyectado',()=>{
 const r=runtime();r.game.start();r.step(3450);r.game.pause();const before=structuredClone(r.game.state);r.step(60000);assert.deepEqual(r.game.state,before);r.game.resume();r.step(100);assert.equal(r.game.state.elapsed,550);r.game.destroy();
});
test('poses usan los cuatro originales en orden y anclaje sin escalar por separado',()=>{
 let g=fresh('classic');assert.equal(media.frameFor(g,art),0);g=state.advance(g,g.plan.contactMs-100,rules);assert.equal(media.frameFor(g,art),1);g=state.swing(g,rules);
 assert.equal(media.frameFor(g,art),1);g=state.advance(g,100,rules);assert.equal(media.frameFor(g,art),2);g=state.advance(g,100,rules);assert.equal(media.frameFor(g,art),3);g=state.advance(g,300,rules);assert.equal(media.frameFor(g,art),0);
 assert.match(media.spriteTransform(art.frames[0],art.canvas),/^translate\(/);assert.deepEqual(art.frames.map(f=>f.src.split('/').at(-1)),['zd-sultanes-b1.webp','zd-sultanes-b2.webp','zd-sultanes-b3.webp','zd-sultanes-b4.webp']);
});
test('pelota llega al aro al tiempo de contacto y el resize sólo cambia proyección',()=>{
 const g=state.advance(fresh('classic'),1200,rules),p=media.ballPosition(g);assert.equal(p.x,media.CONTACT.x);assert.equal(p.y,media.CONTACT.y);assert.equal(p.visible,true);
 for(const [w,h] of [[360,740],[390,844],[768,1024],[1440,900]]){assert.ok(p.x*w>0&&p.x*w<w);assert.ok(p.y*h>0&&p.y*h<h);assert.equal(g.stats.resolved,0);}
});
class ImageOK { set src(value){this.url=value;queueMicrotask(()=>this.onload?.());}get src(){return this.url;} }
class ImageMissing { set src(value){this.url=value;queueMicrotask(()=>this.onerror?.());}get src(){return this.url;} }
test('precarga conserva URL de los originales y señala recursos faltantes',async()=>{
 const ok=await media.preloadSprites(art,{base:'http://localhost/',ImageClass:ImageOK});assert.equal(ok.filter(i=>i.available).length,4);
 const missing=await media.preloadSprites(art,{base:'http://localhost/',ImageClass:ImageMissing});assert.equal(missing.filter(i=>i.available).length,0);assert.equal(media.usableFrame(2,missing),-1);
 ok[2].available=false;assert.equal(media.usableFrame(2,ok),0);
});
test('precarga cancelada o timeout termina sin dejar el montaje pendiente',async()=>{
 class Never {set src(value){this.url=value;}}
 const abort=new AbortController();const pending=media.preloadSprites(art,{base:'http://localhost/',ImageClass:Never,signal:abort.signal});abort.abort();assert.ok((await pending).every(i=>!i.available));
 assert.ok((await media.preloadSprites(art,{base:'http://localhost/',ImageClass:Never,timeout:5})).every(i=>!i.available));
});
test('manifiesto corrupto se rechaza; los cuatro recursos reales existen',async()=>{
 assert.throws(()=>media.validateArt({}));assert.throws(()=>media.validateArt({...art,canvas:{width:NaN,height:950}}));for(const frame of art.frames){const bytes=await readFile(new URL('../public/'+frame.src,import.meta.url));assert.ok(bytes.length>1000);assert.equal(bytes.toString('ascii',0,4),'RIFF');}
});
test('adaptador local no concede puntos aunque se le pase una victoria manipulada',()=>{
 const session=createPracticeSession({newId:()=> 'one'});assert.equal(session.start('classic').id,'practice:one');const result=session.complete({win:true,score:99999,points:99999});assert.equal(result.reward.status,'unavailable');assert.equal(result.reward.pointsAwarded,null);assert.equal(result.confirmedResult,null);
});
test('récord opcional es local, por identidad/modalidad y nunca balance',()=>{
 const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};
 const a=practiceRecords(storage,'a');a.save('classic',{score:80,bestStreak:3});a.save('classic',{score:20,bestStreak:1});assert.deepEqual(a.read('classic'),{score:80,streak:3});assert.equal(a.read('streak').score,0);assert.equal(practiceRecords(storage,'b').read('classic').score,0);
 assert.doesNotThrow(()=>practiceRecords({getItem(){throw Error();},setItem(){throw Error();}}).save('classic',{score:20,bestStreak:1}));
});
test('contrato API preparado sólo envía comandos, nunca score/resultado/premio',async()=>{
 const calls=[];const api=createGameServerClient(async(path,opts)=>{calls.push({path,...opts});return {};});await api.start('classic','key');await api.swing('one','pitch',3,'same');await api.complete('one','finish');
 assert.deepEqual(calls[0].body,{mode:'classic'});assert.deepEqual(calls[1].body,{expected_revision:3});assert.deepEqual(calls[2].body,{});assert.equal(calls[1].headers['Idempotency-Key'],'same');assert.ok(calls.every(c=>!JSON.stringify(c.body).match(/score|win|points|user_id/)));
});
test('teclado ignora repetición y diálogos; AbortSignal retira handlers',()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 const target=new EventTarget(),button=new EventTarget(),abort=new AbortController();button.disabled=false;button.hidden=false;let hits=0,dialog=false;
 globalThis.window=target;globalThis.document={querySelector:()=>dialog?{}:null};
 try{
  bindBatInput(button,{signal:abort.signal,swing:()=>hits++});
  const press=(repeat=false)=>{const e=new Event('keydown',{cancelable:true});Object.defineProperties(e,{code:{value:'Space'},repeat:{value:repeat}});target.dispatchEvent(e);return e;};
  assert.equal(press().defaultPrevented,true);press(true);assert.equal(hits,1);dialog=true;press();assert.equal(hits,1);dialog=false;button.disabled=true;press();assert.equal(hits,1);button.disabled=false;button.dispatchEvent(new Event('click'));assert.equal(hits,2);abort.abort();press();assert.equal(hits,2);
 }finally{globalThis.window=oldWindow;globalThis.document=oldDocument;}
});
