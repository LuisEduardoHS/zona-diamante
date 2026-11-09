// Layout fixtures only; real Supabase email delivery separately checks Go rendering.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const escape = value => value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

(async () => {
    const folder = path.join(root, 'supabase/templates/auth');
    const rows = JSON.parse(await fs.readFile(path.join(folder, 'manifest.json'), 'utf8'));
    const output = path.join(root, '.tmp/auth-email/review'); await fs.mkdir(output, { recursive: true });
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        const page = await browser.newPage();
        const fixture = { ConfirmationURL: 'https://example.invalid/auth/v1/verify?token='+'a'.repeat(64)+'&type=recovery&redirect_to=https%3A%2F%2Fzona-diamante.pages.dev%2Fpages%2Fauth%2Frestablecer.html',
            Token:'12345678',Email:'aficionado@example.invalid',NewEmail:'nuevo@example.invalid',OldEmail:'anterior@example.invalid',
            Phone:'+520000000000',OldPhone:'+520000000001',Provider:'Google',FactorType:'totp' };
        for (const row of rows) {
            const original = await fs.readFile(path.join(folder, row.file), 'utf8');
            for (const width of [320, 600]) {
                const greeting = width === 320 ? 'NombreLargo'.repeat(5) : 'Luis Eduardo';
                let html = original.replace(/{{ if \.Data\.display_name }}Hola, {{ \.Data\.display_name }}\.{{ else }}Hola\.{{ end }}/g, 'Hola, '+escape(greeting)+'.');
                html = html.replace(/{{ \.(\w+) }}/g, (_, name) => escape(fixture[name] || ''));
                assert.equal(html.includes('{{'), false, 'Fixture must replace all template markers: '+row.name);
                await page.setViewportSize({ width, height: 900 }); await page.setContent(html);
                assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${row.name} overflows ${width}`);
                assert.equal(await page.locator('h1').count(), 1);
                if (width === 320 || ['confirmation','recovery','password_changed'].includes(row.name)) {
                    await page.screenshot({ path: path.join(output, `${row.name}-${width}.png`), fullPage: true });
                }
                if (row.section === 'template' && row.name !== 'reauthentication') {
                    assert.equal(await page.locator('a').first().getAttribute('href'), fixture.ConfirmationURL);
                }
            }
        }
        console.log('PASS: all 13 authentication/security email layouts at 320px and 600px, long names, preserved confirmation URLs');
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
