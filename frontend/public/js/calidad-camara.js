export async function solicitarCamara(mediaDevices = navigator.mediaDevices) {
    let flujo;
    try {
        flujo = await mediaDevices.getUserMedia({
            audio: false,
            video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 }
            }
        });
    } catch (error) {
        // Conserva compatibilidad sin volver a solicitar permisos si se denegaron.
        if (error.name !== 'OverconstrainedError') throw error;
        flujo = await mediaDevices.getUserMedia({ audio: false, video: { facingMode: 'environment' } });
    }

    const track = flujo.getVideoTracks()[0];
    try {
        if (track?.getCapabilities?.().focusMode?.includes('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
        }
    } catch {
        // Algunos teléfonos anuncian enfoque configurable, pero no permiten cambiarlo.
    }
    return flujo;
}

// Adaptador para la versión local de MindAR. Negocia la resolución ANTES de
// construir su controlador, cuyas dimensiones de entrada permanecen fijas.
export function configurarCalidadCamara(sistemaAR) {
    sistemaAR._startVideo = function () {
        const video = document.createElement('video');
        video.setAttribute('autoplay', '');
        video.setAttribute('muted', '');
        video.setAttribute('playsinline', '');
        video.muted = true;
        video.style.cssText = 'position:absolute;top:0;left:0;z-index:-2;';
        this.video = video;
        this.container.appendChild(video);

        solicitarCamara().then((flujo) => {
            if (!video.isConnected || this.video !== video) {
                flujo.getTracks().forEach((track) => track.stop());
                return;
            }
            video.addEventListener('loadedmetadata', async () => {
                video.setAttribute('width', video.videoWidth);
                video.setAttribute('height', video.videoHeight);
                try {
                    await this._startAR();
                } catch (error) {
                    flujo.getTracks().forEach((track) => track.stop());
                    this.el.emit('arError', { error });
                }
            }, { once: true });
            video.srcObject = flujo;
        }).catch((error) => {
            this.el.emit('arError', { error });
        });
    };
}
