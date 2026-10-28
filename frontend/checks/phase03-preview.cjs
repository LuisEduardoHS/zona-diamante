// Loopback-only acceptance server. Test adapters NEVER enter public assets/build.
const http=require('node:http'),fs=require('node:fs/promises'),path=require('node:path');
const root=path.resolve(__dirname,'../public');
const live=process.argv.includes('--live'),port=live?4181:4180;
const fixtures=new Map();
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.ttf':'font/ttf','.glb':'model/gltf-binary','.mind':'application/octet-stream'};
const json=(res,data)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
async function config(){
 const cfg=JSON.parse(await fs.readFile(path.resolve(__dirname,'../../.tmp/phase03-live/manifest.json'),'utf8'));
 for(const key of ['SUPABASE_URL','BACKEND_API_URL'])if(new URL(cfg[key]).hostname!=='127.0.0.1')throw Error('Local targets required');
 return cfg;
}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/html; charset=utf-8');
  if(url.pathname==='/__review'){
   res.end(`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Colección · QA local</title><style>body{background:#173b43;color:white;font:13px system-ui;margin:10px}button,select{padding:8px;margin:3px}#stage{display:flex;justify-content:center;overflow:auto}iframe{border:0;flex:none;transform-origin:top center}pre{white-space:pre-wrap;max-height:95px;overflow:auto}</style></head><body><p>${live?'SUPABASE LOCAL + FASTAPI REALES · cuenta sintética · sin producción':'FIXTURE HTTP EXPLÍCITA · catálogo real, saldo y compras simulados'}</p><label>Viewport <select id="size"><option>360x740</option><option selected>390x844</option><option>768x1024</option><option>1440x900</option></select></label><label>Escenario <select id="scenario"><option>guest</option><option ${live?'selected':''}>member</option><option>poor</option><option>owned</option><option>lost</option><option>uncertain</option><option>expired</option><option>server-error</option></select></label><button id="load">Cargar escenario</button><button id="login">Entrar con cuenta local</button><button id="tests">Probar colección</button><button id="layout">Comprobar geometría</button><pre id="results">Esperando.</pre><div id="stage"><iframe id="app" title="Colección bajo prueba"></iframe></div><script type="module" src="/__browser.js"></script></body></html>`);return;
  }
  if(url.pathname==='/__mode'){json(res,{live});return;}
  if(live&&url.pathname==='/__test-account'){const {email,password}=await config();json(res,{email,password});return;}
  if(url.pathname==='/__browser.js'){res.setHeader('Content-Type','text/javascript');res.end(await fs.readFile(path.join(__dirname,'phase03-browser.js')));return;}
  if(live&&url.pathname==='/js/app/runtime-config.js'){
   const {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,BACKEND_API_URL}=await config();res.setHeader('Content-Type','text/javascript');res.end(`export const runtimeConfig=${JSON.stringify({SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,BACKEND_API_URL})};`);return;
  }
  if(!live&&url.pathname==='/js/features/auth/supabase-provider.js'){
   res.setHeader('Content-Type','text/javascript');res.end(`const scenario=new URLSearchParams(location.search).get('scenario')||'guest'; const noop=async()=>({});export const proveedorSupabase={iniciarSesion:noop,crearCuenta:noop,solicitarRestablecimiento:noop,restablecerContrasena:noop,obtenerPerfil:noop,actualizarPerfil:noop,cerrarSesion:noop,observarSesion(callback){callback({user:scenario==='guest'?null:{id:'11111111-1111-4111-8111-111111111111'},cargando:false});return()=>{};}};`);return;
  }
  if(!live&&url.pathname==='/js/api/backend-client.js'){
   res.setHeader('Content-Type','text/javascript');res.end(`const q=new URLSearchParams(location.search),scenario=q.get('scenario')||'guest',run=q.get('run')||'default';export async function solicitarBackend(path,{method='GET',headers={},signal}={}){const r=await fetch('/__api'+path,{method,headers:{...headers,'X-Fixture-Scenario':scenario,'X-Fixture-Run':run},signal});let data=await r.json();if(!r.ok)throw Object.assign(new Error(data.detail),{status:r.status,data});return data;}export const obtenerUsuarioBackend=()=>solicitarBackend('/api/v1/me');`);return;
  }
  if(!live&&url.pathname.startsWith('/__api')){
   const scenario=req.headers['x-fixture-scenario']||'guest',run=req.headers['x-fixture-run']||'default';
   const key=scenario+':'+run;
   if(!fixtures.has(key)){
    const catalog=JSON.parse(await fs.readFile(path.join(__dirname,'fixtures/collection-catalog.json'),'utf8'));
    fixtures.set(key,{cards:catalog.cards.map(c=>({...c,is_owned:scenario==='owned'&&(c.card_type==='mascot'||c.id===1)})),points_balance:scenario==='poor'?10:1000,operations:new Map(),posts:0,lost:false});
   }
   const state=fixtures.get(key);
   if(scenario==='server-error'||scenario==='uncertain'&&state.lost){res.statusCode=502;json(res,{detail:'Fixture server error'});return;}
   if(scenario==='expired'&&state.lost){res.statusCode=401;json(res,{detail:'Fixture expired'});return;}
   if(req.method==='POST'){
    state.posts++;const id=Number(url.pathname.split('/').at(-2)),operation=req.headers['idempotency-key'];
    if(state.operations.has(operation)){json(res,{...state.operations.get(operation),already_processed:true});return;}
    const card=state.cards.find(c=>c.id===id);
    if(!card||card.is_owned||card.unlock_method!=='points'||state.points_balance<card.cost){res.statusCode=409;json(res,{detail:'Fixture rejected'});return;}
    if(scenario==='expired'){state.lost=true;res.statusCode=401;json(res,{detail:'Fixture expired'});return;}
    state.points_balance-=card.cost;card.is_owned=true;
    const result={reward_id:'fixture-reward',card_id:id,user_id:'11111111-1111-4111-8111-111111111111',points_balance:state.points_balance,already_processed:false};state.operations.set(operation,result);
    if(['lost','uncertain'].includes(scenario)&&!state.lost){state.lost=true;res.destroy();return;}
    json(res,result);return;
   }
   json(res,{cards:state.cards,total_cards:state.cards.length,owned_cards:state.cards.filter(c=>c.is_owned).length,...(url.pathname.endsWith('/catalog')?{}:{points_balance:state.points_balance})});return;
  }
  const target=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');res.end(await fs.readFile(target));
 }catch{res.writeHead(404).end('Local file unavailable');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Collection ${live?'LIVE LOCAL':'FIXTURE'} review: http://127.0.0.1:${port}/__review`));
