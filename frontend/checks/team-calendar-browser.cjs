// Frontend on :5500, FastAPI on :8000. Uses real read-only schedules, then
// browser-only fixtures for provider errors, refresh and cancellation.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.MATCHES_FRONTEND || 'http://127.0.0.1:5500';
const backend = process.env.MATCHES_BACKEND || 'http://127.0.0.1:8000';
const teams = [['sultanes-mty', 562], ['dorados-chi', 575], ['charros-jal', 6304], ['algodoneros-ul', 447]];
const output = path.resolve(__dirname, '../../.tmp/team-calendar-review');

(async () => {
    await fs.mkdir(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const errors = [];
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', timezoneId: 'Asia/Tokyo' });
        await context.route('**/js/app/runtime-config.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const runtimeConfig = { BACKEND_API_URL: '${backend}' };` }));
        await context.route('**/js/features/auth/supabase-provider.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const proveedorSupabase=Object.fromEntries(['iniciarSesion','crearCuenta','solicitarRestablecimiento','restablecerContrasena','actualizarPerfil','cerrarSesion'].map(name=>[name,async()=>{throw Error('Read-only review')}]).concat([['obtenerPerfil',async()=>({user:null,profile:null})],['observarSesion',fn=>{fn({user:null,profile:null,cargando:false});return()=>{}}]]));` }));
        await context.route('**/js/services/supabase-client.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export const supabase={auth:{getSession:async()=>({data:{session:null}})}};' }));
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        page.on('pageerror', error => errors.push(error.message));
        let authenticated = false;
        page.on('request', request => { if (request.url().includes('/api/v1/matches?') && request.headers().authorization) authenticated = true; });
        const ready = () => page.waitForFunction(() => document.querySelector('[data-equipo-calendar=juegos]')?.getAttribute('aria-busy') === 'false', null, { timeout: 15000 });
        const go = async (slug = 'sultanes-mty', date = '2026-07-01') => {
            await page.goto(`${base}/pages/equipos/equipo.html?id=${slug}&fecha=${date}`);
            try { await ready(); }
            catch (error) { console.error('Page errors:', errors); console.error((await page.locator('body').innerText()).slice(0, 600)); throw error; }
        };
        const dateField = () => page.locator('[data-equipo-calendar=fecha]');
        const setDate = async value => { await dateField().fill(value); await dateField().dispatchEvent('change'); };
        const cards = () => page.locator('.equipo-calendar .partido-card');
        const summary = selector => page.locator(selector).evaluateAll(nodes => nodes.map(node => ({ id: node.getAttribute('aria-labelledby'), teams: [...node.querySelectorAll('.partido-name strong')].map(name => name.textContent), runs: [...node.querySelectorAll('.partido-runs')].map(run => run.textContent) })));
        const response = await context.request.get(`${backend}/api/v1/matches?league=lmb&date=2026-07-01`);
        assert.equal(response.status(), 200);
        const snapshot = await response.json();
        for (const [slug, id] of teams) {
            await go(slug);
            const games = snapshot.games.filter(game => [game.away.team.id, game.home.team.id].includes(id));
            assert.ok(games.length > 0);
            assert.equal(await cards().count(), games.length);
            const mini = await summary('.equipo-calendar .partido-card');
            assert.deepEqual(mini.map(game => game.id), games.map(game => `partido-${game.id}`));
            const href = new URL(await page.locator('[data-equipo-calendar=completo]').getAttribute('href'));
            assert.equal(href.searchParams.get('liga'), 'lmb');
            assert.equal(href.searchParams.get('equipo'), String(id));
            assert.equal(href.searchParams.get('fecha'), '2026-07-01');
            await page.locator('[data-equipo-calendar=completo]').click();
            await page.waitForFunction(() => document.getElementById('partidos-lista')?.getAttribute('aria-busy') === 'false');
            assert.equal(await page.locator('#partidos-equipo').inputValue(), String(id));
            assert.deepEqual(await summary('#partidos-lista .partido-card'), mini);
            console.log(`PASS ${slug}: same real IDs, teams, runs and date in both calendars`);
        }
        await go();
        for (const [width, height] of [[320, 740], [390, 844], [1440, 1000]]) {
            await page.setViewportSize({ width, height });
            await page.locator('.equipo-calendar').evaluate(node => window.scrollTo(0, window.scrollY + node.getBoundingClientRect().top - 95));
            await page.waitForFunction(() => [...document.querySelectorAll('.equipo-calendar .partido-logo img')].every(image => image.complete));
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            const card = await page.locator('.equipo-calendar').boundingBox();
            assert.ok(card.x >= 0 && card.x + card.width <= width);
            await page.screenshot({ path: path.join(output, `calendario-${width}.png`) });
            console.log(`PASS ${width}px: calendar layout and local team logos`);
        }
        await setDate('2026-11-08'); await ready();
        assert.equal(await cards().count(), 0);
        assert.match(await page.locator('[data-equipo-calendar=juegos]').textContent(), /no tiene partidos programados en LMB/);
        await page.locator('[data-equipo-calendar=anterior]').click(); await ready();
        assert.equal(await dateField().inputValue(), '2026-11-07');
        await page.locator('[data-equipo-calendar=siguiente]').click(); await ready();
        assert.equal(await dateField().inputValue(), '2026-11-08');
        console.log('PASS: date controls and empty out-of-season days');
        const pattern = '**/api/v1/matches?*';
        await page.route(pattern, route => route.fulfill({ status: 502, contentType: 'application/json', body: '{"detail":"Unavailable"}' }));
        await go();
        assert.equal(await cards().count(), 0);
        assert.ok(await page.locator('[data-calendar-action=retry]').isVisible());
        await page.unroute(pattern);
        await page.locator('[data-calendar-action=retry]').click(); await ready();
        assert.equal(await cards().count(), 2);
        await page.route(pattern, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...snapshot, stale: true }) }));
        await page.locator('[data-equipo-calendar=actualizar]').click(); await ready();
        assert.match(await page.locator('[data-equipo-calendar=aviso]').textContent(), /últimos datos guardados/);
        console.log('PASS: provider failure, retry and explicit stale data');
        await page.unroute(pattern);
        await page.route(pattern, async route => {
            const date = new URL(route.request().url()).searchParams.get('date');
            await new Promise(resolve => setTimeout(resolve, date === '2026-07-02' ? 400 : 10));
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...snapshot, date }) }).catch(() => {});
        });
        await page.locator('[data-equipo-calendar=siguiente]').click();
        await page.locator('[data-equipo-calendar=siguiente]').click(); await ready();
        assert.equal(await dateField().inputValue(), '2026-07-03');
        await page.locator('[data-equipo-calendar=siguiente]').click();
        await page.locator('.site-bottom-nav a[href$="index.html"]').click();
        await page.waitForSelector('.inicio-acciones');
        assert.equal(await page.locator('.equipo-calendar').count(), 0);
        console.log('PASS: obsolete requests are cancelled when changing date or leaving');
        await page.unroute(pattern);
        await page.clock.install({ time: new Date('2026-07-01T18:00:00Z') });
        let requests = 0;
        await page.route(pattern, route => { requests++; return route.fulfill({ contentType: 'application/json', body: JSON.stringify(snapshot) }); });
        await go(); const initial = requests;
        await page.clock.fastForward(60001); await ready();
        assert.equal(requests, initial + 1);
        await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
        await page.clock.fastForward(60001); assert.equal(requests, initial + 1);
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
        await ready(); assert.equal(requests, initial + 2);
        assert.equal(authenticated, false);
        assert.deepEqual(errors, []);
        console.log('PASS: shared public API, minute refresh and hidden-tab pause; no browser errors');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
