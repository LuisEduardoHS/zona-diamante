// Serve frontend/public on :5500. Video fixtures are restricted to this browser;
// the normal local page keeps the teams' real YouTube players.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.VIDEO_EDITOR_URL || 'http://127.0.0.1:5500';
const output = path.resolve(__dirname, '../../.tmp/video-editor-review');
const teams = ['sultanes-mty', 'dorados-chi', 'charros-jal', 'algodoneros-ul'];

(async () => {
    await fs.mkdir(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const errors = [];
    let loads = 0;
    try {
        const context = await browser.newContext({ reducedMotion: 'reduce' });
        // Public guest page: keep QA independent from account/network services.
        await context.route('**/js/features/auth/supabase-provider.js', route => route.fulfill({ contentType: 'text/javascript', body: `export const proveedorSupabase=Object.fromEntries(['iniciarSesion','crearCuenta','solicitarRestablecimiento','restablecerContrasena','actualizarPerfil','cerrarSesion'].map(name=>[name,async()=>{throw Error('Read-only review')}]).concat([['obtenerPerfil',async()=>({user:null,profile:null})],['observarSesion',fn=>{fn({user:null,profile:null,cargando:false});return()=>{}}]]));` }));
        const photo = await fs.readFile(path.resolve(__dirname, '../public/assets/img/equipos/galerias/sultanes/01.jpg'));
        const fixture = `<html><body style="margin:0;height:100vh;background:#808080 url(data:image/jpeg;base64,${photo.toString('base64')}) center/cover"><div style="position:absolute;bottom:0;width:100%;height:15%;background:linear-gradient(90deg,#808080 33%,#cc7755 33% 66%,#4477aa 66%)"></div></body></html>`;
        await context.route('https://www.youtube-nocookie.com/embed/**', route => { loads++; return route.fulfill({ contentType: 'text/html', body: fixture }); });
        const page = await context.newPage();
        page.setDefaultTimeout(12000);
        page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
        const opened = async () => {
            try {
                await page.waitForSelector('#equipo-video-dialog[open] iframe');
                await page.frameLocator('#equipo-video-stage iframe').locator('body div').waitFor();
            } catch (error) {
                await page.screenshot({ path: path.join(output, 'failure.png') });
                console.error('Page:', page.url(), (await page.locator('body').innerText()).slice(0, 600));
                throw error;
            }
        };
        const css = () => page.locator('#equipo-video-stage').evaluate(node => node.style.filter);
        const neutralPixel = async () => {
            const box = await page.locator('#equipo-video-stage').boundingBox();
            const bytes = await page.screenshot({ clip: { x: Math.floor(box.x + box.width / 6), y: Math.floor(box.y + box.height * .94), width: 1, height: 1 } });
            return page.evaluate(async bytes => {
                const image = await createImageBitmap(new Blob([new Uint8Array(bytes)], { type: 'image/png' }));
                const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
                const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); image.close();
                return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
            }, [...bytes]);
        };
        const slider = value => page.locator('#equipo-video-ajuste').evaluate((node, value) => { node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); }, value);
        const manual = async (tool, value) => { await page.locator('[data-video-tab=ajustes]').click(); await page.locator(`[data-video-tool=${tool}]`).click(); await slider(value); };
        for (const [width, height] of [[320, 740], [390, 844], [768, 1024], [1440, 900], [844, 390]]) {
            await page.setViewportSize({ width, height });
            await page.goto(`${base}/pages/equipos/equipo.html?id=${teams[0]}&video=filtros`);
            await opened();
            await page.locator('#equipo-video-dialog').evaluate(dialog => Promise.allSettled(dialog.getAnimations().map(animation => animation.finished)));
            const dialog = await page.locator('#equipo-video-dialog').boundingBox();
            assert.ok(dialog.x >= 0 && dialog.x + dialog.width <= width);
            assert.ok(dialog.y >= 0 && dialog.y + dialog.height <= height);
            assert.ok(await page.locator('#equipo-video-dialog').evaluate(node => node.scrollWidth <= node.clientWidth), `${width}: no horizontal dialog overflow`);
            assert.equal(await page.locator('[data-filter]').count(), 8);
            assert.equal(await css(), 'none');
            const startingLoads = loads;
            const frame = await page.locator('#equipo-video-stage iframe').elementHandle();
            const original = await page.locator('#equipo-video-stage').screenshot();
            for (const preset of ['naranja', 'pastel', 'sobresaturado']) {
                await page.locator(`[data-filter=${preset}]`).click();
                assert.equal(await page.locator(`[data-filter=${preset}]`).getAttribute('aria-pressed'), 'true');
                assert.notEqual(await css(), 'none');
                assert.notDeepEqual(await page.locator('#equipo-video-stage').screenshot(), original, `${preset}: visible rendered effect`);
            }
            await slider(0); assert.equal(await css(), 'none');
            await slider(65); assert.match(await css(), /saturate/);
            await manual('brillo', 25); assert.match(await css(), /brightness\(1.25\)/);
            await manual('contraste', -15); assert.match(await css(), /contrast\(0.85\)/);
            await manual('saturacion', 45); assert.match(await css(), /saturate\(1.45\)/);
            await manual('temperatura', 50); assert.ok(await page.locator('#equipo-video-stage').evaluate(node => Number(node.style.getPropertyValue('--video-temperature-opacity')) > 0));
            await page.locator('[data-video-tool=brillo]').click();
            assert.equal(await page.locator('#equipo-video-ajuste').inputValue(), '25', 'Switching tools preserves values');
            const adjusted = await css();
            await page.locator('#equipo-video-comparar').click(); assert.equal(await css(), 'none');
            await page.locator('#equipo-video-comparar').click(); assert.equal(await css(), adjusted);
            assert.equal(await frame.evaluate(node => node === document.querySelector('#equipo-video-stage iframe')), true);
            assert.equal(loads, startingLoads, 'Editing never reloads the player');
            if (width === 390 || width === 1440) await page.screenshot({ path: path.join(output, `ajustes-${width}.png`) });
            await page.locator('#equipo-video-restablecer').click(); assert.equal(await css(), 'none');
            await page.locator('[data-video-tab=filtros]').click();
            await page.locator('[data-filter=naranja]').click();
            if (width === 390 || width === 1440) await page.screenshot({ path: path.join(output, `filtros-${width}.png`) });
            await page.locator('#equipo-video-dialog [data-close-dialog]').click();
            await page.waitForFunction(() => !document.querySelector('#equipo-video-stage').childElementCount);
            await page.locator('[data-open-video=filters]').click(); await opened();
            assert.equal(await css(), 'none');
            assert.equal(await page.locator('[data-filter=original]').getAttribute('aria-pressed'), 'true');
            assert.equal(await page.locator('[data-video-tab=filtros]').getAttribute('aria-pressed'), 'true');
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => !document.getElementById('equipo-video-dialog').open);
            console.log(`PASS ${width}×${height}: presets, manual controls, comparison, reset, stable player and close/reopen`);
        }
        for (const id of teams.slice(1)) {
            await page.goto(`${base}/pages/equipos/equipo.html?id=${id}&video=filtros`);
            await opened();
            await page.locator('[data-filter=pastel]').click();
            await manual('temperatura', -50);
            assert.equal(await page.locator('#equipo-video-stage').evaluate(node => node.style.getPropertyValue('--video-temperature-color')), '#4696ff');
            await page.keyboard.press('Escape');
            await page.waitForFunction(() => !document.getElementById('equipo-video-dialog').open);
            console.log(`PASS ${id}: shared editor and cleanup`);
        }
        // Capture neutral pixels to verify that temperature changes the rendered frame.
        await page.goto(`${base}/pages/equipos/equipo.html?id=${teams[0]}&video=filtros`); await opened();
        await page.locator('#equipo-video-stage').screenshot({ path: path.join(output, 'temperatura-original.png') });
        const originalPixel = await neutralPixel();
        await manual('temperatura', 100);
        await page.locator('#equipo-video-stage').screenshot({ path: path.join(output, 'temperatura-calida.png') });
        const warmPixel = await neutralPixel();
        await slider(-100);
        await page.locator('#equipo-video-stage').screenshot({ path: path.join(output, 'temperatura-fria.png') });
        const coolPixel = await neutralPixel();
        assert.ok(warmPixel[0] > originalPixel[0] && warmPixel[2] < originalPixel[2], 'Warm temperature changes real iframe pixels');
        assert.ok(coolPixel[0] < originalPixel[0] && coolPixel[2] > originalPixel[2], 'Cool temperature changes real iframe pixels');
        console.log('PASS: rendered temperature pixels', { originalPixel, warmPixel, coolPixel });
        // Leaving with an open player destroys its browsing context and scroll lock.
        await page.evaluate(async () => { const nav = await import('/js/app/navegacion.js?v=20261108-partidos'); const link = document.createElement('a'); link.href = '/index.html'; document.body.append(link); link.click(); });
        await page.waitForSelector('.inicio-acciones');
        assert.equal(await page.locator('#equipo-video-stage').count(), 0);
        assert.equal(await page.evaluate(() => document.documentElement.classList.contains('equipo-media-open')), false);
        // Exercise the existing file-video path with a short, local recording.
        const recording = await page.evaluate(async () => {
            const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 90;
            const ctx = canvas.getContext('2d'); ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, 160, 90);
            const stream = canvas.captureStream(12), chunks = [];
            const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' });
            recorder.ondataavailable = event => chunks.push(event.data);
            const finished = new Promise(resolve => { recorder.onstop = resolve; });
            recorder.start();
            for (let frame = 0; frame < 14; frame++) {
                ctx.fillStyle = `rgb(${100 + frame}, 128, 128)`; ctx.fillRect(0, 0, 160, 90);
                await new Promise(resolve => setTimeout(resolve, 50));
            }
            recorder.stop(); await finished;
            stream.getTracks().forEach(track => track.stop());
            return [...new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer())];
        });
        await context.route('**/__video-test.webm', route => route.fulfill({ contentType: 'video/webm', body: Buffer.from(recording) }));
        await context.route('**/data/equipos.json*', async route => {
            const response = await route.fetch(), data = await response.json();
            data[0].detalles.video = { tipo: 'archivo', titulo: 'Video local de prueba', src: `${base}/__video-test.webm`, poster: data[0].detalles.video.poster };
            return route.fulfill({ response, json: data });
        });
        await page.goto(`${base}/pages/equipos/equipo.html?id=${teams[0]}&video=filtros`);
        await page.waitForFunction(() => document.querySelector('#equipo-video-stage video')?.readyState >= 2);
        await page.locator('#equipo-video-stage video').evaluate(video => { video.muted = true; return video.play(); });
        await page.waitForFunction(() => document.querySelector('#equipo-video-stage video').currentTime > .1);
        const position = await page.locator('#equipo-video-stage video').evaluate(video => { video.pause(); return video.currentTime; });
        await page.locator('[data-filter=pastel]').click(); await manual('temperatura', 50);
        assert.equal(await page.locator('#equipo-video-stage video').evaluate(video => video.currentTime), position);
        assert.equal(await page.locator('#equipo-video-stage video').evaluate(video => video.paused), true);
        await page.locator('#equipo-video-dialog [data-close-dialog]').click();
        await page.waitForFunction(() => !document.querySelector('#equipo-video-stage').childElementCount);
        console.log('PASS: native file video keeps playback position while editing and stops on close');
        assert.deepEqual(errors, []);
        console.log('PASS: all four teams, no player reloads, no browser errors; screenshots in ' + output);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
