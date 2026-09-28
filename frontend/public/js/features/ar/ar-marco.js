// Permite que las fotos cubran también la navegación persistente del documento padre.
const avisar = () => {
    if (window.parent !== window) window.parent.postMessage({
        tipo: 'ar-foto-modal', abierto: Boolean(document.querySelector('dialog[open]'))
    }, location.origin);
};
const observador = new MutationObserver(avisar);
document.querySelectorAll('dialog').forEach(dialogo => observador.observe(dialogo, { attributes: true, attributeFilter: ['open'] }));
window.addEventListener('pagehide', () => {
    document.querySelectorAll('video').forEach(video => video.srcObject?.getTracks().forEach(track => track.stop()));
});
