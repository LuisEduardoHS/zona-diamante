// Desplazamientos relativos al encuadre; giros en grados. No modifica el GLB.
export const POSE_REPOSO = Object.freeze({ x: 0, y: 0, z: 0, sx: 1, sy: 1, sz: 1, rx: 0, ry: 0, rz: 0 });
export const ENTRADAS_MODELO = {
    caida: {
        nombre: 'Caída con rebote', duracion: 1350,
        pasos: [
            { t: 0, y: .95, rx: -12, ry: -12 },
            { t: .38, y: -.035, sx: 1.06, sy: .90, sz: 1.06, rx: 4, curva: 'acelerar' },
            { t: .62, y: .18, sx: .98, sy: 1.04, sz: .98, rz: -4, curva: 'frenar' },
            { t: .80, y: 0, sx: 1.03, sy: .96, sz: 1.03, curva: 'acelerar' },
            { t: .91, y: .035, curva: 'frenar' },
            { t: 1, curva: 'suave' }
        ]
    },
    rodada: {
        nombre: 'Llegada rodando', duracion: 1250,
        pasos: [
            { t: 0, x: -.95, rz: -300, ry: -18 },
            { t: .72, x: .045, rz: 12, ry: 4, curva: 'frenar' },
            { t: .88, x: -.012, rz: -4, curva: 'suave' },
            { t: 1, curva: 'suave' }
        ]
    },
    acercamiento: {
        nombre: 'Acercamiento', duracion: 1150,
        pasos: [
            { t: 0, z: -1.5, ry: -32 },
            { t: .70, sx: 1.06, sy: 1.06, sz: 1.06, ry: 8, curva: 'frenar' },
            { t: .86, sx: .98, sy: .98, sz: .98, ry: -3, curva: 'suave' },
            { t: 1, curva: 'suave' }
        ]
    },
    saltos: {
        nombre: 'Llegada a saltos', duracion: 1500,
        pasos: [
            { t: 0, x: .72, rz: 12, sx: .85, sy: .85, sz: .85 },
            { t: .24, x: .45, y: .25, rz: -10, sx: .92, sy: .92, sz: .92, curva: 'frenar' },
            { t: .43, x: .27, sx: 1.02, sy: .92, sz: 1.02, curva: 'acelerar' },
            { t: .62, x: .14, y: .15, rz: 8, curva: 'frenar' },
            { t: .78, sx: 1.06, sy: .93, sz: 1.06, curva: 'acelerar' },
            { t: .90, x: -.015, y: .045, rz: -2, curva: 'frenar' },
            { t: 1, curva: 'suave' }
        ]
    }
};

const curvas = {
    acelerar: t => t * t,
    frenar: t => 1 - (1 - t) ** 3,
    suave: t => t * t * (3 - 2 * t)
};

export function muestrearEntrada(tipo, progreso) {
    const { pasos } = ENTRADAS_MODELO[tipo];
    const t = Math.max(0, Math.min(1, progreso));
    if (t === 1) return { ...POSE_REPOSO };
    const indice = pasos.findIndex(paso => paso.t > t);
    const desde = pasos[indice - 1];
    const hasta = pasos[indice];
    const mezcla = (curvas[hasta.curva] || curvas.suave)((t - desde.t) / (hasta.t - desde.t));
    return Object.fromEntries(Object.entries(POSE_REPOSO).map(([key, neutro]) => {
        const a = desde[key] ?? neutro;
        const b = hasta[key] ?? neutro;
        return [key, a + (b - a) * mezcla];
    }));
}

export function crearEntradaModelo({
    aplicar, alTerminar,
    aleatorio = () => Math.random(),
    reducirMovimiento = () => matchMedia('(prefers-reduced-motion: reduce)').matches,
    ahora = () => performance.now(),
    solicitarFrame = callback => requestAnimationFrame(callback),
    cancelarFrame = id => cancelAnimationFrame(id)
}) {
    let activa = false;
    let anterior = null;
    let frame = null;
    let version = 0;

    const detener = (notificar) => {
        if (!activa) return;
        activa = false;
        ++version;
        if (frame !== null) cancelarFrame(frame);
        frame = null;
        // Estado final exacto: no quedan rebotes, escalas ni giros acumulados.
        aplicar({ ...POSE_REPOSO });
        if (notificar) alTerminar();
    };

    return {
        get activa() { return activa; },
        iniciar() {
            detener(false);
            const opciones = Object.keys(ENTRADAS_MODELO).filter(tipo => tipo !== anterior);
            const tipo = opciones[Math.min(opciones.length - 1, Math.floor(aleatorio() * opciones.length))];
            anterior = tipo;
            activa = true;
            const turno = ++version;
            if (reducirMovimiento()) {
                detener(true);
                return tipo;
            }
            const inicio = ahora();
            aplicar(muestrearEntrada(tipo, 0));
            const avanzar = tiempo => {
                if (!activa || turno !== version) return;
                const progreso = (tiempo - inicio) / ENTRADAS_MODELO[tipo].duracion;
                if (progreso >= 1) { detener(true); return; }
                aplicar(muestrearEntrada(tipo, progreso));
                frame = solicitarFrame(avanzar);
            };
            frame = solicitarFrame(avanzar);
            return tipo;
        },
        terminar() { detener(true); },
        cancelar() { detener(false); }
    };
}
