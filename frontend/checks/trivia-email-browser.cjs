// Real profile controller + HTML email, with explicit API/account fixtures.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const base = process.env.MATCHES_FRONTEND || 'http://127.0.0.1:5500';

(async () => {
    const output = path.resolve(__dirname, '../../.tmp/trivia-email/review');
    await fs.mkdir(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        await context.route('**/js/app/runtime-config.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const runtimeConfig={BACKEND_API_URL:'${base}'};` }));
        await context.route('**/js/features/auth/supabase-provider.js', route => route.fulfill({ contentType: 'text/javascript', body: `const state={cargando:false,user:{id:'email-browser',email:'luis@example.invalid'},profile:{username:'luis',display_name:'Luis',points_balance:0}};export const proveedorSupabase=Object.fromEntries(['iniciarSesion','crearCuenta','solicitarRestablecimiento','restablecerContrasena','actualizarPerfil','cerrarSesion'].map(name=>[name,async()=>{throw Error('Fixture only')}]).concat([['obtenerPerfil',async()=>state],['observarSesion',fn=>{fn(state);return()=>{}}]]));` }));
        await context.route('**/js/services/supabase-client.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const supabase={auth:{getSession:async()=>({data:{session:{access_token:'browser-fixture'}}})}};` }));
        let enabled = false, fail = false, patches = 0;
        await context.route('**/api/v1/email/preferences', async route => {
            if (route.request().method() === 'PATCH') {
                patches++;
                if (fail) return route.fulfill({ status: 503, contentType: 'application/json', body: '{"detail":"Simulated failure"}' });
                enabled = route.request().postDataJSON().trivia_email_enabled;
            }
            return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ trivia_email_enabled: enabled }) });
        });
        const page = await context.newPage(), errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(base + '/pages/auth/perfil.html');
        const form = page.locator('#perfil-avisos-form'), input = form.locator('input'), status = form.locator('[role="status"]');
        await input.waitFor(); await page.waitForFunction(() => !document.querySelector('#perfil-avisos-form input').disabled);
        assert.equal(await input.isChecked(), false);
        assert.equal(await form.locator('button').isDisabled(), true);
        assert.equal(patches, 0);
        await form.dispatchEvent('submit');
        assert.equal(patches, 0, 'Opening or saving an unchanged profile cannot opt in');
        await input.check(); await form.locator('button').click();
        await status.filter({ hasText: 'activados.' }).waitFor();
        assert.equal(enabled, true); assert.equal(patches, 1);
        fail = true; await input.uncheck(); await form.locator('button').click();
        await status.filter({ hasText: 'anterior se conserva' }).waitFor();
        assert.equal(await input.isChecked(), true); assert.equal(enabled, true);
        await form.scrollIntoViewIfNeeded();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        await page.screenshot({ path: path.join(output, 'profile-390.png') });
        assert.deepEqual(errors, []);
        console.log('PASS profile preferences: load, save, server failure restores prior value; no browser errors');
        const preview = await context.newPage();
        await preview.goto(pathToFileURL(path.resolve(__dirname, '../../.tmp/trivia-email/preview.html')).href);
        for (const width of [320, 600]) {
            await preview.setViewportSize({ width, height: 900 });
            assert.equal(await preview.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
            assert.equal(await preview.locator('h1').textContent(), 'Trivia disponible');
            await preview.screenshot({ path: path.join(output, `email-${width}.png`), fullPage: true });
        }
        console.log('PASS personalized email preview: 320px and 600px, no horizontal overflow');
        await context.close();
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
