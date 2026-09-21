import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (await readFile(new URL('../public/js/datos-equipos.js', import.meta.url), 'utf8'))
    .replace("import { ruta } from './rutas.js';", "const ruta = path => new URL(path, 'https://ejemplo.test/zona/').href;");
let version = 0;
const modulo = () => import(`data:text/javascript;base64,${Buffer.from(source + `\n// ${version++}`).toString('base64')}`);

test('comparte peticiones concurrentes y resuelve imágenes desde la raíz del proyecto', async t => {
    let peticiones = 0;
    t.mock.method(globalThis, 'fetch', async url => {
        ++peticiones;
        assert.equal(url, 'https://ejemplo.test/zona/data/equipos.json');
        return { ok: true, json: async () => [{ id: 'sultanes', imagenes: { logoFondo: './assets/img/logo.webp' } }] };
    });
    const { obtenerEquipos } = await modulo();
    const [uno, dos] = await Promise.all([obtenerEquipos(), obtenerEquipos()]);
    assert.strictEqual(uno, dos);
    assert.equal(uno[0].imagenes.logoFondo, 'https://ejemplo.test/zona/assets/img/logo.webp');
    assert.strictEqual(await obtenerEquipos(), uno);
    assert.equal(peticiones, 1);
});

test('un error de red no queda guardado: la siguiente visita puede recuperarse', async t => {
    let peticiones = 0;
    t.mock.method(globalThis, 'fetch', async () => {
        if (++peticiones === 1) return { ok: false };
        return { ok: true, json: async () => [] };
    });
    const { obtenerEquipos } = await modulo();
    await assert.rejects(obtenerEquipos());
    assert.deepEqual(await obtenerEquipos(), []);
    assert.equal(peticiones, 2);
});
