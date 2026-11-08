// Run the static frontend on :5500 and FastAPI on :8013 (or set MATCHES_BACKEND).
// Auth is a local guest stub. Match data comes from the real local backend;
// error/stale/race scenarios are intercepted only inside this browser test.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.MATCHES_FRONTEND || 'http://127.0.0.1:5500';
const backend = process.env.MATCHES_BACKEND || 'http://127.0.0.1:8013';
const output = path.resolve(__dirname, '../../.tmp/partidos-qa/screenshots');
const checks = [];
const errors = [];
const check = async (name, run) => { await run(); checks.push(name); console.log('PASS:', name); };

(async () => {
    await fs.mkdir(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tokyo' });
        await context.route('**/js/app/runtime-config.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const runtimeConfig = { BACKEND_API_URL: '${backend}' };` }));
        await context.route('**/js/features/auth/supabase-provider.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const proveedorSupabase=Object.fromEntries(['iniciarSesion','crearCuenta','solicitarRestablecimiento','restablecerContrasena','actualizarPerfil','cerrarSesion'].map(name=>[name,async()=>{throw new Error('Read-only guest review')}]).concat([['obtenerPerfil',async()=>({user:null,profile:null})],['observarSesion',fn=>{fn({user:null,profile:null,cargando:false});return()=>{}}]]));` }));
        await context.route('**/js/services/supabase-client.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export const supabase={auth:{getSession:async()=>({data:{session:null}})}};' }));
        const page = await context.newPage();
        page.setDefaultTimeout(15000);
        page.setDefaultNavigationTimeout(15000);
        page.on('pageerror', error => errors.push(error.message));
        const waitReady = () => page.waitForFunction(() => document.getElementById('partidos-lista')?.getAttribute('aria-busy') === 'false', null, { timeout: 15000 });
        const go = async (query = 'liga=lmb&fecha=2026-07-01') => { await page.goto(`${base}/pages/contenido/partidos.html?${query}`); await waitReady(); };
        let snapshot;
        await check('real LMB schedule loads as a guest, with 20 teams and local logos', async () => {
            const response = await context.request.get(`${backend}/api/v1/matches?league=lmb&date=2026-07-01`);
            assert.equal(response.status(), 200);
            snapshot = await response.json();
            await go();
            assert.ok(snapshot.games.length > 0);
            assert.equal(await page.locator('.partido-card').count(), snapshot.games.length);
            assert.equal(await page.locator('#partidos-equipo option').count(), 21);
            await page.locator('.partido-logo img').first().scrollIntoViewIfNeeded();
            await page.waitForFunction(() => [...document.querySelectorAll('.partido-logo img')].some(img => img.complete && img.naturalWidth > 0));
            assert.ok((await page.locator('.partido-logo img').first().getAttribute('src')).startsWith(base));
        });
        await check('mobile and desktop layout fit from 320px to 1440px', async () => {
            for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [1440, 1000], [844, 390]]) {
                await page.setViewportSize({ width, height });
                await page.evaluate(() => scrollTo(0, 0));
                assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${width}: no horizontal overflow`);
                const controls = await page.locator('.partidos-controles').boundingBox();
                assert.ok(controls.x >= 0 && controls.x + controls.width <= width);
                assert.ok(await page.locator('[data-league=lmb]').evaluate(element => element.offsetHeight >= 44));
                const select = await page.locator('#partidos-equipo').boundingBox();
                const chevron = await page.locator('.partidos-equipo-chevron').boundingBox();
                assert.ok(Math.abs(chevron.y + chevron.height / 2 - select.y - select.height / 2) < 1, `${width}: centered select icon`);
                assert.ok(Math.abs(select.x + select.width - chevron.x - chevron.width - 16) < 1, `${width}: select icon has a 16px inset`);
                assert.equal(await page.locator('#partidos-equipo').evaluate(element => getComputedStyle(element).appearance), 'none');
                await page.waitForFunction(() => [...document.querySelectorAll('#partidos-app .lucide-icon')].every(svg => svg.getBBox().width > 0));
                if ([390, 1440].includes(width)) {
                    await page.screenshot({ path: path.join(output, `partidos-${width}-inicio.png`) });
                    await page.locator('.partidos-results-heading').evaluate(element => element.scrollIntoView({ block: 'start' }));
                    await page.screenshot({ path: path.join(output, `partidos-${width}-resultados.png`) });
                }
            }
            await page.setViewportSize({ width: 390, height: 844 });
        });
        await check('team and status filters combine, clear, and survive reload', async () => {
            const id = snapshot.games[0].away.team.id;
            await page.selectOption('#partidos-equipo', String(id));
            const expected = snapshot.games.filter(game => [game.home.team.id, game.away.team.id].includes(id));
            assert.equal(await page.locator('.partido-card').count(), expected.length);
            await page.locator('button[data-status=scheduled]').click();
            assert.ok(await page.locator('.partidos-empty').isVisible());
            await page.reload(); await waitReady();
            assert.equal(await page.locator('#partidos-equipo').inputValue(), String(id));
            assert.equal(await page.locator('button[data-status=scheduled]').getAttribute('aria-pressed'), 'true');
            await page.locator('[data-action=clear]').click();
            assert.equal(await page.locator('.partido-card').count(), snapshot.games.length);
        });
        await check('LMP loads, date controls work and an empty day stays honest', async () => {
            await page.locator('[data-league=lmp]').click(); await waitReady();
            await page.locator('#partidos-fecha').fill('2026-11-07');
            await page.locator('#partidos-fecha').dispatchEvent('change'); await waitReady();
            assert.ok(await page.locator('.partido-card').count() > 0);
            assert.equal(await page.locator('#partidos-equipo option').count(), 11);
            await page.locator('#partidos-siguiente').click(); await waitReady();
            assert.equal(await page.locator('#partidos-fecha').inputValue(), '2026-11-08');
            await page.locator('#partidos-anterior').click(); await waitReady();
            assert.equal(await page.locator('#partidos-fecha').inputValue(), '2026-11-07');
            await page.locator('[data-league=lmb]').click(); await waitReady();
            assert.equal(await page.locator('.partido-card').count(), 0);
            assert.match(await page.locator('.partidos-empty').textContent(), /No hay partidos/);
        });
        await check('home button and menu use SPA navigation, with back and direct URLs', async () => {
            await page.goto(base);
            await page.locator('.inicio-acciones a').filter({ hasText: 'Partidos' }).click(); await waitReady();
            assert.match(page.url(), /pages\/contenido\/partidos.html/);
            await page.goBack();
            await page.waitForSelector('.inicio-acciones');
            await page.locator('#btn-abrir-menu').click();
            await page.locator('.site-menu-link').filter({ hasText: 'Partidos' }).click(); await waitReady();
            assert.equal(await page.locator('.site-header').count(), 1);
            assert.equal(await page.locator('.site-bottom-nav').count(), 1);
        });
        await check('provider errors allow retry and stale data is explicitly labelled', async () => {
            const apiPattern = '**/api/v1/matches?*';
            await page.route(apiPattern, route => route.fulfill({ status: 502, contentType: 'application/json', body: '{"detail":"Unavailable"}' }));
            await go();
            assert.match(await page.locator('.partidos-empty').textContent(), /No pudimos cargar/);
            await page.unroute(apiPattern);
            await page.locator('[data-action=retry]').click(); await waitReady();
            assert.ok(await page.locator('.partido-card').count() > 0);
            await page.route(apiPattern, route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...snapshot, stale: true }) }));
            await page.locator('#partidos-actualizar').click(); await waitReady();
            assert.match(await page.locator('#partidos-aviso').textContent(), /última jornada guardada/);
            assert.ok(await page.locator('#partidos-aviso').isVisible());
            await page.unroute(apiPattern);
        });
        await check('rapid date changes and leaving an active request never overwrite the destination', async () => {
            await page.route('**/api/v1/matches?*', async route => {
                const query = new URL(route.request().url()).searchParams;
                await new Promise(resolve => setTimeout(resolve, query.get('date') === '2026-07-02' ? 350 : 10));
                await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...snapshot, date: query.get('date'), league: query.get('league') }) }).catch(() => {});
            });
            await page.locator('#partidos-siguiente').click();
            await page.locator('#partidos-siguiente').click(); await waitReady();
            assert.equal(await page.locator('#partidos-fecha').inputValue(), '2026-07-03');
            await page.locator('#partidos-siguiente').click();
            await page.locator('.site-bottom-nav a[href$="index.html"]').click();
            await page.waitForSelector('.inicio-acciones');
            assert.equal(await page.locator('#partidos-app').count(), 0);
        });
        await check('live updates run once a minute and pause in a hidden tab', async () => {
            await page.unroute('**/api/v1/matches?*');
            await page.clock.install({ time: new Date('2026-07-01T18:00:00Z') });
            let requests = 0;
            const live = { ...snapshot, games: [{ ...snapshot.games[0], status: 'live', inning: 5, inning_half: 'Bottom' }] };
            await page.route('**/api/v1/matches?*', route => {
                requests++;
                return route.fulfill({ contentType: 'application/json', body: JSON.stringify(live) });
            });
            await go();
            assert.equal(await page.locator('.partido-status').textContent(), 'En juego');
            assert.equal(await page.locator('.partido-inning').textContent(), 'Baja 5');
            const initial = requests;
            await page.clock.fastForward(60001); await waitReady();
            assert.equal(requests, initial + 1);
            await page.evaluate(() => Object.defineProperty(document, 'hidden', { configurable: true, value: true }));
            await page.clock.fastForward(60001);
            assert.equal(requests, initial + 1);
            await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
            await waitReady();
            assert.equal(requests, initial + 2);
        });
        assert.deepEqual(errors, []);
        await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ checks, errors, backend, base }, null, 2));
        console.log(`PASS: ${checks.length} browser checks; screenshots: ${output}`);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
