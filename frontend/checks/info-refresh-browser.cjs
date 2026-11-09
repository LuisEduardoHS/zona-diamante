// Actual pages/controllers; the result receipt is an explicit visual fixture.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.MATCHES_FRONTEND || 'http://127.0.0.1:5500';

(async () => {
    const output = path.resolve(__dirname, '../../.tmp/info-refresh/review');
    await fs.mkdir(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const errors = [];
    try {
        const page = await browser.newPage({ reducedMotion: 'reduce' });
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + '/pages/contenido/Informacion.html');
        await page.waitForSelector('#historia-app[data-iniciada]');
        await page.evaluate(() => document.fonts.ready);
        for (const [width,height] of [[320,740],[390,844],[1440,1000]]) {
            await page.setViewportSize({ width,height });
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Info overflows '+width);
            await page.screenshot({ path: path.join(output, `info-${width}.png`), fullPage: true });
        }
        const hero = await page.locator('.historia-hero').evaluate(node => ({ image:getComputedStyle(node).backgroundImage, circles:node.querySelectorAll('circle').length }));
        assert.deepEqual(hero, { image:'none', circles:0 });
        await page.locator('#info-tab-lmp').click();
        assert.equal(await page.locator('#info-panel-lmp').isVisible(), true);
        assert.equal(await page.locator('#info-panel-lmb').isVisible(), false);
        assert.ok((await page.locator('#info-panel-lmp .historia-button').getAttribute('href')).endsWith('?liga=lmp'));
        await page.locator('#info-tab-lmp').press('ArrowLeft');
        assert.equal(await page.locator('#info-tab-lmb').getAttribute('aria-selected'), 'true');
        assert.equal(await page.locator('#info-panel-lmb').isVisible(), true);
        for (const [era,count] of [['mundo',3],['origen',2],['expansion',1],['todas',6]]) {
            await page.locator(`.historia-filtro[data-era=${era}]`).click();
            assert.equal(await page.locator('.historia-evento:not(.hidden)').count(), count);
            assert.match(await page.locator('#historia-filter-status').textContent(), new RegExp('^'+count+' '));
        }
        await page.locator('.historia-term').nth(1).locator('summary').click();
        assert.equal(await page.locator('.historia-term').nth(1).getAttribute('open'), '');
        await page.locator('.historia-section-nav a[href="#el-juego"]').click();
        assert.ok((await page.locator('#el-juego').boundingBox()).y >= 90);
        await page.locator('.historia-league-copy .historia-button').first().click();
        await page.waitForSelector('#partidos-app');
        assert.equal(new URL(page.url()).searchParams.get('liga'), 'lmb');
        await page.goBack(); await page.waitForSelector('#historia-app[data-iniciada]');
        await page.locator('#info-tab-lmp').click();
        assert.equal(await page.locator('#info-panel-lmp').isVisible(), true);
        console.log('PASS Info: responsive layouts, solid hero, league tabs/keyboard, history filters, dictionary and SPA return');

        await page.goto(base + '/pages/experiencias/juego.html');
        await page.waitForFunction(() => !document.getElementById('game-start')?.disabled);
        await page.evaluate(() => {
            const root=document.getElementById('game-beta'); root.dataset.screen='result'; root.classList.remove('is-guest-result');
            for(const panel of root.querySelectorAll('[data-game-screen]')) { const visible=panel.dataset.gameScreen==='result'; panel.hidden=!visible; panel.inert=!visible; panel.setAttribute('aria-hidden',String(!visible)); panel.removeAttribute('data-motion-leaving'); }
            const text={ 'game-award-toast':'+65 puntos', 'game-account-points':'+65', 'game-balance':'320', 'game-result-label':'¡Meta lograda!', 'game-result-rule':'15 hits · 3 fallos · 18 tiros', 'game-result-bonus':'Racha extra ×15 · bonus +35', 'game-result-reward':'Puntos acreditados a tu cuenta.' };
            for(const [id,value] of Object.entries(text)) { const node=document.getElementById(id); node.textContent=value; node.hidden=false; }
            document.getElementById('game-result-auth').hidden=true;
        });
        for (const [width,height] of [[320,568],[360,640],[360,740],[390,844],[844,390],[1440,1000]]) {
            await page.setViewportSize({ width,height });
            await page.locator('.game-result').evaluate(node => { node.scrollTop=0; });
            const toast=await page.locator('#game-award-toast').boundingBox();
            const card=await page.locator('.game-result-card').boundingBox();
            const root=await page.locator('.game-result').boundingBox();
            assert.ok(toast.y+toast.height <= card.y-7, JSON.stringify({toast,card,width,height}));
            assert.ok(toast.y >= root.y, 'Toast must remain visible in short viewport');
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await page.screenshot({ path:path.join(output,`result-${width}x${height}.png`) });
        }
        assert.deepEqual(errors, []);
        console.log('PASS game reward: +65 receipt stays above card, clear of close button, at six portrait/landscape/desktop sizes');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
