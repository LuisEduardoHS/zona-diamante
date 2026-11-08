// Run checks/site-review-server.cjs first. Synthetic guest/account, no external writes.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const base = process.env.SITE_REVIEW_URL || 'http://127.0.0.1:4195';

(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    const errors = [];
    let checked = 0;
    try {
        for (const reducedMotion of ['no-preference', 'reduce']) {
            for (const authenticated of [false, true]) {
                const page = await browser.newPage({ reducedMotion });
                page.setDefaultTimeout(10000);
                page.on('pageerror', error => errors.push(error.message));
                for (const [width, height] of [[320, 740], [390, 844], [844, 390], [1440, 900]]) {
                    await page.setViewportSize({ width, height });
                    await page.goto(`${base}/index.html${authenticated ? '?session' : ''}`);
                    await page.waitForSelector(authenticated ? '.shell-account-avatar' : '.shell-brand svg');
                    const positions = await page.evaluate(async () => {
                        const account = document.querySelector('.shell-brand');
                        const avatar = account.firstElementChild;
                        const button = document.getElementById('btn-abrir-menu');
                        const menu = document.getElementById('menu-overlay');
                        const position = () => {
                            const { x, y, width, height } = account.getBoundingClientRect();
                            return { x, y, width, height };
                        };
                        const before = position(), samples = [];
                        async function watchAnimation() {
                            for (let frame = 0; frame < 90; frame++) {
                                await new Promise(requestAnimationFrame);
                                samples.push(position());
                                if (!menu.getAnimations().some(animation => animation.playState === 'running')) {
                                    // Include the microtask that returns the button to the header.
                                    await new Promise(requestAnimationFrame);
                                    samples.push(position());
                                    return;
                                }
                            }
                            throw new Error('Menu animation did not finish');
                        }
                        for (let cycle = 0; cycle < 2; cycle++) {
                            button.click();
                            await watchAnimation();
                            if (!menu.open || !menu.contains(button)) throw new Error('Menu lost its close control');
                            button.click();
                            await watchAnimation();
                            if (menu.open || !document.querySelector('.site-header').contains(button)) throw new Error('Close did not restore the menu button');
                        }
                        return { before, samples, sameAccount: account === document.querySelector('.shell-brand'), sameAvatar: avatar === account.firstElementChild };
                    });
                    for (const sample of positions.samples) {
                        for (const key of ['x', 'y', 'width', 'height']) {
                            assert.ok(Math.abs(sample[key] - positions.before[key]) < 0.5,
                                `${width}px/${authenticated}/${reducedMotion}: account ${key} moved`);
                        }
                    }
                    assert.ok(positions.sameAccount && positions.sameAvatar, 'Account and avatar nodes are preserved');
                    assert.ok(Math.abs(positions.before.x + positions.before.width - (width - 24)) < 0.5, 'Account stays at the right inset');
                    await page.locator('#btn-abrir-menu').click();
                    await page.keyboard.press('Escape');
                    await page.waitForFunction(() => !document.getElementById('menu-overlay').open);
                    assert.equal(await page.locator('#btn-abrir-menu').getAttribute('aria-expanded'), 'false');
                    const afterEscape = await page.locator('.shell-brand').boundingBox();
                    assert.ok(Math.abs(afterEscape.x - positions.before.x) < 0.5, 'Escape preserves account position');
                    await page.locator('#btn-abrir-menu').click();
                    await page.locator('.site-menu-link').filter({ hasText: /^Info$/ }).click();
                    await page.waitForSelector('#historia-app');
                    await page.waitForFunction(() => !document.getElementById('menu-overlay').open);
                    const afterNavigation = await page.locator('.shell-brand').boundingBox();
                    assert.ok(Math.abs(afterNavigation.x - positions.before.x) < 0.5, 'Menu navigation preserves account position');
                    assert.equal(await page.locator('.site-header').count(), 1);
                    console.log(`PASS ${width}×${height}: ${authenticated ? 'avatar' : 'guest'}, motion=${reducedMotion}, frame positions, Escape and navigation`);
                    checked++;
                }
                await page.close();
            }
        }
        assert.deepEqual(errors, []);
        console.log(`PASS: ${checked} menu configurations; account remains fixed throughout opening and closing.`);
    } finally {
        await browser.close();
    }
})().catch(error => { console.error(error); process.exitCode = 1; });
