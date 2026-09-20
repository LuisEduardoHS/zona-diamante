import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

const source = await readFile(new URL('../public/js/foto-ar.js', import.meta.url), 'utf8');
const { dibujarCapa, capturarFotoAR, iniciarFotoAR } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('recorta la cámara horizontal al encuadre vertical sin deformarla', () => {
    let parametros;
    const video = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 800 }) };
    dibujarCapa({ drawImage: (...args) => { parametros = args; } }, video, 1920, 1080);
    assert.deepEqual(parametros, [video, 690, 0, 540, 1080, 0, 0, 400, 800]);
});

test('conserva desplazamientos y recorta en orientación horizontal', () => {
    let parametros;
    const video = { getBoundingClientRect: () => ({ left: -20, top: 10, width: 800, height: 400 }) };
    dibujarCapa({ drawImage: (...args) => { parametros = args; } }, video, 1080, 1920);
    assert.deepEqual(parametros, [video, 0, 690, 1080, 540, -20, 10, 800, 400]);
});

class Elemento {
    handlers = {};
    disabled = false;
    open = false;
    textContent = '';
    addEventListener(evento, fn) { this.handlers[evento] = fn; }
    click() { if (!this.disabled) return this.handlers.click?.(); }
    removeAttribute(attr) { delete this[attr]; }
    remove() { this.eliminado = true; }
    focus() { this.enfocado = true; }
    showModal() { this.open = true; }
    close() { this.open = false; }
}

function entorno(t, { canShare = true } = {}) {
    const elementos = new Map();
    const get = (id) => {
        if (!elementos.has(id)) elementos.set(id, new Elemento());
        return elementos.get(id);
    };
    const llamadas = [];
    const ctx = { scale() {}, drawImage: (capa) => llamadas.push(capa === video ? 'video' : 'modelo') };
    const foto = { getContext: () => ctx, toBlob: fn => fn(new Blob(['foto'], { type: 'image/jpeg' })) };
    const enlace = new Elemento();
    const document = new Elemento();
    Object.assign(document, {
        hidden: false,
        documentElement: { clientWidth: 1440, clientHeight: 2960 },
        getElementById: get,
        createElement: tipo => tipo === 'canvas' ? foto : enlace,
        body: { appendChild() {} }
    });
    const rect = () => ({ left: 0, top: 0, width: 1440, height: 2960 });
    const video = { readyState: 4, paused: false, videoWidth: 1920, videoHeight: 1080, getBoundingClientRect: rect };
    const escena = {
        systems: { 'mindar-image-system': { video } },
        canvas: { width: 2880, height: 5920, getBoundingClientRect: rect },
        camera: {}, object3D: { updateMatrixWorld() {} },
        renderer: { getContext: () => ({ isContextLost: () => false }), render: () => llamadas.push('render') }
    };
    const revocadas = [];
    let siguienteURL = 0;
    const navigator = { canShare: () => canShare, share: async () => {} };
    const pendientes = [];
    t.mock.method(URL, 'createObjectURL', () => `blob:foto-${++siguienteURL}`);
    t.mock.method(URL, 'revokeObjectURL', url => revocadas.push(url));
    for (const [key, value] of Object.entries({ document, navigator, window: { devicePixelRatio: 3 }, setTimeout: fn => pendientes.push(fn) })) {
        const original = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { configurable: true, value });
        t.after(() => original ? Object.defineProperty(globalThis, key, original) : delete globalThis[key]);
    }
    const ui = iniciarFotoAR({ escena, puedeCapturar: () => true, obtenerEquipo: () => 'Algodoneros' });
    return { get, ui, escena, foto, video, enlace, llamadas, revocadas, pendientes, navigator, document };
}

test('renderiza antes de copiar ambas capas, exporta JPEG y limita la resolución', async t => {
    const e = entorno(t);
    const blob = await capturarFotoAR(e.escena);
    assert.equal(blob.type, 'image/jpeg');
    assert.deepEqual(e.llamadas, ['render', 'video', 'modelo']);
    assert.equal(e.foto.height, 2048);
    assert.ok(Math.abs(e.foto.width / e.foto.height - 1440 / 2960) < 0.001);
});

