// Loopback-only presentation review. Synthetic sessions/API, no production writes.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../public'),port=4195;
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.ttf':'font/ttf','.otf':'font/otf','.glb':'model/gltf-binary'};
const teams=JSON.parse(fs.readFileSync(path.join(root,'data/equipos.json')));
const cards=teams.flatMap((team,index)=>['team','player','player','mvp_player','mascot'].map((type,n)=>({id:index*5+n+1,slug:`review-${index}-${n}`,name:n===0?team.nombre:type==='mascot'?team.detalles?.mascota?.nombre||'Mascota':`${team.nombre} · ${n}`,card_type:type,team_slug:team.id,team_name:team.nombre,cost:type==='mascot'?0:250,unlock_method:type==='mascot'?'ar':'points',description:'Carta de demostración local',image_path:null,is_owned:false})));
const provider=`const demo=new URL(location.href).searchParams.has('session');
 const fixture={user:demo?{id:'11111111-1111-4111-8111-111111111111',email:'review@example.invalid'}:null,profile:demo?{displayName:'Afición de prueba',username:'prueba_local',email:'review@example.invalid',pointsBalance:300,avatarUrl:'/assets/img/trivia/perrito-sultan.webp'}:null};
 export const proveedorSupabase=Object.fromEntries(['iniciarSesion','crearCuenta','solicitarRestablecimiento','restablecerContrasena','actualizarPerfil','cerrarSesion'].map(key=>[key,async()=>{throw Error('Presentation review: writes disabled')}]).concat([['obtenerPerfil',async()=>fixture],['observarSesion',fn=>{fn({...fixture,cargando:false});return()=>{}}]]));`;
const client=`import {obtenerEstadoSesion} from '/js/features/auth/session.js';export const supabase={auth:{getSession:async()=>({data:{session:obtenerEstadoSesion().user?{access_token:'synthetic-local-review'}:null},error:null})}};`;
const questions=Array.from({length:5},(_,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,position:i+1,text:`Pregunta de prueba ${i+1}: elige una respuesta`,options:[1,2,3,4].map(n=>({id:`op-${i}-${n}`,text:`Opción ${n}`,position:n})),selected_option_id:null}));
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');let file=decodeURIComponent(url.pathname),content;res.setHeader('Cache-Control','no-store');
 try{
  if(file==='/__review'){file='/review.html';content=fs.readFileSync(path.join(__dirname,'site-review.html'));}
  else if(file==='/__ar-style'){
   file='/ar.html';content=fs.readFileSync(path.join(root,'pages/ar/ar-vista.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('</body>',`<script type="module">document.querySelector('#foto-imagen').src='/assets/img/equipos/galerias/sultanes/01.jpg';document.querySelector('#foto-equipo').textContent='Demostración de estilo · sin cámara';document.querySelector('#foto-preview').showModal();document.querySelector('#btn-cerrar-foto').onclick=()=>document.querySelector('#foto-preview').close();</script></body>`).replaceAll('../../','/');
  }
  else if(file==='/js/features/auth/supabase-provider.js')content=provider;
  else if(file==='/js/services/supabase-client.js')content=client;
  else if(file==='/js/app/runtime-config.js')content=`export const runtimeConfig={BACKEND_API_URL:'http://127.0.0.1:${port}'};`;
  else if(file.startsWith('/api/')){
   const next=new Date(Date.now()+12*3600000).toISOString();file='/response.json';
   if(url.pathname==='/api/v1/cards/catalog')content=JSON.stringify({cards,total_cards:cards.length});
   else if(url.pathname==='/api/v1/cards')content=JSON.stringify({cards,total_cards:cards.length,points_balance:300});
   else if(url.pathname==='/api/v1/trivia/daily')content=JSON.stringify({status:'available',daily_trivia_id:'local',trivia_date:'2026-11-02',question_count:5,points_per_correct:20,next_available_at:next});
   else if(url.pathname.endsWith('/start'))content=JSON.stringify({attempt_id:'synthetic',questions,question_count:5});
   else if(url.pathname.includes('/answers/'))content=JSON.stringify({saved:true});
   else if(url.pathname.endsWith('/submit'))content=JSON.stringify({attempt_id:'synthetic',score:5,question_count:5,points_earned:100,points_balance:400,next_available_at:next});
   else {res.writeHead(409);res.end('Synthetic UI review: endpoint disabled');return;}
  }else{
   if(file==='/')file='/index.html';const absolute=path.resolve(root,'.'+file);
   if(!absolute.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}content=fs.readFileSync(absolute);
  }
  res.setHeader('Content-Type',(mime[path.extname(file)]||'application/octet-stream')+'; charset=utf-8');res.end(content);
 }catch{res.writeHead(404);res.end('Not found');}
}).listen(port,'127.0.0.1',()=>console.log(`Local site presentation review http://127.0.0.1:${port}/__review`));
