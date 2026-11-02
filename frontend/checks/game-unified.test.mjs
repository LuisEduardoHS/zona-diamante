import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadGame,rules} from './game-module-loader.mjs';
const {createMatch,advance,swing}=await loadGame('game-state.js');
const {resultPresentation}=await loadGame('game-view.js');
const fresh=()=>advance(createMatch(rules,'unified'),rules.timing.countdownMs,rules);
function shot(g,hit){
 const s=swing(advance(g,hit?g.plan.contactMs:0,rules),rules);
 assert.equal(swing(s,rules),s,'second swing cannot resolve twice');
 return advance(s,s.last.duration,rules);
}
for(const hits of [0,4,5,6,10])test(`unificado: ${hits} hits, siempre diez tiros`,()=>{
 let g=fresh();for(let i=0;i<10;i++){
  assert.equal(g.outcome,null);g=shot(g,i<hits);
  if(i<9)assert.equal(g.phase,'pitch');
 }
 assert.equal(g.phase,'finished');assert.equal(g.stats.resolved,10);assert.equal(g.stats.hits,hits);assert.equal(g.outcome,hits>=5?'won':'lost');
});
test('racha máxima persiste, sin victoria anticipada al quinto hit',()=>{
 let g=fresh();for(let i=0;i<5;i++)g=shot(g,true);
 assert.equal(g.outcome,null);g=shot(g,false);assert.equal(g.stats.streak,0);assert.equal(g.stats.bestStreak,5);
 while(g.phase!=='finished')g=shot(g,true);assert.equal(g.stats.bestStreak,5);
});
test('diez lanzamientos pasivos terminan en derrota y no inventan saldo',()=>{
 const g=advance(fresh(),60000,rules);assert.equal(g.stats.resolved,10);assert.equal(g.stats.hits,0);assert.equal(g.outcome,'lost');
 assert.deepEqual(resultPresentation(g),{credited:null,balance:null,bonus:0,note:'Práctica · sin puntos de cuenta.',toast:null});
});
const official=(status='confirmed',points=55)=>({official:true,phase:'finished',serverResult:{phase:'completed',points_balance:123,reward:{status,points_awarded:points,extra_hit_bonus:15,streak_bonus:10}}});
test('resultado sólo acredita después del cierre oficial y usa el desglose del servidor',()=>{
 assert.equal(resultPresentation({...official(),phase:'feedback'}).credited,null);
 assert.equal(resultPresentation({...official(),serverResult:{phase:'ready'}}).balance,null);
 assert.deepEqual(resultPresentation(official()),{credited:55,balance:123,bonus:25,note:'Puntos acreditados en tu cuenta.',toast:'+ 55 puntos'});
 const capped=resultPresentation(official('daily_limit',0));assert.equal(capped.credited,0);assert.equal(capped.bonus,0);assert.equal(capped.toast,null);assert.match(capped.note,/Cupo diario/);
});
test('el HTML contiene sólo portada, partida y resultado, y usa el estadio real',async()=>{
 const html=await readFile(new URL('../public/pages/experiencias/juego.html',import.meta.url),'utf8');
 assert.deepEqual([...html.matchAll(/data-game-screen="(.*?)"/g)].map(m=>m[1]),['home','play','result']);
 assert.doesNotMatch(html,/data-mode=|data-help|game-help|Clásica|Seleccionar modalidad/);
 assert.match(html,/assets\/img\/juego\/estadio.png/);
 assert.match(html,/<p id="game-bat-hint"[^>]*>Presiona para batear<\/p>/);
 assert.match(html,/<button id="game-hit"[^>]*aria-label="Batear"[^>]*><\/button>/);
});
