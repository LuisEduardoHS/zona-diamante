import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const source = (await readFile(new URL('../public/js/services/datos-equipos.js', import.meta.url), 'utf8')).replace("import { ruta } from '../app/rutas.js';", "const ruta = path => new URL(path, 'https://test.local/app/').href;");
const service = await import(moduleURL(source));
let pageSource = await readFile(new URL('../public/js/features/equipos/equipo.js', import.meta.url), 'utf8');
pageSource = pageSource.replace(/^import.*$/mg, '') + '\n';
pageSource = "const ruta = p => p; const RUTAS = { inicio: 'index.html', coleccion: 'coleccion' };\n" + pageSource;
const { detalleTemplate, fuenteVideo, FILTROS_VIDEO, iniciarRevelado } = await import(moduleURL(pageSource));
const rows = JSON.parse(await readFile(new URL('../public/data/equipos.json', import.meta.url), 'utf8'));
const teams = rows.map(service.normalizarEquipo);

test('las cuatro fichas mantienen el orden, rival, galería y video de cada equipo', async () => {
    for (const team of teams) {
        const output = detalleTemplate(team, teams);
        let position = -1;
        for (const cls of ['equipo-overview', 'equipo-statistics', 'equipo-stadium', 'equipo-mascot', 'equipo-honours', 'equipo-mvp', 'equipo-calendar equipo-card', 'equipo-gallery', 'equipo-video-title']) {
            const next = output.indexOf(cls);
            assert.ok(next > position, `${team.nombre}: ${cls}`); position = next;
        }
        assert.match(output, /Por confirmar/);
        assert.equal(team.detalles.galeria.length, 5);
        assert.ok(fuenteVideo(team.detalles.video));
        for (const url of [...Object.values(team.imagenes), ...team.detalles.galeria.map(x => x.imagen)]) {
            await access(new URL('../public/' + new URL(url).pathname.replace('/app/', ''), import.meta.url));
        }
    }
});

test('adapta public.teams sin cambiar los slugs usados por el carrusel', () => {
    const row = rows[0];
    const actual = service.normalizarEquipo({ id: 99, slug: row.id, name: row.nombre, city: row.ciudad, colors: row.colores, zone: row.detalles.zona, history: row.detalles.historia, details: { ...row.detalles, imagenes: row.imagenes } });
    assert.deepEqual(actual, teams[0]);
    assert.doesNotMatch(actual.detalles.historia, /<span/);
});

test('escapa contenido y rechaza esquemas y estilos no permitidos', () => {
    const team = service.normalizarEquipo({ id: 'x', nombre: '<script>alert(1)</script>', colores: { primario: 'red;display:none' }, detalles: { historia: '<img onerror=alert(1)>Hola', galeria: [{ imagen: 'javascript:alert(1)' }] } });
    assert.equal(team.colores.primario, '#005C6C');
    assert.equal(team.detalles.galeria.length, 0);
    const output = detalleTemplate(team, []);
    assert.doesNotMatch(output, /<script>|onerror=/);
    assert.match(output, /&lt;script&gt;/);
    assert.equal(fuenteVideo({ tipo: 'youtube', id: 'x" onload="' }), '');
    assert.equal(fuenteVideo({ tipo: 'archivo', src: 'javascript:alert(1)' }), '');
    assert.equal(FILTROS_VIDEO.original.css, 'none');
});

test('muestra fechas con hora CDMX y admite listas vacías', () => {
    const team = structuredClone(teams[0]);
    team.detalles.calendario = [{ oponente: 'Dorados', inicio: '2026-10-11T01:00:00Z' }];
    assert.match(detalleTemplate(team, teams), /10 de octubre/);
    assert.match(detalleTemplate(team, teams), /CDMX/);
    team.detalles.calendario = [];
    assert.match(detalleTemplate(team, teams), /Aún no hay juegos programados/);
});

test('el proveedor comparte la carga, cambia de origen y se recupera de errores', async () => {
    let count = 0;
    service.configurarProveedorEquipos(async () => { count++; return rows; });
    const [one, two] = await Promise.all([service.obtenerEquipos(), service.obtenerEquipos()]);
    assert.strictEqual(one, two); assert.equal(count, 1);
    service.configurarProveedorEquipos(async () => [{ ...rows[0], is_active: false }, rows[1]]);
    assert.equal((await service.obtenerEquipos()).length, 1);
    let attempts = 0;
    service.configurarProveedorEquipos(async () => { if (++attempts === 1) throw new Error('offline'); return rows; });
    await assert.rejects(service.obtenerEquipos(), /offline/);
    assert.equal((await service.obtenerEquipos()).length, 4);
});


test('las galerías usan 20 fotos locales diferentes con fuente y sin repetir las tarjetas', async () => {
    const images = new Set();
    for (const team of teams) {
        const used = [team.detalles.estadio.imagen, team.detalles.mascota.imagen, team.detalles.mvp.imagen, ...Object.values(team.imagenes)];
        for (const photo of team.detalles.galeria) {
            assert.ok(photo.fuente.startsWith('https://'));
            assert.ok(photo.credito);
            assert.ok(!used.includes(photo.imagen));
            const bytes = await readFile(new URL('../public/' + new URL(photo.imagen).pathname.replace('/app/', ''), import.meta.url));
            const encoded = bytes.toString('base64');
            assert.ok(!images.has(encoded), 'No debe repetirse la misma fotografía');
            images.add(encoded);
        }
    }
    assert.equal(images.size, 20);
});

test('revela una sola vez, cancela al salir y respeta movimiento reducido', async t => {
    const oldWindow = globalThis.window;
    const oldObserver = globalThis.IntersectionObserver;
    t.after(() => { globalThis.window = oldWindow; globalThis.IntersectionObserver = oldObserver; });
    let callback, observed = 0, disconnected = 0, animated = 0, canceled = 0, reduced = false, motionChange;
    globalThis.window = { matchMedia: () => ({ matches: reduced, addEventListener: (_, fn) => { motionChange = fn; }, removeEventListener: () => {} }) };
    globalThis.IntersectionObserver = class {
        constructor(fn) { callback = fn; }
        observe() { observed++; }
        unobserve() { observed--; }
        disconnect() { disconnected++; }
    };
    const element = { animate: () => { animated++; return { finished: new Promise(() => {}), cancel: () => canceled++ }; } };
    const container = { querySelectorAll: () => [element] };
    const controller = new AbortController();
    iniciarRevelado(container, controller.signal);
    assert.equal(observed, 1);
    callback([{ target: element, isIntersecting: false }]);
    assert.equal(animated, 0);
    callback([{ target: element, isIntersecting: true }]);
    assert.equal(observed, 0);
    assert.equal(animated, 1);
    controller.abort();
    assert.equal(disconnected, 1);
    assert.equal(canceled, 1);
    callback([{ target: element, isIntersecting: true }]);
    assert.equal(animated, 1);
    reduced = true;
    iniciarRevelado(container);
    assert.equal(observed, 0);
    reduced = false;
    iniciarRevelado(container);
    motionChange({ matches: true });
    assert.equal(disconnected, 2);
});
