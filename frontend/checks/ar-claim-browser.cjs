// Camera/recognition and account API are explicit browser-only fixtures.
// Actual HTML, GLBs, A-Frame, photo/editor modules and navigation are used.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.MATCHES_FRONTEND || 'http://127.0.0.1:5500';
const slugs = ['algodoneros-ul', 'charros-jal', 'dorados-chi', 'sultanes-mty'];

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
    const output = path.resolve(__dirname, '../../.tmp/ar-claim-review');
    await fs.mkdir(output, { recursive: true });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'no-preference' });
        await context.route('**/js/app/runtime-config.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const runtimeConfig={BACKEND_API_URL:'${base}'};` }));
        await context.route('**/js/features/auth/supabase-provider.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const proveedorSupabase=Object.fromEntries(['iniciarSesion','crearCuenta','solicitarRestablecimiento','restablecerContrasena','actualizarPerfil','cerrarSesion'].map(name=>[name,async()=>{throw Error('Fixture')}]).concat([['obtenerPerfil',async()=>({user:null,profile:null})],['observarSesion',fn=>{fn({user:null,profile:null,cargando:false});return()=>{}}]]));` }));
        await context.route('**/js/services/supabase-client.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'browser-fixture'}}})}};` }));
        await context.route('**/pages/ar/ar-vista.html*', async route => {
            const response = await route.fetch();
            const html = (await response.text()).replace('../../vendor/mindar-image-aframe.prod.js', '/__ar-fixture.js')
                .replace(/mindar-image="[^"]*"/g, '').replace(/mindar-image-target="[^"]*"/g, '');
            await route.fulfill({ response, body: html });
        });
        await context.route('**/__ar-fixture.js', route => fs.readFile(path.join(__dirname, 'ar-fixture.js'), 'utf8').then(body => route.fulfill({ contentType: 'text/javascript', body })));
        let owned = new Set(), guest = false, fail = false, delay = 0, claims = [];
        const mascot = slug => ({ team_slug: slug, card_id: slugs.indexOf(slug) + 1, card_name: 'Mascota', is_owned: owned.has(slug), status: owned.has(slug) ? 'owned' : 'claimable', browser_claim_enabled: true });
        await context.route('**/api/v1/ar/**', async route => {
            if (guest) return route.fulfill({ status: 401, contentType: 'application/json', body: '{"detail":"Sign in"}' });
            if (route.request().method() === 'GET') return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ mascots: slugs.map(mascot) }) });
            const body = route.request().postDataJSON(); claims.push(body);
            assert.deepEqual(Object.keys(body), ['team_slug']);
            if (delay) await new Promise(resolve => setTimeout(resolve, delay));
            if (fail) return route.fulfill({ status: 502, contentType: 'application/json', body: '{"detail":"Unavailable"}' });
            const already_owned = owned.has(body.team_slug); owned.add(body.team_slug);
            await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ mascot: mascot(body.team_slug), already_owned, already_processed: already_owned }) });
        });
        const page = await context.newPage(); page.setDefaultTimeout(20000);
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        let frame;
        const go = async () => {
            await page.goto(`${base}/pages/experiencias/camara.html`);
            await page.waitForSelector('#ar-frame');
            await page.waitForFunction(() => document.querySelector('#ar-frame')?.contentDocument?.querySelector('#ar-status')?.textContent.includes('Apunta'));
            frame = page.frames().find(candidate => candidate.url().includes('/pages/ar/ar-vista.html'));
        };
        const detect = async index => {
            await frame.evaluate(index => document.getElementById(`target-${index}`).emit('targetFound'), index);
            await frame.waitForFunction(() => !document.getElementById('btn-reclamar-ar').disabled);
        };
        const button = () => frame.locator('#btn-reclamar-ar');
        await go(); await detect(1);
        assert.equal(await frame.locator('#ar-equipo-panel').count(), 0);
        assert.doesNotMatch(await frame.locator('#ar-result').textContent(), /Objeto detectado/i);
        assert.equal(await frame.locator('dialog[open]').count(), 0);
        assert.ok(await frame.locator('#ar-equipo-inspector').isHidden());
        assert.match(await frame.locator('#ar-equipo-aviso').textContent(), /Conoce a Charros/);
        assert.match(await frame.locator('#ar-equipo-aviso').getAttribute('href'), /equipo.html\?id=charros-jal$/);
        assert.ok(await frame.locator('.ar-confeti i').count());
        assert.equal(await frame.locator('.ar-confeti').evaluate(node => getComputedStyle(node).pointerEvents), 'none');
        await frame.waitForTimeout(200);
        assert.ok((await frame.locator('#ar-equipo-aviso').boundingBox()).height <= 48);
        assert.ok((await frame.locator('#ar-result').boundingBox()).height <= 124);
        await page.screenshot({ path: path.join(output, 'detectado-confeti.png') });
        delay = 250;
        await button().click(); assert.ok(await button().isDisabled());
        await frame.evaluate(() => document.getElementById('btn-reclamar-ar').click());
        await button().waitFor({ state: 'hidden' });
        assert.equal(claims.length, 1); assert.equal(claims[0].team_slug, 'charros-jal');
        const full = await frame.locator('#btn-inspeccionar').boundingBox();
        const row = await frame.locator('#btn-inspeccionar').locator('..').boundingBox();
        assert.ok(Math.abs(full.width - row.width) < 1);
        console.log('PASS: detection notice, confetti, no information modal, one claim and full-width Ver 3D');

        await go(); await detect(1); assert.ok(await button().isHidden());
        await detect(0); delay = 400;
        await button().click(); await detect(2);
        await frame.waitForTimeout(450);
        assert.ok(await button().isVisible()); assert.match(await frame.locator('#ar-equipo-aviso').textContent(), /Dorados/);
        await detect(0); assert.ok(await button().isHidden());
        console.log('PASS: ownership survives reload; delayed claim never changes another team');

        delay = 0; fail = true;
        await detect(2); await button().click();
        await frame.waitForFunction(() => document.getElementById('ar-carta-status').textContent.includes('No pudimos confirmar'));
        assert.ok(await button().isVisible()); assert.ok(await button().isEnabled());
        fail = false; await button().click(); await button().waitFor({ state: 'hidden' });
        console.log('PASS: failed claims stay unowned and can be retried');

        await frame.waitForFunction(() => !document.getElementById('btn-inspeccionar').disabled);
        await frame.locator('#btn-inspeccionar').click();
        await frame.locator('#foto-controles').waitFor({ state: 'visible' });
        assert.ok(await frame.locator('#ar-equipo-inspector').isVisible());
        await frame.locator('#btn-tomar-foto').click();
        await frame.locator('#foto-preview[open]').waitFor();
        assert.equal(await frame.locator('dialog[open]').count(), 1);
        await frame.locator('#btn-editar-foto').click(); await frame.locator('#foto-editor').waitFor({ state: 'visible' });
        await frame.locator('#foto-editar-cancelar').click();
        await frame.locator('#btn-cerrar-foto').click(); await frame.locator('#btn-confirmar-descarte').click();
        await frame.locator('#btn-cerrar-inspector').click();
        console.log('PASS: real model inspector, capture and photo editor still work');

        guest = true; await go(); await detect(3);
        assert.ok(await frame.locator('#ar-carta-login').isVisible());
        await button().click();
        await frame.waitForFunction(() => document.getElementById('ar-carta-status').textContent.includes('Inicia sesión'));
        assert.ok(await button().isVisible());
        assert.match(await frame.locator('#ar-carta-status').textContent(), /Inicia sesión/);
        assert.match(await frame.locator('#ar-carta-login').getAttribute('href'), /pages\/auth\/login.html$/);
        await page.setViewportSize({ width: 320, height: 568 });
        const guestNotice = await frame.locator('#ar-equipo-aviso').boundingBox();
        const guestCard = await frame.locator('#ar-result').boundingBox();
        assert.ok(guestNotice.y + guestNotice.height <= guestCard.y, JSON.stringify({ guestNotice, guestCard }));
        await page.setViewportSize({ width: 390, height: 844 });
        console.log('PASS: guest can scan and open team information; claiming requires sign-in');

        guest = false;
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await go(); await detect(1); assert.equal(await frame.locator('.ar-confeti').count(), 0);
        for (const [width, height] of [[320, 568], [390, 844], [844, 390], [1440, 1000]]) {
            await page.setViewportSize({ width, height });
            const notice = await frame.locator('#ar-equipo-aviso').boundingBox();
            const card = await frame.locator('#ar-result').boundingBox();
            const nav = await page.locator('.site-bottom-nav').boundingBox();
            await page.screenshot({ path: path.join(output, `escaner-${width}.png`) });
            assert.ok(card.x >= 0 && card.x + card.width <= width && card.y + card.height <= nav.y + 1, JSON.stringify({ width, height, notice, card, nav }));
            assert.ok(notice.x + notice.width <= card.x || card.x + card.width <= notice.x || notice.y + notice.height <= card.y || card.y + card.height <= notice.y);
        }
        console.log('PASS: reduced motion and portrait/landscape/desktop layout');
        await frame.locator('#ar-equipo-aviso').click();
        await page.waitForURL('**/pages/equipos/equipo.html?id=charros-jal');
        await page.locator('#equipo-calendario').waitFor();
        assert.equal(await page.locator('#ar-frame').count(), 0);
        assert.equal(await page.evaluate(() => sessionStorage.getItem('ar-fixture-stopped')), 'true');
        assert.deepEqual(errors, []);
        console.log('PASS: notice opens the actual team page and releases camera resources');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
