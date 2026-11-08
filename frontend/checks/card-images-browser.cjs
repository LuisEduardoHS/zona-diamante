// Read-only check of the deployed catalog and public Storage artwork.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const base = process.env.CARD_IMAGES_FRONTEND || 'https://zona-diamante.netlify.app';

(async () => {
    const manifest = JSON.parse(await fs.readFile(path.resolve(__dirname, '../../supabase/assets/card-images/manifest.json'), 'utf8'));
    const output = path.resolve(__dirname, '../../.tmp/card-images/live-review');
    await fs.mkdir(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/pages/coleccion/coleccion.html`);
        await page.waitForFunction(() => document.querySelectorAll('#col-grid [data-card]').length === 20, null, { timeout: 45000 });
        for (const row of manifest.cards) {
            const card = page.locator(`[data-card="${row.card_id}"]`);
            await card.scrollIntoViewIfNeeded();
            await card.locator('img').evaluate(image => image.decode());
            assert.ok((await card.locator('img').getAttribute('src')).endsWith(`/card-images/${row.object_path}`), row.card_slug);
        }
        for (const [width, height] of [[320, 740], [390, 844], [1440, 1000]]) {
            await page.setViewportSize({ width, height });
            await page.locator('#col-grid').scrollIntoViewIfNeeded();
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
            await page.screenshot({ path: path.join(output, `catalogo-${width}.png`), fullPage: true });
        }
        // Detail views must use the same image, including SVG team logos and AR mascots.
        for (const id of [8, 9, 14, 15]) {
            await page.locator(`[data-card="${id}"]`).click();
            await page.locator('#col-detail[open]').waitFor();
            await page.locator('#col-detail-art img').evaluate(image => image.decode());
            assert.ok((await page.locator('#col-detail-art img').getAttribute('src')).endsWith(manifest.cards.find(row => row.card_id === id).object_path));
            await page.locator('#col-detail-close').click();
        }
        assert.deepEqual(errors, []);
        console.log('PASS: 20 real Storage images; mobile/desktop catalog and historical/mascot/team details; no browser errors');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
