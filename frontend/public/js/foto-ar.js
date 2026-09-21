// Reproduce el object-fit: cover de la cámara y de la escena en su posición visible.
export function dibujarCapa(ctx, elemento, anchoFuente, altoFuente) {
    const rect = elemento.getBoundingClientRect();
    if (!rect.width || !rect.height || !anchoFuente || !altoFuente) {
        throw new Error('La imagen de la cámara todavía no está lista. Inténtalo de nuevo.');
    }
    const escala = Math.max(rect.width / anchoFuente, rect.height / altoFuente);
    const ancho = rect.width / escala;
    const alto = rect.height / escala;
    ctx.drawImage(elemento, (anchoFuente - ancho) / 2, (altoFuente - alto) / 2,
        ancho, alto, rect.left, rect.top, rect.width, rect.height);
}

export async function capturarFotoAR(escena) {
    const video = escena.systems?.['mindar-image-system']?.video;
    const canvasAR = escena.canvas;
    const renderer = escena.renderer;
    if (!video || video.readyState < 2 || video.paused || !canvasAR || !renderer || !escena.camera) {
        throw new Error('Espera a que la cámara esté lista para tomar la foto.');
    }
    if (renderer.getContext().isContextLost()) {
        throw new Error('No se pudo capturar el modelo. Vuelve a abrir Ver 3D e inténtalo de nuevo.');
    }

    const ancho = document.documentElement.clientWidth;
    const alto = document.documentElement.clientHeight;
    // Limita la imagen a 2048 px por lado para no agotar la memoria del celular.
    const escala = Math.min(window.devicePixelRatio || 1, 2, 2048 / Math.max(ancho, alto));
    const foto = document.createElement('canvas');
    foto.width = Math.round(ancho * escala);
    foto.height = Math.round(alto * escala);
    const ctx = foto.getContext('2d');
    if (!ctx) throw new Error('Este navegador no pudo preparar la foto. Inténtalo de nuevo.');
    ctx.scale(foto.width / ancho, foto.height / alto);

    // Copia ambas capas en el mismo turno. Renderizar de nuevo evita un WebGL vacío
    // sin mantener preserveDrawingBuffer activo durante toda la experiencia AR.
    escena.object3D.updateMatrixWorld(true);
    renderer.render(escena.object3D, escena.camera);
    dibujarCapa(ctx, video, video.videoWidth, video.videoHeight);
    dibujarCapa(ctx, canvasAR, canvasAR.width, canvasAR.height);

    return new Promise((resolve, reject) => {
        foto.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('No se pudo crear la foto. Inténtalo de nuevo.'));
        }, 'image/jpeg', 0.94);
    });
}

