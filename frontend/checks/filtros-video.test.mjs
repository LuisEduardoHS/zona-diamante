import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../public/js/features/equipos/filtros-video.js', import.meta.url), 'utf8');
const { FILTROS_VIDEO, AJUSTES_VIDEO, normalizarVideo, filtroCSSVideo, temperaturaVideo } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('el original no altera el video y los tres nuevos estilos son distintos', () => {
    assert.equal(filtroCSSVideo(), 'none');
    assert.equal(FILTROS_VIDEO.original.css, 'none');
    const values = ['naranja', 'pastel', 'sobresaturado'].map(filtro => filtroCSSVideo({ filtro }));
    assert.equal(new Set(values).size, 3);
    assert.ok(values.every(value => value !== 'none'));
    assert.equal(FILTROS_VIDEO.naranja.nombre, 'Naranja');
    assert.equal(FILTROS_VIDEO.pastel.nombre, 'Pastel');
    assert.equal(FILTROS_VIDEO.sobresaturado.nombre, 'Sobresaturado');
});
test('intensidad cero elimina solo el predefinido y conserva los ajustes manuales', () => {
    for (const filtro of Object.keys(FILTROS_VIDEO)) assert.equal(filtroCSSVideo({ filtro, intensidad: 0 }), 'none');
    assert.equal(filtroCSSVideo({ filtro: 'naranja', intensidad: 0, brillo: 20 }), filtroCSSVideo({ brillo: 20 }));
    assert.notEqual(filtroCSSVideo({ filtro: 'pastel', intensidad: 25 }), filtroCSSVideo({ filtro: 'pastel', intensidad: 100 }));
});
test('los ajustes se combinan sin modificar ni acumular sobre el estado anterior', () => {
    const state = { ...AJUSTES_VIDEO, filtro: 'pastel', brillo: 20, contraste: 10, saturacion: 30, temperatura: 40 };
    const copy = { ...state }, css = filtroCSSVideo(state);
    assert.match(css, /brightness\(1.2\)/);
    assert.match(css, /contrast\(1.1\)/);
    assert.match(css, /saturate\(1.3\)/);
    assert.ok(temperaturaVideo(state.temperatura).opacidad > 0);
    assert.equal(filtroCSSVideo(state), css);
    assert.deepEqual(state, copy);
    assert.equal(filtroCSSVideo(AJUSTES_VIDEO), 'none');
});
test('la temperatura es transparente en cero y combina tintes cálidos y fríos con intensidad acotada', () => {
    assert.equal(temperaturaVideo().opacidad, 0);
    const warm = temperaturaVideo(100), cool = temperaturaVideo(-100);
    assert.equal(warm.color, '#ff914b'); assert.equal(cool.color, '#4696ff');
    assert.equal(warm.opacidad, cool.opacidad);
    assert.ok(warm.opacidad > temperaturaVideo(50).opacidad);
    assert.deepEqual(temperaturaVideo(999), warm);
});
test('valida límites y rechaza datos no numéricos o filtros desconocidos', () => {
    assert.deepEqual(normalizarVideo({ filtro: 'unknown', intensidad: 900, brillo: -900, contraste: '30', saturacion: NaN, temperatura: Infinity }),
        { filtro: 'original', intensidad: 100, brillo: -100, contraste: 30, saturacion: 0, temperatura: 0 });
    assert.equal(normalizarVideo({ filtro: '__proto__' }).filtro, 'original');
    assert.doesNotMatch(filtroCSSVideo({ brillo: Infinity, contraste: NaN, saturacion: 'bad', temperatura: {} }), /NaN|Infinity|undefined/);
    assert.equal(temperaturaVideo('bad').opacidad, 0);
});
