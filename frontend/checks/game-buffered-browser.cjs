// Browser-only account/network fixtures; actual game, inputs, journal and SPA.
// SQL acceptance separately validates replay, points and exactly-once rewards.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const base = process.env.MATCHES_FRONTEND || 'http://127.0.0.1:5500';

(async () => {
    const rules = JSON.parse(await fs.readFile(path.resolve(__dirname, '../../backend/app/core/game_beta_rules.json'), 'utf8'));
    const output = path.resolve(__dirname, '../../.tmp/game-buffered/review');
    await fs.mkdir(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        await context.route('**/js/app/runtime-config.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const runtimeConfig={BACKEND_API_URL:'${base}'};` }));
        await context.route('**/js/features/auth/supabase-provider.js', route => route.fulfill({ contentType: 'text/javascript', body: `const state={cargando:false,user:{id:'buffered-browser'},profile:{username:'QA',points_balance:0}};export const proveedorSupabase=Object.fromEntries(['iniciarSesion','crearCuenta','solicitarRestablecimiento','restablecerContrasena','actualizarPerfil','cerrarSesion'].map(name=>[name,async()=>{throw Error('Fixture only')}]).concat([['obtenerPerfil',async()=>state],['observarSesion',fn=>{fn(state);return()=>{}}]]));` }));
        await context.route('**/js/services/supabase-client.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'browser-fixture'}}})}};` }));
        let offline = false, starts = 0, liveCalls = 0, points = 0, loseReply = false;
        const startsByKey = new Map(), receipts = new Map(), submissions = [];
        const snapshot = id => ({ id, transport: 'buffered-1', version: 'survival-1', mode: 'survival', phase: 'waiting',
            rules, rewarded_today: receipts.size, daily_limit: 3, points_balance: points, stats: {}, reward: { status: 'pending' } });
        await context.route('**/api/v1/games/beta**', route => { liveCalls++; return route.fulfill({ status: 500, body: 'Live pitch endpoint must not be used' }); });
        await context.route('**/api/v1/games/buffered**', async route => {
            const request = route.request(), url = new URL(request.url());
            if (url.pathname.endsWith('/buffered')) {
                const key = request.headers()['idempotency-key'];
                if (!startsByKey.has(key)) { starts++; startsByKey.set(key, snapshot(randomUUID())); }
                // A healthy but 1.2-second reservation must never fail a 250ms gate.
                await new Promise(resolve => setTimeout(resolve, 1200));
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify(startsByKey.get(key)) });
            }
            const id = url.pathname.split('/').at(-2), events = request.postDataJSON().events;
            submissions.push({ id, events });
            if (offline) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"Simulated outage"}' });
            if (!receipts.has(id)) {
                points += 40;
                receipts.set(id, { ...snapshot(id), phase: 'completed', outcome: 'won', rewarded_today: receipts.size + 1,
                    points_balance: points, stats: { hits: events.length - 3, misses: 3, resolved: events.length, bestStreak: events.length - 3, score: 200 },
                    reward: { status: 'confirmed', points_awarded: 40, extra_hit_bonus: 0, streak_bonus: 10 } });
                if (loseReply) { loseReply = false; return route.abort('connectionreset'); }
            }
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify(receipts.get(id)) });
        });
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.clock.install({ time: new Date('2026-11-08T18:00:00Z') });
        await page.clock.pauseAt(new Date('2026-11-08T18:00:01Z'));
        const open = async () => {
            await page.goto(`${base}/pages/experiencias/juego.html`);
            await page.waitForFunction(() => !document.getElementById('game-start')?.disabled);
            await page.evaluate(async () => { window.__bufferedQA = (await import('/js/features/juego/ganar_juego.js?v=20261110-game-art')).iniciarJuego(); });
        };
        const state = () => page.evaluate(() => window.__bufferedQA.state);
        const play = async () => {
            await page.locator('#game-start').click();
            await page.waitForFunction(() => window.__bufferedQA.state?.phase === 'countdown');
            await page.clock.runFor(3020);
        };
        const shot = async hit => {
            const before = await state(); assert.equal(before.phase, 'pitch');
            if (hit) await page.clock.runFor(Math.max(0, before.plan.contactMs - before.elapsed));
            await page.locator('#game-hit').dispatchEvent('pointerdown', { button: 0, isPrimary: true });
            const after = await state(); assert.equal(after.phase, 'feedback');
            await page.clock.runFor(after.last.duration + 25);
        };
        const finish = async () => { for (let n = 0; n < 10; n++) await shot(true); for (let n = 0; n < 3; n++) await shot(false); };
        const journal = () => page.evaluate(() => JSON.parse(localStorage.getItem('zd:game:buffered:buffered-browser')));
        await open(); await play(); assert.equal(starts, 1); assert.equal(liveCalls, 0);
        offline = true;
        await page.locator('#game-pause').click(); const paused = await state();
        await page.clock.runFor(10000); assert.equal((await state()).elapsed, paused.elapsed);
        await page.locator('#game-resume').click(); await finish();
        await page.locator('[data-game-screen=result]:not([hidden])').waitFor();
        await page.waitForFunction(() => document.getElementById('game-result-retry')?.hidden === false);
        assert.equal(await page.locator('#game-account-points').textContent(), '—');
        assert.match(await page.locator('#game-result-reward').textContent(), /guardada/);
        assert.equal((await journal()).outbox[0].events.length, 13);
        assert.equal(starts, 1); assert.equal(liveCalls, 0);
        for (const [width, height] of [[320, 740], [390, 844], [1440, 1000]]) {
            await page.setViewportSize({ width, height });
            await page.screenshot({ path: path.join(output, `pending-${width}.png`) });
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            const retry = await page.locator('#game-result-retry').boundingBox();
            const nav = await page.locator('.site-bottom-nav').boundingBox();
            assert.ok(retry.y + retry.height <= nav.y, JSON.stringify({ retry, nav, width }));
        }
        console.log('PASS: 1200ms reservation, complete game offline, local pause and pending result with no live commands');
        const saved = (await journal()).outbox[0];
        await open(); await page.locator('#game-start').click();
        await page.waitForFunction(() => window.__bufferedQA.state?.phase === 'finished');
        assert.equal(starts, 1); assert.equal((await journal()).outbox[0].id, saved.id);
        assert.equal(await page.locator('#game-account-points').textContent(), '—');
        await page.locator('#game-result-close').click();
        await page.locator('.site-bottom-nav a[href$="Informacion.html"]').click();
        await page.waitForFunction(() => !document.getElementById('game-beta'));
        offline = false; await page.evaluate(() => window.dispatchEvent(new Event('online')));
        await page.waitForFunction(() => JSON.parse(localStorage.getItem('zd:game:buffered:buffered-browser')).outbox.length === 0);
        const balance = await page.evaluate(async () => (await import('/js/features/auth/session.js')).obtenerEstadoSesion().profile.points_balance);
        assert.equal(balance, 40); assert.equal(receipts.size, 1);
        assert.ok(submissions.every(row => JSON.stringify(row.events) === JSON.stringify(saved.events)));
        console.log('PASS: reload retains the receipt; reconnecting on another section confirms it once and updates the account');
        loseReply = true; await open(); await play(); await finish();
        await page.waitForFunction(() => document.getElementById('game-result-retry')?.hidden === false);
        await page.locator('#game-result-retry').click();
        await page.waitForFunction(() => document.getElementById('game-account-points')?.textContent === '+40');
        assert.equal(points, 80); assert.equal(receipts.size, 2); assert.equal((await journal()).outbox.length, 0);
        assert.deepEqual(errors, []);
        console.log('PASS: lost confirmation reply retries the same game without a second credit; no browser errors');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
