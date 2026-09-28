export function iniciarJuego(signal) {
    const pantalla = document.getElementById('pantallaJuego');
    const resultado = document.getElementById('resultadoOverlay');
    pantalla?.addEventListener('click', () => resultado.classList.add('activo'), { once: true, signal });
}
