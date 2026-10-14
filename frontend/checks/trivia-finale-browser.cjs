// Run with Playwright available in NODE_PATH and the public frontend on port 5500.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true });
    try {
        for (const [score, width, height, reducedMotion] of [[5, 390, 844, 'no-preference'], [4, 320, 568, 'reduce'], [3, 390, 844, 'no-preference'], [2, 320, 568, 'reduce'], [1, 390, 844, 'no-preference'], [0, 900, 700, 'no-preference']]) {
            const page = await browser.newPage({ viewport: { width, height }, reducedMotion });
            const errors = [];
            page.on('pageerror', error => errors.push(error.message));
            await page.route('**/js/app/main.js*', route => route.fulfill({ contentType: 'text/javascript', body: `import { iniciarTrivia } from '/js/features/trivia/trivia-page.js'; window.controller = new AbortController(); iniciarTrivia(controller.signal);` }));
            await page.route('**/js/api/trivia-client.js', route => route.fulfill({ contentType: 'text/javascript', body: `
                export const getDailyTriviaStatus = async () => ({status:'available'});
                export const startDailyTrivia = async () => ({ questions: Array.from({length:5}, (_,i) => ({id:'q'+i,text:'¿Cuántas entradas tiene un juego de béisbol?', options:[{id:'a',text:'Nueve'},{id:'b',text:'Cinco'},{id:'c',text:'Siete'},{id:'d',text:'Diez'}]})) });
                export const saveDailyTriviaAnswer = async () => ({});
                export const submitDailyTrivia = async () => ({attempt_id:'test',correct_count:${score}, total_questions:5,points_earned:${score * 10},points_balance:1230,next_available_at:new Date(Date.now()+3600000).toISOString()});
            ` }));
            await page.goto('http://localhost:5500/pages/experiencias/trivia.html');
            await page.locator('#start-trivia').click();
            for (let i = 0; i < 5; i++) await page.locator('[data-option-id="a"]').click();
            await page.locator('#confirm-submit').click();
            await page.locator('.is-reward').waitFor();
            assert.equal(await page.locator('.trivia-celebration-art').count(), score >= 2 ? 1 : 0);
            if (score >= 2) assert.match(await page.locator('.trivia-celebration-art').getAttribute('src'), score >= 4 ? /PTrivia-PanchoP.webp$/ : /PTrivia-Pollo.webp$/);
            await page.waitForTimeout(1100);
            assert.equal(await page.locator('.trivia-reward-pill [data-count]').textContent(), String(score * 10));
            if (score >= 2) assert.ok(await page.locator('.trivia-celebration-art').evaluate(img => img.complete && img.naturalWidth > 0));
            const directory = path.join(__dirname, '../../.tmp/trivia-finale');
            await fs.mkdir(directory, { recursive: true });
            await page.screenshot({ path: path.join(directory, `reward-${score}.png`) });
            await page.locator('#close-trivia-result').click();
            await page.locator('.is-summary').waitFor();
            await page.waitForTimeout(1100);
            assert.match(await page.locator('.trivia-summary').textContent(), /1230/);
            assert.match(await page.locator('#trivia-countdown').textContent(), /\d{2}:\d{2}:\d{2}/);
            const card = await page.locator('.trivia-summary').boundingBox();
            const toast = await page.locator('.trivia-reward-toast').boundingBox();
            assert.ok(toast.y + toast.height <= card.y, 'reward notification does not overlap statistics');
            assert.ok(card.x >= 0 && card.x + card.width <= width && card.y >= 0 && card.y + card.height <= height);
            await page.screenshot({ path: path.join(directory, `summary-${score}.png`) });
            await page.keyboard.press('Enter');
            await page.locator('.trivia-next-challenge').waitFor();
            assert.equal(await page.locator('#trivia-finale').count(), 0);
            assert.equal(await page.locator('#start-trivia').count(), 0);
            assert.deepEqual(errors, []);
            console.log(`PASS score=${score}, ${width}x${height}, motion=${reducedMotion}`);
            await page.close();
        }
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
