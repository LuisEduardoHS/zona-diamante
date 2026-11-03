import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGame} from './game-module-loader.mjs';
const {createGameMotion}=await loadGame('game-motion.js');
function fixture(reduced=false){
 const frames=new Map(),listeners=new Map();let id=0,time=0;
 const media={matches:reduced,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
 const motion=createGameMotion({media,now:()=>time,requestFrame:fn=>{frames.set(++id,fn);return id;},cancelFrame:id=>frames.delete(id)});
 const step=t=>{time=t;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(fn=>fn(time));};
 const node=hidden=>({hidden,inert:false,textContent:'',attrs:new Map(),animations:[],
  setAttribute(k,v){this.attrs.set(k,v);},removeAttribute(k){this.attrs.delete(k);},toggleAttribute(k,on){if(on)this.attrs.set(k,'');else this.attrs.delete(k);},
  animate(){let finish;const animation={finished:new Promise(r=>finish=r),cancelled:false,cancel(){this.cancelled=true;},complete(){finish();}};this.animations.push(animation);return animation;}
 });
 return {motion,step,node,frames,media,listeners};
}
test('un panel saliente pierde la interacción de inmediato y se oculta al terminar',async()=>{
 const f=fixture(),panel=f.node(false);f.motion.visible(panel,false);
 assert.equal(panel.inert,true);assert.equal(panel.attrs.get('aria-hidden'),'true');assert.equal(panel.hidden,false);
 panel.animations[0].complete();await Promise.resolve();assert.equal(panel.hidden,true);f.motion.destroy();
});
test('alternar pausa rápidamente no permite que una salida vieja oculte la entrada nueva',async()=>{
 const f=fixture(),panel=f.node(true);
 f.motion.visible(panel,true);f.motion.visible(panel,false);const stale=panel.animations[1];f.motion.visible(panel,true);
 stale.complete();await Promise.resolve();assert.equal(panel.hidden,false);assert.equal(panel.inert,false);
 assert.equal(panel.attrs.get('aria-hidden'),'false');assert.ok(stale.cancelled);f.motion.destroy();
});
test('el contador visual conserva el valor accesible final y termina exactamente en el saldo confirmado',()=>{
 const f=fixture(),number=f.node(false);f.motion.count(number,240,{from:190,delay:0,duration:800});
 assert.equal(number.attrs.get('aria-label'),'240');f.step(400);assert.ok(+number.textContent>190&&+number.textContent<240);
 f.step(800);assert.equal(number.textContent,'240');assert.equal(f.frames.size,0);assert.equal(number.attrs.has('aria-label'),false);f.motion.destroy();
});
test('desmontar cancela los fotogramas y fija las cifras finales sin dejar una salida pendiente',()=>{
 const f=fixture(),number=f.node(false),panel=f.node(false);
 f.motion.count(number,50,{prefix:'+'});f.motion.visible(panel,false);f.motion.destroy();
 assert.equal(number.textContent,'+50');assert.equal(panel.hidden,true);assert.equal(f.frames.size,0);assert.equal(f.listeners.size,0);
});
test('movimiento reducido evita animaciones y cambiar la preferencia termina las que estaban en curso',()=>{
 const f=fixture(true),panel=f.node(true),number=f.node(false);
 f.motion.visible(panel,true);f.motion.pulse(number);f.motion.count(number,65,{prefix:'+'});
 assert.equal(panel.hidden,false);assert.equal(panel.animations.length,0);assert.equal(number.textContent,'+65');assert.equal(f.frames.size,0);
 f.media.matches=false;f.motion.count(number,100);f.media.matches=true;f.listeners.get('change')();
 assert.equal(number.textContent,'100');assert.equal(f.frames.size,0);f.motion.destroy();
});
