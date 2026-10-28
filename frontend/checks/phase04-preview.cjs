// Loopback-only review servers. No Supabase, no credentials, no reward endpoints.
// 4190: actual RAF clock. 4191: explicit deterministic review fixture.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../public');
const mime = {'.html':'text/html','.js':'text/javascript','.json':'application/json','.css':'text/css','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
const guest = `export const proveedorSupabase=Object.fromEntries(['iniciarSesion','crearCuenta','solicitarRestablecimiento','restablecerContrasena','obtenerPerfil','actualizarPerfil','cerrarSesion'].map(k=>[k,async()=>{throw new Error('Guest-only local review')}]).concat([['observarSesion',fn=>{fn({cargando:false,user:null,profile:null});return()=>{}}]]));`;
const fixture = `import {iniciarJuego as mount} from './game-page.js';
export function iniciarJuego(signal){
 let time=0,next=0;const queue=new Map();
 const handle=mount(signal,{clock:{now:()=>time,requestFrame:fn=>{queue.set(++next,fn);return next},cancelFrame:id=>queue.delete(id)}});
 window.__gameQA={handle,step(ms){time+=ms;const batch=[...queue.values()];queue.clear();batch.forEach(fn=>fn(time))},pending:()=>queue.size};
 return handle;
}`;
function serve(port,deterministic) {
 http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost'); let file=decodeURIComponent(url.pathname);
  res.setHeader('Cache-Control','no-store');
  if(file.startsWith('/api/')) {res.writeHead(501);res.end('No API in local practice review');return;}
  let content;
  if(file==='/__review'){file='/review.html';content=fs.readFileSync(path.join(__dirname,'phase04-review.html'));}
  else if(file==='/js/features/auth/supabase-provider.js') content=guest;
  else if(deterministic && file==='/js/features/juego/ganar_juego.js') content=fixture;
  else if(file==='/data/game-beta-art.json' && url.searchParams.has('missing')) {
   const manifest=JSON.parse(fs.readFileSync(path.join(root,file)));
   manifest.frames.forEach((f,i)=>f.src='missing-art-'+i+'.webp');content=JSON.stringify(manifest);
  } else {
   if(file==='/')file='/pages/experiencias/juego.html';
   const target=path.resolve(root,'.'+file);
   if(!target.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
   try {content=fs.readFileSync(target);}catch{res.writeHead(404);res.end('Not found');return;}
  }
  // Negative asset scenario is selected only by this test server, never shipped.
  if(url.searchParams.has('missing') && file.endsWith('juego.html')) {
   content=content.toString().replace('</head>',`<script>const originalFetch=window.fetch;window.fetch=(url,init)=>originalFetch(String(url).includes('game-beta-art.json')?String(url)+'?missing':url,init);</script></head>`);
  }
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.end(content);
 }).listen(port,'127.0.0.1',()=>console.log('Local '+(deterministic?'deterministic fixture':'real-clock practice')+' http://127.0.0.1:'+port));
}
serve(4190,false);serve(4191,true);