export function iniciarFotoAR({ escena, puedeCapturar, obtenerEquipo }) {
    const controles = document.getElementById('foto-controles');
    const disparador = document.getElementById('btn-tomar-foto');
    const estadoCamara = document.getElementById('foto-camara-status');
    const dialogo = document.getElementById('foto-preview');
    const imagen = document.getElementById('foto-imagen');
    const equipoFoto = document.getElementById('foto-equipo');
    const estado = document.getElementById('foto-preview-status');
    const guardar = document.getElementById('btn-guardar-foto');
    const compartir = document.getElementById('btn-compartir-foto');
    const cerrar = document.getElementById('btn-cerrar-foto');
    const confirmacion = document.getElementById('foto-confirmar-descarte');
    const conservar = document.getElementById('btn-conservar-foto');
    const confirmarDescarte = document.getElementById('btn-confirmar-descarte');
    let activo = false;
    let capturando = false;
    let compartiendo = false;
    let archivo = null;
    let url = null;
    let version = 0;

    const admiteCompartir = () => {
        try {
            return Boolean(archivo && navigator.share && navigator.canShare?.({ files: [archivo] }));
        } catch {
            return false;
        }
    };

    const limpiarFoto = () => {
        imagen.removeAttribute('src');
        if (url) URL.revokeObjectURL(url);
        url = null;
        archivo = null;
        estado.textContent = '';
    };

    const descartarFoto = () => {
        if (compartiendo) return;
        if (confirmacion.open) confirmacion.close();
        if (dialogo.open) dialogo.close();
        limpiarFoto();
        if (activo) disparador.focus();
    };

    const solicitarDescarte = () => {
        if (!compartiendo && archivo && !confirmacion.open) confirmacion.showModal();
    };

    disparador.addEventListener('click', async () => {
        if (!activo || capturando || dialogo.open) return;
        if (!puedeCapturar()) {
            estadoCamara.textContent = 'Espera a que la cámara y el modelo estén listos.';
            return;
        }
        capturando = true;
        disparador.disabled = true;
        estadoCamara.textContent = 'Preparando tu foto…';
        const solicitud = ++version;
        const equipo = obtenerEquipo() || 'Zona Diamante';
        try {
            const blob = await capturarFotoAR(escena);
            if (solicitud !== version || !activo || document.hidden) return;
            limpiarFoto();
            const nombreEquipo = equipo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
            const fecha = new Date().toISOString().replace(/[:.]/g, '-');
            archivo = new File([blob], `zona-diamante-${nombreEquipo}-${fecha}.jpg`, { type: blob.type });
            url = URL.createObjectURL(archivo);
            imagen.src = url;
            imagen.alt = `Tu foto con el modelo 3D de ${equipo}`;
            equipoFoto.textContent = equipo;
            compartir.disabled = !admiteCompartir();
            estado.textContent = compartir.disabled
                ? 'Este navegador no permite compartir fotos directamente. Guárdala y compártela desde tus descargas.'
                : 'Puedes guardar la foto o elegir una app para compartirla.';
            dialogo.showModal();
        } catch (error) {
            if (solicitud === version && activo) {
                limpiarFoto();
                estadoCamara.textContent = error.name === 'SecurityError'
                    ? 'No se pudo capturar esta imagen. Recarga la página e inténtalo de nuevo.'
                    : error.message || 'No se pudo tomar la foto. Inténtalo de nuevo.';
            }
        } finally {
            capturando = false;
            disparador.disabled = false;
            if (estadoCamara.textContent === 'Preparando tu foto…') estadoCamara.textContent = '';
        }
    });

    guardar.addEventListener('click', () => {
        if (!archivo || compartiendo) return;
        const enlace = document.createElement('a');
        // La descarga mantiene su propia URL aunque se descarte la vista previa.
        const urlDescarga = URL.createObjectURL(archivo);
        enlace.href = urlDescarga;
        enlace.download = archivo.name;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(urlDescarga), 60000);
        estado.textContent = 'Descarga iniciada. Revisa las descargas de tu navegador. También puedes mantener pulsada la foto para ver las opciones disponibles.';
    });

    compartir.addEventListener('click', async () => {
        if (compartiendo || !admiteCompartir()) return;
        compartiendo = true;
        [guardar, compartir, cerrar].forEach((boton) => { boton.disabled = true; });
        estado.textContent = 'Elige dónde compartir tu foto…';
        try {
            // El archivo ya está preparado: conserva la activación del toque en móviles.
            await navigator.share({ files: [archivo], title: 'Mi foto AR · Zona Diamante' });
            estado.textContent = 'Tu foto sigue disponible para guardar o compartir de nuevo.';
        } catch (error) {
            estado.textContent = error.name === 'AbortError'
                ? 'No se completó el envío. Tu foto sigue aquí.'
                : 'No se pudo compartir la foto. Puedes guardarla y compartirla desde tus descargas.';
        } finally {
            compartiendo = false;
            [guardar, cerrar].forEach((boton) => { boton.disabled = false; });
            compartir.disabled = !admiteCompartir();
        }
    });

    cerrar.addEventListener('click', solicitarDescarte);
    confirmarDescarte.addEventListener('click', descartarFoto);
    conservar.addEventListener('click', () => confirmacion.close());
    dialogo.addEventListener('cancel', (event) => {
        event.preventDefault();
        solicitarDescarte();
    });
    confirmacion.addEventListener('cancel', (event) => {
        event.preventDefault();
        confirmacion.close();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) ++version;
    });

    return {
        activar(valor) {
            activo = valor;
            controles.hidden = !valor;
            estadoCamara.textContent = '';
            if (!valor) {
                ++version;
                descartarFoto();
            }
        }
    };
}
