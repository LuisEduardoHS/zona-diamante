// Actual page, sprites and game clock. Start phase04-preview.cjs first;
// port 4191 exposes its explicit guest-only deterministic clock fixture.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const base=process.env.GAME_ART_PREVIEW||'http://127.0.0.1:4191';

(async()=>{
 const output=path.resolve(__dirname,'../../.tmp/game-pitcher/review');await fs.mkdir(output,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage({reducedMotion:'reduce'});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const step=ms=>page.evaluate(ms=>window.__gameQA.step(ms),ms);
  const snapshot=()=>page.evaluate(()=>window.__gameQA.handle.state);
  const center=box=>({x:box.x+box.width/2,y:box.y+box.height/2});
  for(const [width,height] of [[320,568],[390,844],[844,390],[1440,1000]]){
   await page.setViewportSize({width,height});await page.goto(base+'/pages/experiencias/juego.html');
   await page.waitForFunction(()=>window.__gameQA&&!document.getElementById('game-start').disabled);
   assert.equal(await page.locator('#game-pitcher img').count(),4);
   assert.equal(await page.locator('#game-pitcher img').evaluateAll(nodes=>nodes.every(n=>n.complete&&n.naturalWidth===540&&n.naturalHeight===950)),true);
   assert.equal(await page.locator('#game-ball img').evaluate(n=>n.complete&&n.naturalWidth===800),true);
   await page.locator('#game-start').click();await step(3000);
   const plan=(await snapshot()).plan,release=plan.contactMs*.32;
   let elapsed=0;
   for(const [name,time,pose] of [['windup',0,0],['stride',release*.4,1],['throw',release*.8,2],['release',release,3]]){
    await step(time-elapsed);elapsed=time;
    assert.equal(await page.locator('#game-pitcher').getAttribute('data-pose'),String(pose));
    assert.equal(await page.locator('#game-pitcher img:not([hidden])').count(),1);
    assert.equal(await page.locator('#game-ball').isVisible(),name==='release');
    if(width===390)await page.screenshot({path:path.join(output,`${name}.png`)});
   }
   const pitcher=await page.locator('#game-pitcher').boundingBox(),ball=center(await page.locator('#game-ball').boundingBox());
   assert.ok(Math.abs(ball.x-(pitcher.x+pitcher.width*.89))<1,JSON.stringify({width,pitcher,ball}));
   assert.ok(Math.abs(ball.y-(pitcher.y+pitcher.height*.71))<1);
   await page.locator('#game-pause').click();const paused=await snapshot();await step(10000);
   assert.equal((await snapshot()).elapsed,paused.elapsed);
   const frozen=center(await page.locator('#game-ball').boundingBox());
   // ResizeObserver may settle a fractional scene dimension after the first
   // draw; logical time is exact, while CSS-pixel projection allows rounding.
   assert.ok(Math.abs(frozen.x-ball.x)<.5&&Math.abs(frozen.y-ball.y)<.5);
   assert.equal(await page.locator('#game-pitcher').getAttribute('data-pose'),'3');
   await page.locator('#game-resume').click();await step(plan.contactMs-release);
   const contact=center(await page.locator('#game-contact').boundingBox()),arriving=center(await page.locator('#game-ball').boundingBox());
   assert.ok(Math.abs(contact.x-arriving.x)<1&&Math.abs(contact.y-arriving.y)<1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:path.join(output,`contact-${width}.png`)});
   await page.locator('#game-hit').dispatchEvent('pointerdown',{button:0,isPrimary:true});
   assert.equal((await snapshot()).last.type,'perfect');
   const before=await snapshot();await page.setViewportSize({width:width+20,height});await step(0);
   assert.deepEqual((await snapshot()).stats,before.stats);
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: four poses, release from hand, ball at contact, pause/resume and resize at four phone/landscape/desktop sizes; no browser errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
