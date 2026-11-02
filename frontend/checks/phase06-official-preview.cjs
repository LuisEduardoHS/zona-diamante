// Local-only browser QA. Uses the owned synthetic stack from phase04_live.py.
// No production credentials, no patched statistics, no client reward calculation.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../public');
const local=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../.tmp/phase04-live/manifest.json'),'utf8'));
for(const key of ['SUPABASE_URL','BACKEND_API_URL'])if(new URL(local[key]).hostname!=='127.0.0.1')throw Error('Local stack required');
const publicConfig=Object.fromEntries(['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','BACKEND_API_URL'].map(k=>[k,local[k]]));
const types={'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf'};
const review=`<!doctype html><html lang="es"><meta charset="utf-8"><title>QA oficial supervivencia local</title><h1>Auth, FastAPI y PostgreSQL locales</h1><p>Cuenta sintética local. Cada tiro usa el reloj real y el botón del juego.</p><button id="login">Iniciar sesión sintética local</button><p id="status">Preparado</p><a href="/pages/experiencias/juego.html?qa=bonus">Extras (12 hits)</a> · <a href="/pages/experiencias/juego.html?qa=base">Meta (10 hits)</a> · <a href="/pages/experiencias/juego.html?qa=max">Veinte hits</a> · <a href="/pages/experiencias/juego.html?qa=lose">Derrota</a><script type="module">import {supabase} from '/js/services/supabase-client.js';document.querySelector('#login').onclick=async()=>{const {error}=await supabase.auth.signInWithPassword(${JSON.stringify({email:local.email,password:local.password})});document.querySelector('#status').textContent=error?'Error de sesión local':'Sesión sintética iniciada';};</script></html>`;
const fixture=`import {iniciarJuego as mount} from './game-page.js';
import {observarEstadoSesion} from '../auth/session.js';
export function iniciarJuego(signal){
 const handle=mount(signal);window.__officialQA=handle;
 const scenario=new URL(location.href).searchParams.get('qa');
 if(!scenario)return handle;
 let started=false,armed=false,timer=null,firstSeen=false;
 const sequence=scenario==='lose'?Array(3).fill(0):[...Array(scenario==='base'?10:scenario==='bonus'?12:20).fill(1),0,0,0];
 const run=()=>{if(started||!armed||signal.aborted)return;started=true;document.querySelector('#game-start').click();
   timer=setInterval(()=>{const s=handle.state;if(!s)return;
     if(!firstSeen){firstSeen=true;if(s.phase==='finished'){document.querySelector('#game-replay').click();return;}}
     if(['finished','expired','abandoned'].includes(s.phase)||signal.aborted){clearInterval(timer);return;}
     if(s.phase==='pitch'&&!s.serverBusy&&!document.querySelector('#game-hit').disabled&&s.elapsed>=(sequence[s.stats.resolved]?s.plan.contactMs:0))document.querySelector('#game-hit').click();
   },4);
 };
 const unsubscribe=observarEstadoSesion(auth=>{if(auth.user){armed=true;void handle.ready.then(run);}});
 signal.addEventListener('abort',()=>{clearInterval(timer);unsubscribe();},{once:true});
 // Test faults remain confined to this loopback test server.
 if(new URL(location.href).searchParams.has('lost')){const original=window.fetch.bind(window);let drops=2;window.fetch=async(url,opts)=>{const r=await original(url,opts);if(drops>0&&String(url).endsWith('/complete')){drops--;throw new TypeError('QA lost response after commit');}return r;};}
 const fault=new URL(location.href).searchParams.get('fail');
 if(fault){const original=window.fetch.bind(window);window.fetch=(url,opts)=>{if(String(url).includes('/api/v1/games/beta')){if(fault==='401')return Promise.resolve(new Response(JSON.stringify({detail:'QA expired session'}),{status:401,headers:{'Content-Type':'application/json'}}));if(fault==='offline')return Promise.reject(new TypeError('QA offline'));}return original(url,opts);};}
 return handle;
}`;
http.createServer((req,res)=>{const url=new URL(req.url,'http://local');let file=decodeURIComponent(url.pathname),content;res.setHeader('Cache-Control','no-store');
 if(file==='/__review'){file='/review.html';content=review;}
 else if(file==='/js/app/runtime-config.js')content='export const runtimeConfig=Object.freeze('+JSON.stringify(publicConfig)+');';
 else if(file==='/js/features/juego/ganar_juego.js')content=fixture;
 else{const target=path.resolve(root,'.'+file);if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}try{content=fs.readFileSync(target);}catch{res.writeHead(404);res.end();return;}}
 res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(content);
}).listen(4211,'127.0.0.1',()=>console.log('Local survival real-stack QA http://127.0.0.1:4211/__review'));
