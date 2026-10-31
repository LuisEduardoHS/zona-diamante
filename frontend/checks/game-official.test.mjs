import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGame,rules} from './game-module-loader.mjs';
const {projectOfficial,officialJournal,createOfficialEngine}=await loadGame('game-official.js');
const base=()=>({id:'official-one',mode:'streak',phase:'pitch',revision:4,rules,server_now:1000,expires_at:100000,
    pitch_start:1000,plan:{index:1,contactMs:1200,flightMs:1400,validWindowMs:150,perfectWindowMs:50,tier:1},
    samples:[20,20,20],compensation_ms:20,probe:'probe',next_at:0,last:null,outcome:null,
    stats:{resolved:0,hits:0,misses:0,perfects:0,score:0,streak:0,bestStreak:0,swings:0},
    reward:{status:'pending',points_awarded:null},points_balance:0});
const memory=()=>{const m=new Map();return{getItem:k=>m.get(k),setItem:(k,v)=>m.set(k,v)}};
function runtime(api,storage=memory()){
 let time=0,next=0;const queue=new Map(),errors=[],frames=[];
 const engine=createOfficialEngine({api,storage,user:'user',mode:'streak',rules,now:()=>time,
    requestFrame:fn=>{queue.set(++next,fn);return next},cancelFrame:id=>queue.delete(id),
    onFrame:s=>frames.push(s),onError:e=>errors.push(e)});
 return {engine,queue,errors,frames,async step(ms=0){time+=ms;const batch=[...queue.values()];queue.clear();batch.forEach(fn=>fn());await new Promise(resolve=>setTimeout(resolve,0));}};
}
test('proyección oficial conserva estadísticas del servidor y no calcula score por tiempo',()=>{
 const s=base();assert.equal(projectOfficial(s,900).phase,'countdown');
 const a=projectOfficial(s,2200);assert.equal(a.stats.score,0);assert.equal(a.stats.resolved,0);assert.equal(a.phase,'pitch');
 const pending=projectOfficial(s,2280,true,2200);assert.equal(pending.last.type,'pending');assert.equal(pending.stats.score,0);assert.equal(pending.serverBusy,true);
});
test('pausa oficial no congela el reloj del pitch ni concede un resultado',()=>{
 const s={...base(),phase:'paused',paused_from:'pitch'};
 assert.equal(projectOfficial(s,2300).elapsed,1300);assert.equal(projectOfficial(s,3000).elapsed,2000);assert.equal(projectOfficial(s,3000).outcome,null);
});
test('diario oficial separa usuarios y falla antes de iniciar si storage no permite recuperación',async()=>{
 const storage=memory();officialJournal(storage,'a').write({id:'one',key:'k'});assert.equal(officialJournal(storage,'b').read(),null);
 let starts=0;const r=runtime({current:async()=>null,start:async()=>{starts++;return base()}},{getItem:()=>null,setItem:()=>{throw Error('blocked')}});
 await r.engine.start();assert.equal(starts,0);assert.equal(r.errors.length,1);r.engine.destroy();
});
test('inicio con respuesta perdida reusa la misma clave y conserva ID para recarga',async()=>{
 const keys=[],storage=memory();const r=runtime({current:async()=>null,start:async(mode,key)=>{keys.push(key);if(keys.length===1)throw Error('lost');return base()}},storage);
 await r.engine.start();assert.equal(keys.length,2);assert.equal(keys[0],keys[1]);assert.equal(officialJournal(storage,'user').read().id,'official-one');r.engine.destroy();
});
test('recarga recupera resultado confirmado sin iniciar otra partida o repetir el premio',async()=>{
 const storage=memory();officialJournal(storage,'user').write({id:'official-one',mode:'streak',key:'k'});
 let starts=0,grants=0;const s={...base(),phase:'completed',outcome:'won',reward:{status:'confirmed',points_awarded:60},points_balance:60};
 const r=runtime({read:async()=>s,start:async()=>{starts++},complete:async()=>{grants++}},storage);await r.engine.start();
 assert.equal(r.engine.state.phase,'finished');assert.equal(r.engine.state.serverResult.reward.points_awarded,60);assert.equal(starts,0);assert.equal(grants,0);r.engine.destroy();
});
test('doble swing usa un solo comando; respuesta perdida no duplica estadísticas',async()=>{
 const calls=[];const s=base();const result={...s,phase:'waiting',revision:5,last:{type:'perfect',resolved_at:2200,at:1200,duration:600},next_at:2800,
    stats:{...s.stats,resolved:1,hits:1,perfects:1,score:20,streak:1,bestStreak:1,swings:1}};
 const r=runtime({current:async()=>null,start:async()=>s,swing:async(...args)=>{calls.push(args);if(calls.length===1)throw Error('lost');return result}});
 await r.engine.start();assert.equal(r.engine.swing(),true);assert.equal(r.engine.swing(),false);await r.step();
 assert.equal(calls.length,2);assert.equal(calls[0][3],calls[1][3]);assert.equal(r.engine.state.stats.score,20);assert.equal(r.engine.state.stats.resolved,1);r.engine.destroy();
});
test('destruir montaje cancela RAF y descarta respuestas tardías sin abandonar servidor',async()=>{
 let reply,abandoned=0;const r=runtime({current:async()=>null,start:()=>new Promise(resolve=>reply=resolve),transition:async()=>{abandoned++}});
 const pending=r.engine.start();await new Promise(resolve=>setTimeout(resolve,0));r.engine.destroy();reply(base());await pending;
 assert.equal(r.queue.size,0);assert.equal(r.frames.length,0);assert.equal(abandoned,0);
});
test('expiración y abandono oficiales no se proyectan como victoria ni premio',()=>{
 for(const phase of ['expired','abandoned']){const s=projectOfficial({...base(),phase},9000);assert.equal(s.phase,phase);assert.equal(s.outcome,null);assert.equal(s.serverResult.reward.points_awarded,null);}
});
test('pausa reconcilia un timeout concurrente y aplica la transición con la revisión nueva',async()=>{
 let attempts=0;const s=base(),waiting={...s,phase:'waiting',revision:5};
 const r=runtime({current:async()=>null,start:async()=>s,read:async()=>waiting,
    transition:async(id,action,revision)=>{attempts++;if(attempts===1){const e=Error('revision');e.status=409;throw e;}
        assert.equal(revision,5);assert.equal(action,'pause');return {...waiting,phase:'paused',paused_from:'waiting',revision:6};}});
 await r.engine.start();assert.equal(await r.engine.pause(),true);assert.equal(r.engine.state.phase,'paused');assert.equal(attempts,2);r.engine.destroy();
});
test('recupera un arranque incierto antes de tener ID sin cambiar clave ni duplicar RAF',async()=>{
 const storage=memory(),keys=[];let online=false;
 const r=runtime({current:async()=>null,start:async(mode,key)=>{keys.push(key);if(!online)throw Error('offline');return base()}},storage);
 await r.engine.start();assert.equal(r.engine.state,null);assert.equal(r.queue.size,0);const saved=officialJournal(storage,'user').read().key;
 online=true;assert.equal(await r.engine.resume(),true);assert.equal(r.engine.state.id,'official-one');
 assert.ok(keys.every(key=>key===saved));assert.equal(r.queue.size,1);r.engine.destroy();
});
test('401 al conciliar un conflicto conserva error de sesión y nunca inventa premio',async()=>{
 const errors=[];const s=base();const r=runtime({current:async()=>null,start:async()=>s,
    swing:async()=>{const e=Error('revision');e.status=409;throw e},read:async()=>{const e=Error('expired');e.status=401;throw e}});
 await r.engine.start();r.engine.swing();await r.step();assert.equal(r.errors[0].status,401);assert.equal(r.engine.state.networkError,true);
 assert.equal(r.engine.state.stats.score,0);assert.equal(r.engine.state.serverResult.reward.points_awarded,null);r.engine.destroy();
});
test('spam de bateo no resuelve más de una entrada ni crea una victoria',async()=>{
 let swings=0;const s=base();let release;
 const r=runtime({current:async()=>null,start:async()=>s,swing:()=>{swings++;return new Promise(resolve=>release=resolve)}});
 await r.engine.start();for(let n=0;n<100;n++)r.engine.swing();assert.equal(swings,1);assert.equal(r.engine.state.outcome,null);
 release({...s,phase:'waiting',last:{type:'early',at:1,resolved_at:1001,duration:600},next_at:1601,
    stats:{...s.stats,resolved:1,misses:1,swings:1}});await r.step();assert.equal(r.engine.state.stats.score,0);assert.equal(r.engine.state.outcome,null);r.engine.destroy();
});
test('un inicio pendiente recupera su clave específica antes de otro resultado histórico',async()=>{
 const storage=memory();officialJournal(storage,'user').write({key:'uncertain-new',mode:'streak'});let reads=0;
 const r=runtime({current:async()=>{reads++;return {...base(),id:'old-finished',phase:'completed'}},
    start:async(mode,key)=>{assert.equal(key,'uncertain-new');return base()}},storage);
 await r.engine.start();assert.equal(reads,0);assert.equal(r.engine.state.id,'official-one');r.engine.destroy();
});
test('la calibración no muestra un uno ficticio antes de la cuenta atrás real',()=>{
 const s={...base(),phase:'waiting',pitch_start:null,plan:null};assert.equal(projectOfficial(s,1000).phase,'preparing');
 assert.equal(projectOfficial({...s,phase:'pitch',pitch_start:4000,plan:base().plan},1000).phase,'countdown');
});
test('confirmar un bateo no reinicia la animación que ya empezó mientras esperaba la red',()=>{
 const s={...base(),phase:'waiting',last:{type:'perfect',at:1200,resolved_at:2250,duration:600}};
 const draw=projectOfficial(s,2260,false,null,160);assert.equal(draw.phase,'feedback');assert.equal(draw.elapsed,160);assert.equal(draw.stats.score,s.stats.score);
});

