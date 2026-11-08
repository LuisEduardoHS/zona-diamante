// Real public schedules verify league IDs; browser fixtures cover days without
// pending games, unpublished schedules, races, errors and automatic refresh.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const base = process.env.MATCHES_FRONTEND || 'http://127.0.0.1:5500';
const backend = process.env.MATCHES_BACKEND || 'http://127.0.0.1:8000';

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Tokyo', reducedMotion: 'reduce' });
        await context.route('**/js/app/runtime-config.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const runtimeConfig={BACKEND_API_URL:'${backend}'};` }));
        await context.route('**/js/features/auth/supabase-provider.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const proveedorSupabase=Object.fromEntries(['iniciarSesion','crearCuenta','solicitarRestablecimiento','restablecerContrasena','actualizarPerfil','cerrarSesion'].map(name=>[name,async()=>{throw Error('Read-only review')}]).concat([['obtenerPerfil',async()=>({user:null,profile:null})],['observarSesion',fn=>{fn({user:null,profile:null,cargando:false});return()=>{}}]]));` }));
        await context.route('**/js/services/supabase-client.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export const supabase={auth:{getSession:async()=>({data:{session:null}})}};' }));
        const page = await context.newPage(); page.setDefaultTimeout(15000);
        const errors = [], requests = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('request', request => { if (request.url().includes('/api/v1/matches')) { assert.equal(request.headers().authorization, undefined); requests.push(new URL(request.url())); } });
        await page.clock.install({ time: new Date('2026-11-08T18:00:00Z') });
        const ready = () => page.waitForFunction(() => document.querySelector('[data-equipo-calendar=juegos]')?.getAttribute('aria-busy') === 'false');
        const go = async (slug = 'charros-jal', query = '') => { await page.goto(`${base}/pages/equipos/equipo.html?id=${slug}${query}`); await ready(); };
        const league = value => page.locator(`[data-calendar-league=${value}]`);
        const date = () => page.locator('[data-equipo-calendar=fecha]').inputValue();
        const games = () => page.locator('.equipo-calendar .partido-card');
        const empty = () => page.locator('[data-equipo-calendar=juegos]').textContent();
        const nextResponse = await context.request.get(`${backend}/api/v1/matches/next?league=lmp&team_id=674&date=2026-11-08`);
        assert.equal(nextResponse.status(), 200);
        const winter = await nextResponse.json();
        assert.ok(winter.games.length);
        await go();
        assert.equal(await league('lmp').getAttribute('aria-pressed'), 'true');
        assert.deepEqual(await games().evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-labelledby'))), winter.games.map(game => `partido-${game.id}`));
        console.log('PASS: Charros defaults to LMP in winter and uses its real league ID');

        const summerResponse = await context.request.get(`${backend}/api/v1/matches?league=lmb&date=2026-07-01`);
        const summer = await summerResponse.json();
        let todayPending = false, unpublished = false, fail = false, stale = false, delay = false;
        await page.route('**/api/v1/matches/next?*', async route => {
            const query = new URL(route.request().url()).searchParams;
            const selected = query.get('league'), id = Number(query.get('team_id')), from = query.get('date');
            if (delay && selected === 'lmb') await new Promise(resolve => setTimeout(resolve, 350));
            if (fail) return route.fulfill({ status: 502, contentType: 'application/json', body: '{"detail":"Unavailable"}' }).catch(() => {});
            const source = selected === 'lmp' ? winter : summer;
            const day = todayPending || unpublished ? from : selected === 'lmp' ? '2026-11-10' : '2026-11-12';
            const participating = source.teams.some(team => team.id === id);
            const matching = source.games.filter(game => [game.away.team.id, game.home.team.id].includes(id));
            const result = { ...source, league: selected, date: day, from_date: from, team_id: id, participating, stale,
                games: unpublished ? [] : matching.map(game => ({ ...game, status: 'scheduled', date: day, starts_at: `${day}T23:00:00Z` })) };
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify(result) }).catch(() => {});
        });
        await page.route('**/api/v1/matches?*', route => {
            const query = new URL(route.request().url()).searchParams;
            const source = query.get('league') === 'lmp' ? winter : summer;
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ...source, date: query.get('date'), games: [] }) });
        });
        await go();
        assert.equal(await date(), '2026-11-10');
        assert.equal(await page.locator('[data-equipo-calendar=modo]').textContent(), 'Próximo partido');
        assert.ok(await games().count());
        let link = new URL(await page.locator('[data-equipo-calendar=completo]').getAttribute('href'));
        assert.equal(link.searchParams.get('fecha'), '2026-11-10');
        assert.equal(link.searchParams.get('equipo'), '674');
        await league('lmb').click(); await ready();
        assert.equal(await date(), '2026-11-12');
        assert.equal(await games().count(), summer.games.filter(game => [game.away.team.id, game.home.team.id].includes(6304)).length);
        assert.equal(requests.at(-1).searchParams.get('team_id'), '6304');
        assert.equal(requests.at(-1).searchParams.get('date'), '2026-11-08');
        link = new URL(await page.locator('[data-equipo-calendar=completo]').getAttribute('href'));
        assert.equal(link.searchParams.get('liga'), 'lmb'); assert.equal(link.searchParams.get('equipo'), '6304');
        assert.equal(new URL(page.url()).searchParams.get('fecha'), '2026-11-08');
        await page.reload(); await ready(); assert.equal(await date(), '2026-11-12');
        console.log('PASS: nearest pending day, doubleheaders, league-specific IDs, links and reload');

        const count = requests.length;
        await page.clock.fastForward(60001); await ready();
        assert.equal(requests.length, count + 1);
        assert.equal(requests.at(-1).searchParams.get('date'), '2026-11-08');
        assert.equal(await date(), '2026-11-12');
        todayPending = true;
        await page.locator('[data-equipo-calendar=hoy]').click(); await ready();
        assert.equal(await date(), '2026-11-08');
        await page.locator('[data-equipo-calendar=fecha]').fill('2026-11-05');
        await page.locator('[data-equipo-calendar=fecha]').dispatchEvent('change'); await ready();
        assert.equal(await date(), '2026-11-05'); assert.equal(await games().count(), 0);
        assert.equal(requests.at(-1).pathname, '/api/v1/matches');
        console.log('PASS: pending today takes priority; future polling starts from today; manual dates stay selected');

        todayPending = false; unpublished = true;
        await page.locator('[data-equipo-calendar=hoy]').click(); await ready();
        assert.match(await empty(), /no hay próximos partidos/);
        assert.equal(await date(), '2026-11-08');
        unpublished = false; fail = true;
        await go(); assert.ok(await page.locator('[data-calendar-action=retry]').isVisible());
        fail = false; stale = true;
        await page.locator('[data-calendar-action=retry]').click(); await ready();
        assert.ok(await games().count());
        assert.match(await page.locator('[data-equipo-calendar=aviso]').textContent(), /últimos datos guardados/);
        stale = false;
        delay = true;
        await league('lmb').click(); await league('lmp').click(); await ready();
        await page.waitForTimeout(400);
        assert.equal(await league('lmp').getAttribute('aria-pressed'), 'true');
        assert.equal(await date(), '2026-11-10');
        assert.match(await games().first().textContent(), /Charros/);
        console.log('PASS: unpublished schedule, retry, stale data and rapid league changes');

        for (const slug of ['dorados-chi', 'algodoneros-ul', 'sultanes-mty']) {
            await go(slug, '&liga=lmp');
            assert.equal(await league('lmp').getAttribute('aria-pressed'), 'true');
            assert.equal(await games().count(), 0); assert.match(await empty(), /no participa en LMP/);
            assert.equal(new URL(await page.locator('[data-equipo-calendar=completo]').getAttribute('href')).searchParams.get('equipo'), null);
        }
        console.log('PASS: unavailable league shows an honest message without another club’s games');
        await go();
        for (const width of [320, 390, 1440]) {
            await page.setViewportSize({ width, height: 900 });
            await page.locator('.equipo-calendar').evaluate(node => window.scrollTo(0, window.scrollY + node.getBoundingClientRect().top - 90));
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.screenshot({ path: path.resolve(__dirname, `../../.tmp/team-calendar-review/ligas-${width}.png`) });
        }
        assert.deepEqual(errors, []);
        console.log('PASS: 320/390/1440px layouts, timezone, public requests and no browser errors');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
