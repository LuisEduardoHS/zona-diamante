import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';

const source = await readFile(new URL('../public/js/calidad-camara.js', import.meta.url), 'utf8');
const { solicitarCamara, configurarCalidadCamara } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('solicita Full HD trasera como preferencia y acepta la resolución del dispositivo', async () => {
    let restricciones;
    const flujo = { getVideoTracks: () => [{}] };
    const resultado = await solicitarCamara({ getUserMedia: async args => { restricciones = args; return flujo; } });
    assert.equal(resultado, flujo);
    assert.equal(restricciones.audio, false);
    assert.deepEqual(restricciones.video.width, { ideal: 1920 });
    assert.deepEqual(restricciones.video.height, { ideal: 1080 });
    assert.deepEqual(restricciones.video.facingMode, { ideal: 'environment' });
});

test('recupera un rechazo de resolución sin imponer requisitos de tamaño', async () => {
    const peticiones = [];
    const flujo = { getVideoTracks: () => [] };
    const resultado = await solicitarCamara({ getUserMedia: async args => {
        peticiones.push(args);
        if (peticiones.length === 1) throw new DOMException('Resolución', 'OverconstrainedError');
        return flujo;
    } });
    assert.equal(resultado, flujo);
    assert.deepEqual(peticiones[1], { audio: false, video: { facingMode: 'environment' } });
});

test('no reintenta si el usuario rechaza el permiso', async () => {
    let solicitudes = 0;
    await assert.rejects(solicitarCamara({ getUserMedia: async () => {
        solicitudes++;
        throw new DOMException('Permiso denegado', 'NotAllowedError');
    } }), { name: 'NotAllowedError' });
    assert.equal(solicitudes, 1);
});

test('aplica autoenfoque disponible y conserva el video si ese ajuste falla', async () => {
    let ajustes;
    const flujo = { getVideoTracks: () => [{
        getCapabilities: () => ({ focusMode: ['manual', 'continuous'] }),
        applyConstraints: async args => { ajustes = args; throw new Error('No admitido'); }
    }] };
    assert.equal(await solicitarCamara({ getUserMedia: async () => flujo }), flujo);
    assert.deepEqual(ajustes, { advanced: [{ focusMode: 'continuous' }] });
});

function simular(t) {
    const video = {
        attrs: {}, handlers: {}, style: {}, isConnected: true,
        videoWidth: 1080, videoHeight: 1920,
        setAttribute(key, value) { this.attrs[key] = value; },
        addEventListener(key, fn) { this.handlers[key] = fn; }
    };
    let detenida = false;
    const flujo = { getVideoTracks: () => [], getTracks: () => [{ stop() { detenida = true; } }] };
    for (const [key, value] of Object.entries({
        document: { createElement: () => video },
        navigator: { mediaDevices: { getUserMedia: async () => flujo } }
    })) {
        const anterior = Object.getOwnPropertyDescriptor(globalThis, key);
        Object.defineProperty(globalThis, key, { configurable: true, value });
        t.after(() => anterior ? Object.defineProperty(globalThis, key, anterior) : delete globalThis[key]);
    }
    const sistema = {
        container: { appendChild() {} },
        el: { emit() {} },
        _startAR: async () => { assert.equal(video.attrs.width, 1080); assert.equal(video.attrs.height, 1920); }
    };
    return { sistema, video, flujo, detenida: () => detenida };
}

test('inicia MindAR con las dimensiones reales del video, también en vertical', async t => {
    const e = simular(t);
    configurarCalidadCamara(e.sistema);
    e.sistema._startVideo();
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(e.video.srcObject, e.flujo);
    assert.equal(e.video.muted, true);
    await e.video.handlers.loadedmetadata();
    assert.equal(e.detenida(), false);
});

test('libera la cámara si su elemento desaparece mientras se solicita permiso', async t => {
    const e = simular(t);
    configurarCalidadCamara(e.sistema);
    e.sistema._startVideo();
    e.video.isConnected = false;
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(e.detenida(), true);
    assert.equal(e.video.srcObject, undefined);
});
