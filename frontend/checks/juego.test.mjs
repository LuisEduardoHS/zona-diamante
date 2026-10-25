import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../public/js/features/juego/ganar_juego.js', import.meta.url), 'utf8');
const { crearEstadoJuego, iniciarJuego } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function pantalla() {
    const pausa = new EventTarget();
    const attrs = {};
    pausa.setAttribute = (key, value) => { attrs[key] = value; };
    const campo = new EventTarget();
    campo.querySelector = () => pausa;
    const clases = new Set(['activo']);
    const resultado = { classList: { remove: c => clases.delete(c), add: c => clases.add(c) } };
    globalThis.document = { getElementById: id => ({ pantallaJuego: campo, resultadoOverlay: resultado })[id] };
    return { campo, pausa, attrs, clases };
}

test('inicio activo, pausa y reanudación conservan la misma partida', () => {
    const game = crearEstadoJuego();
    assert.equal(game.estado, 'active');
    game.reanudar();
    game.pausar();
    game.pausar();
    assert.equal(game.estado, 'paused');
    game.reanudar();
    assert.equal(game.estado, 'active');
});

test('abandonar es terminal e idempotente; una nueva partida comienza limpia', () => {
    const game = crearEstadoJuego();
    game.pausar();
    game.abandonar();
    game.abandonar();
    game.reanudar();
    game.pausar();
    assert.equal(game.estado, 'abandoned');
    assert.equal(crearEstadoJuego().estado, 'active');
});

test('pausa y clics del campo no anuncian victoria ni cartas', () => {
    const ui = pantalla();
    const abort = new AbortController();
    const game = iniciarJuego(abort.signal);
    assert.equal(ui.clases.has('activo'), false);
    ui.pausa.dispatchEvent(new Event('click'));
    assert.equal(game.estado, 'paused');
    assert.equal(ui.attrs['aria-label'], 'Reanudar');
    ui.campo.dispatchEvent(new Event('click'));
    assert.equal(ui.clases.has('activo'), false);
    ui.pausa.dispatchEvent(new Event('click'));
    assert.equal(game.estado, 'active');
    assert.equal(ui.attrs['aria-label'], 'Pausar');
    assert.equal(ui.clases.has('activo'), false);
    abort.abort();
});

test('montaje repetido no duplica listeners ni crea otra partida al reanudar', () => {
    const ui = pantalla();
    const abort = new AbortController();
    const game = iniciarJuego(abort.signal);
    assert.equal(iniciarJuego(abort.signal), game);
    ui.pausa.dispatchEvent(new Event('click'));
    assert.equal(game.estado, 'paused');
    abort.abort();
});

test('salir abandona, cancela acciones y volver reinicia sin resultado anterior', () => {
    const ui = pantalla();
    const abort = new AbortController();
    const first = iniciarJuego(abort.signal);
    abort.abort();
    ui.pausa.dispatchEvent(new Event('click'));
    assert.equal(first.estado, 'abandoned');
    ui.clases.add('activo');
    const secondAbort = new AbortController();
    const second = iniciarJuego(secondAbort.signal);
    assert.notEqual(first, second);
    assert.equal(second.estado, 'active');
    assert.equal(ui.clases.has('activo'), false);
    secondAbort.abort();
});

test('montajes ausentes o cancelados no instalan una partida', () => {
    pantalla();
    const abort = new AbortController();
    abort.abort();
    assert.equal(iniciarJuego(abort.signal), null);
    globalThis.document = { getElementById: () => null };
    assert.equal(iniciarJuego(new AbortController().signal), null);
});
