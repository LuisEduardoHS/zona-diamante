import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGame,rules} from './game-module-loader.mjs';
const {createMatch,advance,swing,pitchPlan,pause,resume}=await loadGame('game-state.js');
const {resultPresentation}=await loadGame('game-view.js');
const fresh=()=>advance(createMatch(rules,'survival'),rules.timing.countdownMs,rules);
function shot(g,hit=true){
 const s=swing(advance(g,hit?g.plan.contactMs:0,rules),rules);
 assert.equal(swing(s,rules),s,'one swing per pitch');
 return advance(s,s.last.duration,rules);
}
test('tres fallos acumulados terminan aunque haya hits entre ellos',()=>{
 let g=fresh();for(const h of [false,true,false,true])g=shot(g,h);
 assert.equal(g.stats.misses,2);assert.equal(g.phase,'pitch');assert.equal(g.outcome,null);
 g=shot(g,false);assert.equal(g.phase,'finished');assert.equal(g.stats.misses,3);assert.equal(g.outcome,'lost');
});
for(const hits of [0,9,10,11,12,25,200])test(`sin límite de tiros: ${hits} hits y luego tres fallos`,()=>{
 let g=fresh();for(let i=0;i<hits;i++){g=shot(g);assert.equal(g.outcome,null);assert.equal(g.phase,'pitch');}
 assert.equal(g.stats.hits,hits);
 for(let i=0;i<3;i++)g=shot(g,false);
 assert.equal(g.stats.hits,hits);assert.equal(g.stats.resolved,hits+3);assert.equal(g.stats.misses,3);
 assert.equal(g.phase,'finished');assert.equal(g.outcome,hits>=10?'won':'lost');
});
test('velocidad aumenta en cada tiro, con tiempos y ventanas siempre positivos',()=>{
 let previous=Infinity;
 for(let i=1;i<=10000;i++){
  const p=pitchPlan(rules,i,'survival');assert.ok(p.flightMs<previous);assert.ok(p.flightMs>560);
  assert.ok(p.contactMs+p.validWindowMs<p.flightMs);assert.ok(p.perfectWindowMs>20);previous=p.flightMs;
 }
});
test('los tiros extra sobreviven a dos fallos; sólo se reinicia la racha consecutiva',()=>{
 let g=fresh();for(let i=0;i<11;i++)g=shot(g);
 g=shot(g,false);assert.equal(g.stats.hits,11);assert.equal(g.stats.streak,0);assert.equal(g.stats.bestStreak,11);
 g=shot(g);assert.equal(g.stats.hits,12);assert.equal(g.outcome,null);
 g=shot(g,false);assert.equal(g.phase,'pitch');g=shot(g,false);assert.equal(g.outcome,'won');
});
test('dejar pasar tres pelotas cuenta tres fallos y termina sin inventar puntos',()=>{
 const g=advance(fresh(),60000,rules);assert.equal(g.stats.resolved,3);assert.equal(g.outcome,'lost');
 assert.equal(resultPresentation(g).credited,null);
});
test('pausa y reanudación conservan vidas y velocidad del lanzamiento',()=>{
 let g=shot(fresh(),false);g=advance(g,100,rules);const p=pause(g);
 assert.equal(advance(p,60000,rules),p);assert.equal(resume(p).stats.misses,1);assert.deepEqual(resume(p).plan,g.plan);
});
test('el aviso oficial de derrota usa la meta nueva del servidor',()=>{
 const result=resultPresentation({official:true,mode:'survival',phase:'finished',serverResult:{phase:'completed',rules,points_balance:0,reward:{status:'lost',points_awarded:0}}});
 assert.match(result.note,/10 hits/);assert.equal(result.credited,0);
});