test('rechaza captura sin fotograma o con WebGL perdido', async t => {
    const e = entorno(t);
    e.video.readyState = 1;
    await assert.rejects(capturarFotoAR(e.escena), /cámara esté lista/);
    e.video.readyState = 4;
    e.escena.renderer.getContext = () => ({ isContextLost: () => true });
    await assert.rejects(capturarFotoAR(e.escena), /capturar el modelo/);
});

test('guardar conserva una URL independiente al descartar y permite otra captura', async t => {
    const e = entorno(t);
    e.ui.activar(true);
    await e.get('btn-tomar-foto').click();
    assert.equal(e.get('foto-preview').open, true);
    e.get('btn-guardar-foto').click();
    assert.match(e.enlace.download, /^zona-diamante-algodoneros-.*\.jpg$/);
    assert.equal(e.enlace.href, 'blob:foto-2');
    e.get('btn-cerrar-foto').click();
    assert.equal(e.get('foto-confirmar-descarte').open, true);
    e.get('btn-confirmar-descarte').click();
    assert.equal(e.get('foto-preview').open, false);
    assert.deepEqual(e.revocadas, ['blob:foto-1']);
    e.pendientes.forEach(fn => fn());
    assert.deepEqual(e.revocadas, ['blob:foto-1', 'blob:foto-2']);
    await e.get('btn-tomar-foto').click();
    assert.equal(e.get('foto-preview').open, true);
});

test('compartir envía el archivo, maneja cancelación y preserva la vista previa', async t => {
    const e = entorno(t);
    e.ui.activar(true);
    await e.get('btn-tomar-foto').click();
    e.navigator.share = async data => {
        assert.equal(data.files[0].type, 'image/jpeg');
        assert.equal(e.get('btn-cerrar-foto').disabled, true);
        throw new DOMException('Cancelado', 'AbortError');
    };
    await e.get('btn-compartir-foto').click();
    assert.equal(e.get('foto-preview').open, true);
    assert.equal(e.get('btn-guardar-foto').disabled, false);
    assert.match(e.get('foto-preview-status').textContent, /foto sigue aquí/);
});

test('ofrece descargar cuando compartir archivos no está disponible', async t => {
    const e = entorno(t, { canShare: false });
    e.ui.activar(true);
    await e.get('btn-tomar-foto').click();
    assert.equal(e.get('btn-compartir-foto').disabled, true);
    assert.equal(e.get('btn-guardar-foto').disabled, false);
    assert.match(e.get('foto-preview-status').textContent, /desde tus descargas/);
});

test('la X pide confirmar y cancelar conserva la foto; Escape también protege el descarte', async t => {
    const e = entorno(t);
    e.ui.activar(true);
    await e.get('btn-tomar-foto').click();
    const src = e.get('foto-imagen').src;
    e.get('btn-cerrar-foto').click();
    assert.equal(e.get('foto-confirmar-descarte').open, true);
    assert.equal(e.get('foto-preview').open, true);
    e.get('btn-conservar-foto').click();
    assert.equal(e.get('foto-confirmar-descarte').open, false);
    assert.equal(e.get('foto-imagen').src, src);
    assert.deepEqual(e.revocadas, []);
    e.get('foto-preview').handlers.cancel({ preventDefault() {} });
    assert.equal(e.get('foto-confirmar-descarte').open, true);
    e.get('foto-confirmar-descarte').handlers.cancel({ preventDefault() {} });
    assert.equal(e.get('foto-preview').open, true);
    assert.equal(e.get('foto-confirmar-descarte').open, false);
});

test('ignora capturas duplicadas y no abre una foto al salir del inspector', async t => {
    const e = entorno(t);
    let terminar;
    e.foto.toBlob = fn => { terminar = fn; };
    e.ui.activar(true);
    const pendiente = e.get('btn-tomar-foto').click();
    e.get('btn-tomar-foto').click();
    assert.deepEqual(e.llamadas, ['render', 'video', 'modelo']);
    e.ui.activar(false);
    terminar(new Blob(['foto']));
    await pendiente;
    assert.equal(e.get('foto-preview').open, false);
    assert.equal(e.get('foto-controles').hidden, true);
});
