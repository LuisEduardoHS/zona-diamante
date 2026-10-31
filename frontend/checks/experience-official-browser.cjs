// Requires phase04_live.py + phase04-official-preview.cjs (owned LOCAL stack).
// Exercises actual Auth, FastAPI and SQL; only synthetic points may be spent.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const directory=path.resolve(__dirname,'../../docs/evidencias/fase04/experiencia');
(async()=>{
 const account=JSON.parse(await fs.readFile(path.resolve(__dirname,'../../.tmp/phase04-live/manifest.json'),'utf8'));
 for(const key of ['SUPABASE_URL','BACKEND_API_URL'])assert.equal(new URL(account[key]).hostname,'127.0.0.1');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const report={scope:'Real local Auth/FastAPI/PostgreSQL, synthetic account, real clock. No production writes.',games:[],errors:[]};
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:4211/pages/auth/login.html?next=/pages/experiencias/juego.html');
  await page.locator('#login-correo').fill(account.email);await page.locator('#login-contrasena').fill(account.password);await page.locator('#login-form button[type="submit"]').click();
  await page.waitForURL('**/pages/experiencias/juego.html');await page.waitForFunction(()=>document.getElementById('game-play')?.disabled===false);
  let dropped=false;const completeKeys=[];
  await page.route('**/games/beta/*/complete',async route=>{
   completeKeys.push(route.request().headers()['idempotency-key']);const response=await route.fetch();
   if(!dropped){dropped=true;return route.abort('failed');}return route.fulfill({response});
  });
  for(const [mode,strategy,expected] of [['classic','win',50],['streak','win',60],['classic','lose',10],['streak','win',0]]){
   if(await page.locator('#game-beta').getAttribute('data-screen')==='home')await page.locator('#game-play').click();else await page.locator('#game-change-mode').click();
   await page.locator(`[data-mode="${mode}"]`).click();await page.locator('#game-start').click();
   await page.evaluate(({strategy})=>{
    clearInterval(window.__battingQA);let lastPitch=0;
    window.__battingQA=setInterval(()=>{
     const root=document.getElementById('game-beta');if(!root||root.dataset.screen==='result'){clearInterval(window.__battingQA);return;}
     const b=document.getElementById('game-hit'),pitch=parseInt(document.getElementById('game-progress').textContent),cursor=parseFloat(document.getElementById('game-timing-cursor').style.left);
     if(!b.disabled&&pitch!==lastPitch&&(strategy==='lose'?pitch<=3:cursor>=85.7)){
      lastPitch=pitch;b.click();
     }
    },4);
   },{strategy});
   await page.waitForFunction(()=>document.getElementById('game-beta').dataset.screen==='result',{},{timeout:90000});
   const game=await page.evaluate(()=>Object.fromEntries(['game-result-label','game-final-score','game-final-hits','game-final-misses','game-account-points','game-result-reward'].map(id=>[id,document.getElementById(id).textContent])));
   assert.match(game['game-account-points'],new RegExp('\\+'+expected+'$'));assert.match(game['game-result-label'],strategy==='lose'?/DERROTA/:/CONSEGUIDO/);
   report.games.push({mode,strategy,expected,...game});
   await page.waitForTimeout(300); // Capture the settled result, after its entrance animation.
   await page.screenshot({path:path.join(directory,`oficial-${mode}-${strategy}-${expected}.png`),fullPage:true});
  }
  assert.equal(dropped,true);assert.equal(completeKeys[0],completeKeys[1]);report.lostResponse='Completion committed before losing response; retry uses same key';
  await page.reload();await page.waitForFunction(()=>document.getElementById('game-play')?.disabled===false);await page.locator('#game-play').click();await page.locator('#game-start').click();
  await page.waitForFunction(()=>document.getElementById('game-beta').dataset.screen==='result');report.recovery='Reload reads persisted result';
  await page.locator('#game-collection').click();await page.waitForFunction(()=>document.querySelectorAll('[data-card]').length===20);
  assert.equal(await page.locator('#col-balance').textContent(),'310');
  const id=await page.evaluate(async()=>{const {collectionApi}=await import('/js/api/collection-client.js');const data=await collectionApi.collection();return data.cards.find(c=>c.slug==='sultanes-de-monterrey').id;});
  await page.locator(`[data-card="${id}"]`).click();await page.locator('#col-buy').click();await page.locator('#col-confirm-buy').click();
  await page.waitForFunction(()=>document.getElementById('col-balance').textContent==='60');assert.match(await page.locator('#col-detail-price').textContent(),/En tu colección/);
  await page.reload();await page.waitForFunction(()=>document.getElementById('col-balance')?.textContent==='60');report.collection='Server balance 310 → 60 after one 250-point synthetic purchase; persisted after reload';
  assert.deepEqual(report.errors,[]);await fs.writeFile(path.join(directory,'official-browser.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS: 4 real official games, lost response, daily limit, recovery and persistent synthetic purchase; 0 page errors');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
