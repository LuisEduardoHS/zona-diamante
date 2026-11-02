import test from 'node:test';
import assert from 'node:assert/strict';
import {loadGame} from './game-module-loader.mjs';
const {bindBatInput}=await loadGame('game-input.js');
const {contactCue}=await loadGame('game-media.js');
import {loadModule} from './game-module-loader.mjs';
const {createGameServerClient}=await loadModule(new URL('../public/js/api/game-client.js',import.meta.url));

test('red oficial bloqueada termina por timeout y conserva la clave de recuperación',async()=>{
 const keys=[];
 const api=createGameServerClient(async(path,{signal,headers})=>{
  keys.push(headers['Idempotency-Key']);
  return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Request aborted','AbortError')),{once:true}));
 },{timeoutMs:5});
 await assert.rejects(api.start('classic','same-key'),{name:'AbortError'});
 await assert.rejects(api.start('classic','same-key'),{name:'AbortError'});
 assert.deepEqual(keys,['same-key','same-key']);
});

test('desmontar la página aborta inmediatamente una petición oficial en curso',async()=>{
 const caller=new AbortController();let received;
 const api=createGameServerClient(async(path,{signal})=>{received=signal;return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('Stopped','AbortError')),{once:true}));});
 const pending=api.current(caller.signal);caller.abort();await assert.rejects(pending,{name:'AbortError'});assert.equal(received.aborted,true);
});

test('el contacto usa las ventanas del plan, incluso en niveles más rápidos',()=>{
 for(const factor of [1,.8,.6]){
  const plan={contactMs:1200*factor,validWindowMs:150*factor};
  const cue=elapsed=>contactCue({phase:'pitch',elapsed,plan});
  assert.equal(cue(0),'early');
  assert.equal(cue(plan.contactMs-plan.validWindowMs),'contact');
  assert.equal(cue(plan.contactMs+plan.validWindowMs),'contact');
  assert.equal(cue(plan.contactMs+plan.validWindowMs+1),'late');
  assert.equal(contactCue({phase:'paused',elapsed:plan.contactMs,plan}),'waiting');
 }
});

test('toque primario batea al presionar y soltar sobre un lanzamiento nuevo no vuelve a batear',()=>{
 const previousWindow=globalThis.window,previousDocument=globalThis.document;
 globalThis.window=new EventTarget();globalThis.document={querySelector:()=>null};
 try{
  const button=new EventTarget(),abort=new AbortController();let hits=0;
  bindBatInput(button,{signal:abort.signal,swing:()=>hits++});
  const send=(type,props)=>{const event=new Event(type);Object.entries(props).forEach(([k,v])=>Object.defineProperty(event,k,{value:v}));button.dispatchEvent(event);};
  send('pointerdown',{button:0,isPrimary:true});assert.equal(hits,1);
  // The next pitch may already be enabled by the time a long press ends.
  button.disabled=false;send('click',{detail:1});assert.equal(hits,1);
  send('pointerdown',{button:2,isPrimary:true});send('pointerdown',{button:0,isPrimary:false});assert.equal(hits,1);
  send('click',{detail:0});assert.equal(hits,2); // assistive activation
  button.disabled=true;send('pointerdown',{button:0});assert.equal(hits,2);
  button.disabled=false;abort.abort();send('pointerdown',{button:0});send('click',{detail:0});assert.equal(hits,2);
 }finally{globalThis.window=previousWindow;globalThis.document=previousDocument;}
});