test('pausa oficial deja de pedir RAF, concilia por segundo y libera el timer al reanudar o desmontar',async()=>{
 let time=0,n=0,reads=0,snapshot=base();const frames=new Map(),timers=new Map();
 const engine=createOfficialEngine({user:'qa',mode:'streak',rules,storage:memory(),now:()=>time,
  requestFrame:fn=>{frames.set(++n,fn);return n},cancelFrame:id=>frames.delete(id),
  setTimer:(fn,ms)=>{assert.equal(ms,1000);timers.set(++n,fn);return n},clearTimer:id=>timers.delete(id),
  api:{current:async()=>null,start:async()=>snapshot,
   transition:async(id,action)=>snapshot={...snapshot,phase:action==='pause'?'paused':'pitch',paused_from:'pitch'},
   read:async()=>{reads++;return snapshot}}});
 await engine.start();assert.equal(frames.size,1);await engine.pause();assert.equal(frames.size,0);assert.equal(timers.size,1);
 time=1000;const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(reads,1);assert.equal(frames.size,0);assert.equal(timers.size,1);
 await engine.resume();assert.equal(timers.size,0);assert.equal(frames.size,1);
 await engine.pause();assert.equal(timers.size,1);engine.destroy();assert.equal(timers.size,0);assert.equal(frames.size,0);
});
