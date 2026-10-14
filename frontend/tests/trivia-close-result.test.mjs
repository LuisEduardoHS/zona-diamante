import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const asModule = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const reducer = asModule(await readFile(new URL('../public/js/features/trivia/trivia-state.js', import.meta.url), 'utf8'));
let source = await readFile(new URL('../public/js/features/trivia/trivia-page.js', import.meta.url), 'utf8');
source = source.replace(
    /^import .*trivia-client.js';/m,
    'const getDailyTriviaStatus = async () => globalThis.triviaFixture; const startDailyTrivia = async () => globalThis.triviaAttempt; const saveDailyTriviaAnswer = async () => ({ saved: true }); const submitDailyTrivia = async () => globalThis.triviaResult;'
);
source = source.replace(/^import .*rutas.js';/m, "const RUTAS = { coleccion: '/coleccion' }; const ruta = value => value;");
source = source.replace("'./trivia-state.js'", JSON.stringify(reducer));
const { iniciarTrivia } = await import(asModule(source));
const nextTurn = () => new Promise(resolve => setTimeout(resolve, 0));

test('cerrar resultados vuelve a la portada bloqueada y conserva el cierre al regresar', async () => {
    const result = { attempt_id: 'hoy', correct_count: 3, total_questions: 5, points_earned: 30, next_available_at: new Date(Date.now() + 3600000).toISOString() };
    globalThis.triviaFixture = { status: 'completed', last_result: result };
    let click;
    let focused = false;
    const output = { textContent: '' };
    const view = { innerHTML: '', setAttribute() {}, querySelector() { return null; }, addEventListener(type, callback) { if (type === 'click') click = callback; } };
    const app = { setAttribute() {}, scrollTop: 0 };
    globalThis.document = { addEventListener() {}, getElementById(id) { return ({ 'trivia-view': view, 'trivia-app': app, 'trivia-countdown': output, 'trivia-title': { focus() { focused = true; } } })[id]; } };
    let controller = new AbortController();
    try {
        iniciarTrivia(controller.signal);
        await nextTurn();
        assert.match(view.innerHTML, /id="close-trivia-result"/);
        await click({ target: { closest(selector) { return selector === '#close-trivia-result'; } } });
        assert.match(view.innerHTML, /trivia-cover/);
        assert.match(view.innerHTML, /Próxima trivia en/);
        assert.doesNotMatch(view.innerHTML, /id="start-trivia"|id="close-trivia-result"/);
        assert.match(output.textContent, /^\d{2}:\d{2}:\d{2}$/);
        assert.ok(focused);
        controller.abort();
        controller = new AbortController();
        iniciarTrivia(controller.signal);
        await nextTurn();
        assert.match(view.innerHTML, /Próxima trivia en/);
        controller.abort();
        controller = new AbortController();
        globalThis.triviaFixture = { status: 'completed', last_result: { ...result, attempt_id: 'mañana' } };
        iniciarTrivia(controller.signal);
        await nextTurn();
        assert.match(view.innerHTML, /id="close-trivia-result"/);
    } finally { controller.abort(); }
});

test('actualiza calendario, mes y reto al cruzar medianoche sin recargar', async () => {
    const OriginalDate = Date;
    let now = new OriginalDate(2026, 9, 31, 23, 59, 59).getTime();
    globalThis.Date = class extends OriginalDate {
        constructor(...args) { super(...(args.length ? args : [now])); }
        static now() { return now; }
    };
    const view = { innerHTML: '', setAttribute() {}, querySelector() { return null; }, addEventListener() {} };
    let visibilityChanged;
    globalThis.document = {
        addEventListener(type, callback) { if (type === 'visibilitychange') visibilityChanged = callback; },
        getElementById(id) { return id === 'trivia-view' ? view : null; }
    };
    globalThis.triviaFixture = { status: 'available' };
    const controller = new AbortController();
    try {
        iniciarTrivia(controller.signal);
        await nextTurn();
        assert.match(view.innerHTML, /<p>octubre<\/p>/);
        assert.match(view.innerHTML, /datetime="2026-10-31" aria-current="date"/);
        now = new OriginalDate(2026, 10, 1, 0, 0, 1).getTime();
        await new Promise(resolve => setTimeout(resolve, 1100));
        assert.match(view.innerHTML, /<p>noviembre<\/p>/);
        assert.match(view.innerHTML, /datetime="2026-11-01" aria-current="date"/);
        assert.match(view.innerHTML, /datetime="2026-10-29"/);
        assert.match(view.innerHTML, /datetime="2026-11-04"/);
        now = new OriginalDate(2027, 0, 1).getTime();
        visibilityChanged();
        await nextTurn();
        assert.match(view.innerHTML, /<p>enero<\/p>/);
        assert.match(view.innerHTML, /datetime="2027-01-01" aria-current="date"/);
        assert.match(view.innerHTML, /id="start-trivia"/);
        controller.abort();
        const html = view.innerHTML;
        now += 86400000;
        visibilityChanged();
        assert.equal(view.innerHTML, html);
    } finally { controller.abort(); globalThis.Date = OriginalDate; }
});
