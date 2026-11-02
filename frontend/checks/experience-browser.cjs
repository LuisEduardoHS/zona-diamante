// Run phase04-preview.cjs first. Uses its real guest frontend and injected clock.
// No production credentials, economic requests or simulated confirmed rewards.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const base=process.env.EXPERIENCE_URL||'http://127.0.0.1:4191';
const directory=path.resolve(__dirname,'../../docs/evidencias/fase04/experiencia');
const baseline=process.argv.includes('--baseline');
const report={fixture:'Guest frontend, deterministic monotonic clock; no economic API',checks:[],errors:[]};
async function main(){
 await fs.mkdir(directory,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const [width,height] of [[360,740],[390,844],[768,1024],[1440,900],[844,390]]){
   const page=await browser.newPage({viewport:{width,height},hasTouch:width<=390,reducedMotion:width===768?'reduce':'no-preference'});
   page.on('pageerror',e=>report.errors.push(e.message));
   if(baseline)await page.route('**/*',async route=>{
    const file=new URL(route.request().url()).pathname;
    const files=['/css/juego-Style.css','/pages/experiencias/juego.html',...['game-page.js','game-view.js','game-input.js','game-media.js'].map(f=>'/js/features/juego/'+f)];
    if(!files.includes(file))return route.continue();
    const body=execFileSync('git',['show','1bc8d73:frontend/public'+file],{cwd:path.resolve(__dirname,'../..')});
    await route.fulfill({contentType:file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html',body});
   });
   await page.goto(base+'/pages/experiencias/juego.html');
   await page.waitForFunction(()=>window.__gameQA);await page.evaluate(()=>window.__gameQA.handle.ready);
   const capture=async name=>{await page.screenshot({path:path.join(directory,`${baseline?'antes':'despues'}-${name}-${width}x${height}.png`),fullPage:true});};
   const click=id=>page.locator('#'+id).click();
   const step=ms=>page.evaluate(ms=>window.__gameQA.step(ms),ms);
   const state=()=>page.evaluate(()=>window.__gameQA.handle.state);
   const check=async(label,fn)=>{await fn();report.checks.push(`${width}x${height}: ${label}`);};
   const begin=async mode=>{
    const screen=await page.locator('#game-beta').getAttribute('data-screen');
    if(screen==='home')await click('game-play');else if(screen==='result')await click('game-change-mode');
    await page.locator(`[data-mode="${mode}"]`).click();await click('game-start');await step(3000);
   };
   const hit=async(type='perfect')=>{
    const s=await state();await step(s.plan.contactMs+(type==='early'?-s.plan.contactMs:type==='hit'?s.plan.perfectWindowMs+1:0)-s.elapsed);
    await page.evaluate(()=>document.getElementById('game-hit').click());
    const feedback=await state();await step(feedback.last.duration);
   };
   await capture('inicio');await begin('classic');await capture('activo');
   await step(1200);await capture('contacto');
   if(baseline){await page.close();continue;}
   await check('la pelota coincide con el aro y el control está visible',async()=>{
    assert.equal(await page.locator('#game-beta').getAttribute('data-cue'),'contact');
    const ball=await page.locator('#game-ball').boundingBox(),ring=await page.locator('#game-contact').boundingBox();
    assert.ok(Math.abs(ball.x+ball.width/2-ring.x-ring.width/2)<2);
    assert.ok(Math.abs(ball.y+ball.height/2-ring.y-ring.height/2)<2);
    const button=await page.locator('#game-hit').boundingBox();
    assert.ok(button.width>=44&&button.height>=44&&button.y>=0&&button.y+button.height<=height);
    const point=await page.evaluate(()=>{const b=document.getElementById('game-hit'),r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.bottom-2));});
    assert.ok(point,'navigation does not cover batting control');
    const timingVisible=await page.evaluate(()=>{const b=document.querySelector('.game-timing'),r=b.getBoundingClientRect();return b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));});
    assert.ok(timingVisible,'timing guide remains visible above navigation');
   });
   await check('presionar registra perfecto antes de soltar; soltar no golpea otra pelota',async()=>{
    const b=await page.locator('#game-hit').boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();
    assert.equal((await state()).last.type,'perfect');await step(600);await page.mouse.up();
    assert.equal((await state()).stats.resolved,1);assert.equal((await state()).phase,'pitch');
   });
   await check('pausa congela reloj y reanudar devuelve el foco al campo',async()=>{
    await click('game-pause');const before=await state();await step(20000);assert.deepEqual(await state(),before);await capture('pausa');await click('game-resume');
    assert.equal(await page.evaluate(()=>document.activeElement.id),'game-field');
   });
   await check('fallo temprano explica la corrección y conserva el score',async()=>{
    await page.locator('#game-field').focus();await page.keyboard.press('Space');assert.equal((await state()).last.type,'early');
    assert.match(await page.locator('#game-control-tip').textContent(),/Espera un poco/);assert.equal((await state()).stats.score,20);await step(1400);
   });
   await check('partida clásica completa con victoria',async()=>{
    for(let i=0;i<8;i++)await hit(i%2?'hit':'perfect');
    assert.equal((await state()).outcome,'won');assert.equal((await state()).stats.resolved,10);await capture('victoria');
    assert.match(await page.locator('#game-result-reward').textContent(),/práctica local/);
   });
   await begin('streak');
   await check('racha termina al quinto acierto consecutivo y reinicio limpia las métricas',async()=>{
    for(let i=0;i<5;i++)await hit();assert.equal((await state()).outcome,'won');assert.equal((await state()).stats.resolved,5);
    await click('game-replay');await step(3000);assert.equal((await state()).stats.score,0);
    await click('game-restart');await click('game-confirm-no');assert.equal((await state()).phase,'paused');
    await click('game-restart');await click('game-confirm-yes');assert.equal((await state()).phase,'countdown');
   });
   await check('agotar lanzamientos pierde; abandonar es terminal',async()=>{
    await step(60000);assert.equal((await state()).outcome,'lost');await capture('derrota');
    await click('game-replay');await step(3000);await click('game-exit');await click('game-confirm-yes');
    assert.equal((await state()).phase,'abandoned');await step(60000);assert.equal((await state()).phase,'abandoned');
   });
   await begin('classic');
   await check('pérdida de foco y menú global pausan el juego',async()=>{
    await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal((await state()).phase,'paused');await click('game-resume');
    await click('btn-abrir-menu');await page.waitForFunction(()=>window.__gameQA.handle.state.phase==='paused');
    await page.keyboard.press('Escape');
   });
   await check('resize no altera resultados y no hay overflow horizontal',async()=>{
    const stats=(await state()).stats;await page.setViewportSize({width:width+10,height});await page.setViewportSize({width,height});
    assert.deepEqual((await state()).stats,stats);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   });
   await check('salir mediante SPA destruye el loop y volver permite una partida nueva',async()=>{
    await page.evaluate(()=>{window.__previousGame=window.__gameQA;const a=document.createElement('a');a.href='/index.html';document.body.append(a);a.click();a.remove();});
    await page.waitForSelector('.inicio-layout');assert.equal(await page.evaluate(()=>window.__previousGame.pending()),0);
    assert.equal(await page.locator('button[aria-describedby="partidos-pendiente"]').isDisabled(),true);
    await page.evaluate(()=>{const a=document.createElement('a');a.href='/pages/experiencias/juego.html';document.body.append(a);a.click();a.remove();});
    await page.waitForFunction(()=>window.__gameQA!==window.__previousGame);await page.evaluate(()=>window.__gameQA.handle.ready);await begin('classic');
    assert.equal((await state()).stats.score,0);
   });
   if(width<=390)await check('toque emulado registra un único bateo perfecto',async()=>{
    await step(1200);const b=await page.locator('#game-hit').boundingBox();
    await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);
    assert.equal((await state()).last.type,'perfect');assert.equal((await state()).stats.resolved,1);
   });
   await page.close();
  }
  assert.deepEqual(report.errors,[]);
  const file=baseline?'baseline-browser.json':'game-browser.json';await fs.writeFile(path.join(directory,file),JSON.stringify(report,null,2)+'\n');
  console.log(`PASS: ${report.checks.length} browser scenarios; ${report.errors.length} page errors. Baseline: ${baseline}`);
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1});
