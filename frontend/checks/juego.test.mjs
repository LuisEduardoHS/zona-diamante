import assert from 'node:assert/strict';
import test from 'node:test';
import { loadGame, rules } from './game-module-loader.mjs';
const { createMatch, advance, swing, pause, resume, abandon } = await loadGame('game-state.js');
const { createGameEngine } = await loadGame('game-engine.js');

test('inicio cuenta atrás y luego lanzamiento; no hay victoria por montar',()=>{
 const game=createMatch(rules,'classic','one');assert.equal(game.phase,'countdown');assert.equal(game.stats.resolved,0);
 assert.equal(advance(game,2999,rules).phase,'countdown');assert.equal(advance(game,3000,rules).phase,'pitch');assert.equal(game.outcome,null);
});
test('pausa y reanudación conservan partida, tiempo y estadísticas',()=>{
 let game=advance(createMatch(rules,'classic','same'),3400,rules);const elapsed=game.elapsed;
 game=pause(game);assert.equal(advance(game,50000,rules),game);assert.equal(swing(game,rules),game);
 game=resume(game);assert.equal(game.id,'same');assert.equal(game.elapsed,elapsed);assert.equal(game.stats.hits,0);
});
test('abandonar es terminal e idempotente; la nueva partida comienza limpia',()=>{
 const old=abandon(advance(createMatch(rules,'classic'),3500,rules));assert.equal(abandon(old),old);assert.equal(resume(old),old);assert.equal(advance(old,1e6,rules),old);
 const next=createMatch(rules,'classic');assert.equal(next.phase,'countdown');assert.equal(next.stats.score,0);
});
test('pausar o intentar batear en pausa nunca anuncia victoria ni puntos',()=>{
 let game=pause(advance(createMatch(rules,'streak'),4200,rules));game=swing(game,rules);assert.equal(game.outcome,null);assert.equal(game.stats.score,0);assert.equal(game.stats.hits,0);
});
test('inicio repetido y reanudación no duplican el loop',()=>{
 let n=0,time=0;const pending=new Map();
 const game=createGameEngine({rules,mode:'classic',now:()=>time,requestFrame:fn=>{pending.set(++n,fn);return n;},cancelFrame:id=>pending.delete(id)});
 game.start();game.start();assert.equal(pending.size,1);time=100;game.pause();assert.equal(pending.size,0);game.resume();game.resume();assert.equal(pending.size,1);game.destroy();
});
test('salir cancela callbacks e impide resultados residuales en otra instancia',()=>{
 let callback,rendered=0;const old=createGameEngine({rules,mode:'classic',now:()=>0,requestFrame:fn=>{callback=fn;return 1;},cancelFrame:()=>{},onFrame:()=>rendered++});
 old.start();old.destroy();callback();assert.equal(old.state.phase,'abandoned');assert.equal(rendered,1);assert.equal(createMatch(rules,'classic').stats.score,0);
});
