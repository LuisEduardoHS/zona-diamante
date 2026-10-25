// This screen is still a prototype: a tap is not evidence of a victory.
const partidas = new WeakMap();

export function crearEstadoJuego() {
    let estado = 'active';
    return {
        get estado() { return estado; },
        pausar() {
            if (estado === 'active') estado = 'paused';
        },
        reanudar() {
            if (estado === 'paused') estado = 'active';
        },
        abandonar() { estado = 'abandoned'; },
    };
}

export function iniciarJuego(signal) {
    const pantalla = document.getElementById('pantallaJuego');
    if (!pantalla || signal?.aborted) return null;
    const anterior = partidas.get(pantalla);
    if (anterior && anterior.estado !== 'abandoned') return anterior;

    const partida = crearEstadoJuego();
    partidas.set(pantalla, partida);
    // Never retain the static demo result when mounting/revisiting the screen.
    document.getElementById('resultadoOverlay')?.classList.remove('activo');
    const pausa = pantalla.querySelector('.pause-button');
    const actualizarPausa = () => {
        pausa?.setAttribute('aria-label', partida.estado === 'paused' ? 'Reanudar' : 'Pausar');
        pausa?.setAttribute('aria-pressed', String(partida.estado === 'paused'));
    };
    actualizarPausa();
    pausa?.addEventListener('click', (event) => {
        event.stopPropagation();
        if (partida.estado === 'active') partida.pausar();
        else partida.reanudar();
        actualizarPausa();
    }, { signal });
    signal?.addEventListener('abort', () => partida.abandonar(), { once: true });
    return partida;
}
