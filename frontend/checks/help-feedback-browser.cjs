// Real Help controller and backend client; only identity/API are explicit fixtures.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.MATCHES_FRONTEND || 'http://127.0.0.1:4190';

(async () => {
    const output = path.resolve(__dirname, '../../.tmp/help-feedback/review');
    await fs.mkdir(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        await context.route('**/js/app/runtime-config.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const runtimeConfig={BACKEND_API_URL:'${base}'};` }));
        await context.route('**/js/features/auth/supabase-provider.js', route => route.fulfill({ contentType: 'text/javascript', body: `const state={cargando:false,user:null,profile:null};export const proveedorSupabase=Object.fromEntries(['iniciarSesion','crearCuenta','solicitarRestablecimiento','restablecerContrasena','actualizarPerfil','cerrarSesion'].map(name=>[name,async()=>{throw Error('Fixture only')}]).concat([['obtenerPerfil',async()=>state],['observarSesion',fn=>{fn(state);return()=>{}}]]));` }));
        await context.route('**/js/services/supabase-client.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const supabase={auth:{getSession:async()=>({data:{session:window.__guest?null:{access_token:'browser-fixture'}}})}};` }));
        let mode = 'failure'; const requests = [];
        await context.route('**/api/v1/help/feedback', async route => {
            requests.push(route.request().postDataJSON());
            await new Promise(resolve => setTimeout(resolve, 200));
            const status = mode === 'failure' ? 503 : mode === 'limit' ? 429 : 202;
            return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(status === 202
                ? { id: '0f99e3ab-11cc-4bd2-885a-1f3bd91f177d', status: 'received' }
                : { detail: status === 429 ? 'Ya enviaste varios mensajes. Intenta más tarde.' : 'Simulated storage failure' }) });
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + '/pages/contenido/Ayuda.html');
        const form = page.locator('#ayuda-formulario'), text = page.locator('#ayuda-mensaje');
        const status = page.locator('#ayuda-confirmacion'), button = form.locator('button[type="submit"]');
        await form.scrollIntoViewIfNeeded();
        await page.locator('#ayuda-tipo').selectOption('suggestion');
        await page.locator('#ayuda-contacto').fill('contacto@ejemplo.mx');
        await text.fill('Esta es una sugerencia para mejorar el juego.');
        await button.click();
        assert.equal(await button.isDisabled(), true);
        await status.filter({ hasText: 'Tu texto se conserva' }).waitFor();
        assert.equal(await text.inputValue(), 'Esta es una sugerencia para mejorar el juego.');
        assert.equal(requests.length, 1);
        mode = 'success'; await button.click();
        await status.filter({ hasText: 'Recibimos tu mensaje' }).waitFor();
        assert.equal(requests.length, 2);
        assert.equal(requests[0].request_id, requests[1].request_id, 'Retry must not create duplicate messages');
        assert.equal(requests[0].reason, 'suggestion');
        assert.equal(requests[0].contact, 'contacto@ejemplo.mx');
        assert.equal(await text.inputValue(), '');
        await text.fill('Otro mensaje con una pregunta diferente.');
        mode = 'limit'; await button.click();
        await status.filter({ hasText: 'Ya enviaste varios mensajes' }).waitFor();
        assert.notEqual(requests[1].request_id, requests[2].request_id);
        assert.notEqual(await text.inputValue(), '');
        await page.evaluate(() => { window.__guest = true; });
        await button.click();
        await status.filter({ hasText: 'Inicia sesión con tu cuenta' }).waitFor();
        assert.equal(requests.length, 3, 'Guest must not reach the authenticated endpoint');
        assert.notEqual(await text.inputValue(), '');
        for (const width of [320, 390, 1280]) {
            await page.setViewportSize({ width, height: 844 }); await form.scrollIntoViewIfNeeded();
            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            await page.screenshot({ path: path.join(output, `help-${width}.png`) });
        }
        assert.deepEqual(errors, []);
        console.log('PASS Help: real submission, disabled controls, preserved failures, same retry ID, new-message ID, rate limit, guest state, 320/390/1280px');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
