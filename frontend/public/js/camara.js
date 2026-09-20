import { lanzarConfeti } from './confeti.js';
import { iniciarFotoAR } from './foto-ar.js';

// Inicia cuando el HTML está listo.
document.addEventListener('DOMContentLoaded', () => {
    // Relaciona cada marcador con su equipo.
    const equiposAR = {
        0: "Algodoneros",
        1: "Charros",
        2: "Dorados",
        3: "Sultanes"
    };
    const modelosAR = {
        0: "./ar/models/Algodoneros_color.glb",
        1: "./ar/models/charros_modelo.glb",
        2: "./ar/models/dorados_modelo.glb"
    };

    // Elementos que muestran el resultado del escaneo.
    const uiResult = document.getElementById('ar-result');
    const uiStatus = document.getElementById('ar-status');
    const uiStatusContainer = document.getElementById('ar-status-container');
    const uiError = document.getElementById('ar-error');
    const uiErrorMessage = document.getElementById('ar-error-message');
    const btnReintentarCamara = document.getElementById('btn-reintentar-camara');
    const textoEquipo = document.getElementById('equipo-detectado');

    // Indica si está abierta la vista 3D.
    let modoInspector = false;

    // Botones, cámara y modelos de las dos vistas.
    const btnInspeccionar = document.getElementById('btn-inspeccionar');
    const btnReclamar = document.getElementById('btn-reclamar');
    const btnCerrarInspector = document.getElementById('btn-cerrar-inspector');
    const camara = document.getElementById('ar-camera');
    const modelosEnTargets = document.querySelectorAll('.modelo-target');
    const modeloTargetAlgodoneros = document.getElementById('modelo-target-algodoneros');
    const modeloCamara = document.getElementById('modelo-camara');
    const escena = document.querySelector('a-scene');

    // Conserva el estado real del seguimiento aunque el inspector esté abierto.
    const targetsVisibles = new Set();
    let targetActivo = null;
    let targetResultado = null;
    let temporizadorPerdida = null;
    let temporizadorOcultar = null;
    let temporizadorInicioCamara = null;
    let arIniciando = false;
    let arListo = false;
    let arPausado = false;
    let paginaSuspendida = document.hidden;
    let versionVisibilidad = 0;

    // Guarda el encuadre y los cambios hechos con los dedos.
    let encuadre = null;
    let zoom = 1;
    let desplazamiento = { x: 0, y: 0 };

    // El origen del GLB de Algodoneros está desplazado; centra su geometría
    // horizontalmente sin cambiar la posición de los demás equipos.
    const centrarModeloAlgodoneros = () => {
        const mesh = modeloTargetAlgodoneros?.getObject3D('mesh');
        if (!mesh) return;

        const caja = new AFRAME.THREE.Box3();
        mesh.traverse((objeto) => {
            if (!objeto.isMesh || !objeto.geometry) return;

            objeto.geometry.computeBoundingBox();
            if (!objeto.geometry.boundingBox) return;

            // Calcula la transformación local sin depender de que MindAR
            // tenga visible el marcador en este momento.
            const matrizLocal = new AFRAME.THREE.Matrix4().identity();
            let actual = objeto;
            while (actual && actual !== modeloTargetAlgodoneros.object3D) {
                actual.updateMatrix();
                matrizLocal.premultiply(actual.matrix);
                actual = actual.parent;
            }

            caja.union(objeto.geometry.boundingBox.clone().applyMatrix4(matrizLocal));
        });

        if (caja.isEmpty()) return;
        const centro = caja.getCenter(new AFRAME.THREE.Vector3());
        const posicion = modeloTargetAlgodoneros.getAttribute('position') || { x: 0, y: 0, z: 0 };
        const escalaX = modeloTargetAlgodoneros.object3D.scale.x;

        modeloTargetAlgodoneros.setAttribute('position', {
            x: -centro.x * escalaX,
            y: posicion.y,
            z: posicion.z
        });
    };

    modeloTargetAlgodoneros?.addEventListener('model-loaded', centrarModeloAlgodoneros);
    if (modeloTargetAlgodoneros?.getObject3D('mesh')) centrarModeloAlgodoneros();

    // Mantiene el centro del modelo al girarlo, moverlo o escalarlo.
    const aplicarTransformacion = () => {
        if (!encuadre) return;
        const camera = camara.getObject3D('camera');
        // Limita el zoom para evitar que el modelo atraviese la cámara.
        const limite = Math.min(
            encuadre.distancia - camera.near,
            camera.far - encuadre.distancia
        ) * 0.9 / (encuadre.radio * encuadre.escala);
        zoom = Math.max(0.2, Math.min(zoom, 3, limite));
        // Conserva el centro dentro del 70% central de la vista, incluso tras girar el celular.
        desplazamiento.x = Math.max(-0.35, Math.min(0.35, desplazamiento.x));
        desplazamiento.y = Math.max(-0.35, Math.min(0.35, desplazamiento.y));
        const escala = encuadre.escala * zoom;
        const centro = encuadre.centro.clone().multiplyScalar(escala)
            .applyQuaternion(modeloCamara.object3D.quaternion);
        modeloCamara.setAttribute('scale', { x: escala, y: escala, z: escala });
        modeloCamara.setAttribute('position', {
            x: desplazamiento.x * encuadre.ancho - centro.x,
            y: desplazamiento.y * encuadre.alto - centro.y,
            z: -encuadre.distancia - centro.z
        });
    };

    // Mensaje y estado de carga del modelo.
    const uiModelo = document.getElementById('modelo-status');
    let modeloCargado = false;
    let modeloPreparadoPara = null;
    let modeloSolicitadoPara = null;

    // Habilita Ver 3D cuando el modelo está listo.
    const actualizarCarga = () => {
        const tieneModelo = targetResultado !== null && Boolean(modelosAR[targetResultado]);
        const modeloCorrectoListo = tieneModelo
            && modeloCargado
            && modeloPreparadoPara === targetResultado;

        btnInspeccionar.disabled = !modeloCorrectoListo;
        btnInspeccionar.textContent = !tieneModelo
            ? '3D no disponible'
            : modeloCorrectoListo ? 'Ver 3D' : 'Cargando 3D...';
        uiModelo.textContent = !tieneModelo
            ? 'Este equipo todavía no tiene un modelo 3D.'
            : modeloCorrectoListo ? '' : 'Cargando el modelo 3D...';
    };

    // Prepara en el inspector el modelo correspondiente al equipo detectado.
    const prepararModeloInspector = (index) => {
        const rutaModelo = modelosAR[index];
        modeloSolicitadoPara = rutaModelo ? index : null;
        encuadre = null;

        if (!rutaModelo) {
            modeloCargado = false;
            modeloPreparadoPara = null;
            modeloCamara.removeAttribute('src');
            actualizarCarga();
            return;
        }

        const rutaActual = modeloCamara.getAttribute('src');
        if (rutaActual === rutaModelo && modeloCamara.getObject3D('mesh')) {
            modeloCargado = true;
            modeloPreparadoPara = index;
            actualizarCarga();
            return;
        }

        modeloCargado = false;
        modeloPreparadoPara = null;
        actualizarCarga();
        modeloCamara.setAttribute('src', rutaModelo);
    };

    // Ajusta el modelo para que se vea completo en la cámara.
    const encuadrarModelo = () => {
        const camera = camara.getObject3D('camera');
        const mesh = modeloCamara.getObject3D('mesh');
        if (!camera || !mesh) return false;

        // Calcula los límites de todas las piezas del modelo.
        mesh.updateMatrixWorld(true);
        const inversa = new AFRAME.THREE.Matrix4().copy(mesh.matrixWorld).invert();
        const caja = new AFRAME.THREE.Box3();
        mesh.traverse((objeto) => {
            if (!objeto.isMesh) return;
            objeto.geometry.computeBoundingBox();
            const matriz = new AFRAME.THREE.Matrix4().multiplyMatrices(inversa, objeto.matrixWorld);
            caja.union(objeto.geometry.boundingBox.clone().applyMatrix4(matriz));
        });
        if (caja.isEmpty()) return false;

        // Obtiene el centro y el radio que abarcan el modelo.
        const esfera = caja.getBoundingSphere(new AFRAME.THREE.Sphere());
        if (!Number.isFinite(esfera.radius) || esfera.radius <= 0) return false;

        // Aleja el modelo para que MindAR no lo recorte (near=10).
        const distancia = Math.max(3, camera.near * 3);
        // Calcula el espacio visible y deja un margen alrededor.
        const medioFovY = camera.getEffectiveFOV() * Math.PI / 360;
        const medioFovX = Math.atan(Math.tan(medioFovY) * camera.aspect);
        const radioVisible = Math.min(
            distancia * Math.sin(Math.min(medioFovX, medioFovY)) * 0.8,
            (distancia - camera.near) * 0.8,
            (camera.far - distancia) * 0.8
        );
        if (radioVisible <= 0) return false;
        // Cambia el tamaño y centra el modelo frente a la cámara.
        const alto = 2 * distancia * Math.tan(medioFovY);
        encuadre = {
            centro: esfera.center,
            radio: esfera.radius,
            escala: radioVisible / esfera.radius,
            distancia,
            alto,
            ancho: alto * camera.aspect
        };
        aplicarTransformacion();
        return true;
    };

    // Actualiza el botón cuando termina la carga.
    modeloCamara.addEventListener('model-loaded', () => {
        modeloCargado = true;
        modeloPreparadoPara = modeloSolicitadoPara;
        actualizarCarga();
    });
    // Muestra un aviso si falla la carga.
    modeloCamara.addEventListener('model-error', () => {
        modeloCargado = false;
        modeloPreparadoPara = null;
        actualizarCarga();
        btnInspeccionar.textContent = '3D no disponible';
        uiModelo.textContent = 'No se pudo cargar el modelo 3D de este equipo.';
    });
    // Muestra el estado inicial de carga.
    actualizarCarga();

    // Reajusta la vista al cambiar la pantalla.
    const reajustarInspector = () => {
        requestAnimationFrame(() => {
            if (modoInspector) encuadrarModelo();
        });
    };
    window.addEventListener('resize', reajustarInspector);

    const mostrarErrorCamara = (mensajePersonalizado = null) => {
        clearTimeout(temporizadorInicioCamara);
        temporizadorInicioCamara = null;
        arIniciando = false;
        arListo = false;

        let mensaje = typeof mensajePersonalizado === 'string'
            ? mensajePersonalizado
            : 'Revisa el permiso de cámara e inténtalo de nuevo.';
        if (!mensajePersonalizado && !window.isSecureContext) {
            mensaje = 'La cámara sólo funciona desde HTTPS o localhost. Abre el sitio con una conexión segura.';
        } else if (!mensajePersonalizado && !navigator.mediaDevices?.getUserMedia) {
            mensaje = 'Este navegador o dispositivo no ofrece acceso a la cámara.';
        }

        uiErrorMessage.textContent = mensaje;
        uiError.classList.remove('hidden');
        uiError.classList.add('flex');
        uiStatus.textContent = 'Cámara no disponible';
    };

    // MindAR se inicia explícitamente para poder recuperar un fallo de permisos.
    const iniciarCamara = async () => {
        if (arIniciando || arListo || paginaSuspendida) return;

        const sistemaAR = escena.systems?.['mindar-image-system'];
        if (!sistemaAR) {
            mostrarErrorCamara('No se pudo preparar el escáner. Recarga la página e inténtalo de nuevo.');
            return;
        }

        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
            mostrarErrorCamara();
            return;
        }

        arIniciando = true;
        uiError.classList.add('hidden');
        uiError.classList.remove('flex');
        uiStatus.textContent = 'Iniciando cámara...';

        // Evita quedarse esperando indefinidamente en equipos sin cámara.
        if (navigator.mediaDevices.enumerateDevices) {
            try {
                const dispositivos = await navigator.mediaDevices.enumerateDevices();
                if (!dispositivos.some(({ kind }) => kind === 'videoinput')) {
                    mostrarErrorCamara('No se detectó ninguna cámara en este dispositivo.');
                    return;
                }
            } catch (error) {
                // Algunos navegadores sólo permiten enumerar después de conceder permiso.
                console.debug('No fue posible enumerar las cámaras antes de iniciar.', error);
            }
        }

        if (paginaSuspendida) {
            arIniciando = false;
            return;
        }

        // Elimina el elemento de video dejado por un intento fallido de MindAR.
        if (sistemaAR.video && !sistemaAR.video.srcObject) {
            sistemaAR.video.remove();
            sistemaAR.video = null;
        }

        temporizadorInicioCamara = setTimeout(() => {
            mostrarErrorCamara('La cámara no respondió. Revisa el permiso del navegador y vuelve a intentarlo.');
        }, 12000);

        try {
            sistemaAR.start();
        } catch (error) {
            console.error('No se pudo iniciar MindAR.', error);
            mostrarErrorCamara('No se pudo iniciar el escáner. Vuelve a intentarlo.');
            return;
        }

        // Una vez recibido el video, da más tiempo a MindAR para compilar los marcadores.
        sistemaAR.video?.addEventListener('loadedmetadata', () => {
            clearTimeout(temporizadorInicioCamara);
            if (paginaSuspendida) return;
            uiStatus.textContent = 'Preparando escáner...';
            temporizadorInicioCamara = setTimeout(() => {
                mostrarErrorCamara('No se pudo preparar el escáner. Vuelve a intentarlo.');
            }, 30000);
        }, { once: true });
    };

    escena.addEventListener('arReady', () => {
        clearTimeout(temporizadorInicioCamara);
        temporizadorInicioCamara = null;
        arIniciando = false;
        arListo = true;
        uiError.classList.add('hidden');
        uiError.classList.remove('flex');
        uiStatus.textContent = 'Escaneando logo...';
        reajustarInspector();
        // MindAR empieza a procesar justo después de emitir arReady.
        queueMicrotask(() => {
            if (paginaSuspendida) pausarCamara();
        });
    });
    escena.addEventListener('arError', mostrarErrorCamara);
    escena.addEventListener('renderstart', iniciarCamara, { once: true });
    if (escena.renderStarted) iniciarCamara();
    // Recargar cancela también cualquier solicitud de cámara que el navegador dejara pendiente.
    btnReintentarCamara.addEventListener('click', () => window.location.reload());

    // Muestra el equipo detectado y anima la tarjeta de resultado.
    const mostrarResultado = (index) => {
        if (modoInspector) return;

        clearTimeout(temporizadorOcultar);
        temporizadorOcultar = null;
        clearTimeout(temporizadorPerdida);
        temporizadorPerdida = null;
        targetResultado = index;

        const nombreEquipo = equiposAR[index];
        textoEquipo.textContent = nombreEquipo;
        prepararModeloInspector(index);
        uiStatus.textContent = "¡Escaneo Exitoso!";
        uiStatusContainer.classList.replace('bg-black/50', 'bg-green-500/80');

        uiResult.classList.remove('hidden');
        uiResult.classList.add('flex');

        setTimeout(() => {
            uiResult.classList.remove('translate-y-10', 'opacity-0');
        }, 10);
    };

    // Oculta la tarjeta y vuelve al mensaje de escaneo.
    const ocultarResultado = (inmediato = false) => {
        if (modoInspector) return;

        clearTimeout(temporizadorPerdida);
        temporizadorPerdida = null;
        targetResultado = null;
        actualizarCarga();

        uiStatus.textContent = "Escaneando logo...";
        uiStatusContainer.classList.replace('bg-green-500/80', 'bg-black/50');

        uiResult.classList.add('translate-y-10', 'opacity-0');

        clearTimeout(temporizadorOcultar);
        const terminarOcultado = () => {
            uiResult.classList.add('hidden');
            uiResult.classList.remove('flex');
            textoEquipo.textContent = 'Equipo';
            temporizadorOcultar = null;
        };

        if (inmediato) {
            terminarOcultado();
        } else {
            temporizadorOcultar = setTimeout(terminarOcultado, 300);
        }
    };

    const actualizarResultadoSegunTracking = (inmediato = false) => {
        if (modoInspector) return;

        if (targetActivo !== null && targetsVisibles.has(targetActivo)) {
            mostrarResultado(targetActivo);
        } else if (!inmediato && targetResultado !== null) {
            // Mantiene el último resultado utilizable mientras se recupera el logo.
            if (temporizadorPerdida === null) {
                temporizadorPerdida = setTimeout(() => {
                    temporizadorPerdida = null;
                    ocultarResultado();
                }, 900);
            }
        } else {
            ocultarResultado(inmediato);
        }
    };

    // Escucha cuándo se detecta o se pierde cada marcador.
    for (let i = 0; i <= 3; i++) {
        const target = document.getElementById(`target-${i}`);
        if (target) {
            target.addEventListener('targetFound', () => {
                if (paginaSuspendida || arPausado) return;
                targetsVisibles.add(i);
                targetActivo = i;
                actualizarResultadoSegunTracking();
            });
            target.addEventListener('targetLost', () => {
                if (paginaSuspendida || arPausado) return;
                targetsVisibles.delete(i);
                if (targetActivo === i) {
                    const visibles = Array.from(targetsVisibles);
                    targetActivo = visibles.length ? visibles[visibles.length - 1] : null;
                }
                actualizarResultadoSegunTracking();
            });
        }
    }

    const fotoAR = iniciarFotoAR({
        escena,
        puedeCapturar: () => modoInspector && arListo && !arPausado && !paginaSuspendida && modeloCargado,
        obtenerEquipo: () => equiposAR[modeloPreparadoPara]
    });

    btnReclamar.addEventListener('click', lanzarConfeti);

    // Abre el visor 3D y oculta la interfaz del escáner.
    btnInspeccionar.addEventListener('click', () => {
        if (targetResultado === null || !modeloCargado || modeloPreparadoPara !== targetResultado) return;
        zoom = 1;
        desplazamiento = { x: 0, y: 0 };
        modeloCamara.setAttribute('rotation', '0 0 0');
        if (!encuadrarModelo()) {
            uiModelo.textContent = 'No se pudo preparar la vista 3D. Inténtalo de nuevo.';
            return;
        }
        modoInspector = true;
        clearTimeout(temporizadorPerdida);
        temporizadorPerdida = null;
        const canvas = escena.canvas;
        if (canvas) {
            touchActionOriginal = canvas.style.touchAction || '';
            canvas.style.touchAction = 'none';
        }
        reiniciarGesto();

        document.getElementById('ar-ui').classList.add('hidden');
        btnCerrarInspector.classList.remove('hidden');

        modelosEnTargets.forEach((modelo) => modelo.setAttribute('visible', false));
        if (modeloCamara) modeloCamara.setAttribute('visible', true);
        fotoAR.activar(true);
        lanzarConfeti();
    });

    // Cierra el visor 3D y regresa al escáner.
    btnCerrarInspector.addEventListener('click', () => {
        modoInspector = false;
        fotoAR.activar(false);
        if (escena.canvas) escena.canvas.style.touchAction = touchActionOriginal;
        reiniciarGesto();

        document.getElementById('ar-ui').classList.remove('hidden');
        btnCerrarInspector.classList.add('hidden');

        if (modeloCamara) modeloCamara.setAttribute('visible', false);
        modelosEnTargets.forEach((modelo) => modelo.setAttribute('visible', true));

        // Si el logo se perdió mientras se veía el 3D, no restaura sus datos.
        actualizarResultadoSegunTracking(true);
    });

    // Guarda el gesto actual; un dedo gira y dos dedos mueven y escalan.
    let touchActionOriginal = '';
    let touchPrevio = null;
    let distanciaPellizcoPrevia = null;
    let paneoPrevio = null;

    const medirDosDedos = (touches) => ({
        distancia: Math.hypot(
            touches[0].clientX - touches[1].clientX,
            touches[0].clientY - touches[1].clientY
        ),
        x: (touches[0].clientX + touches[1].clientX) / 2,
        y: (touches[0].clientY + touches[1].clientY) / 2
    });

    // Reinicia las referencias al agregar, retirar o cancelar un dedo.
    const reiniciarGesto = (touches = []) => {
        touchPrevio = null;
        distanciaPellizcoPrevia = null;
        paneoPrevio = null;
        if (touches.length === 1) {
            touchPrevio = { x: touches[0].clientX, y: touches[0].clientY };
        } else if (touches.length === 2) {
            paneoPrevio = medirDosDedos(touches);
            distanciaPellizcoPrevia = paneoPrevio.distancia;
        }
    };

    // Pausa captura, seguimiento y renderizado sin volver a descargar los modelos.
    const pausarCamara = () => {
        clearTimeout(temporizadorInicioCamara);
        clearTimeout(temporizadorPerdida);
        temporizadorPerdida = null;
        reiniciarGesto();
        escena.pause();
        if (!arListo || arPausado) return;
        const sistemaAR = escena.systems['mindar-image-system'];
        sistemaAR.pause();
        sistemaAR.video.srcObject?.getTracks().forEach((track) => { track.enabled = false; });
        arPausado = true;
        targetsVisibles.clear();
        targetActivo = null;
        // El controlador reinicia el tracking al reanudar; descarta poses antiguas.
        for (let i = 0; i <= 3; i++) {
            const target = document.getElementById(`target-${i}`);
            if (target) target.object3D.visible = false;
        }
        if (!modoInspector) ocultarResultado(true);
    };

    const reanudarCamara = async () => {
        const version = ++versionVisibilidad;
        escena.play();
        if (!arPausado) {
            const video = escena.systems?.['mindar-image-system']?.video;
            if (arIniciando && video) {
                video.srcObject?.getTracks().forEach((track) => { track.enabled = true; });
                video.play().catch(() => {
                    if (!paginaSuspendida && version === versionVisibilidad) {
                        mostrarErrorCamara('No se pudo reanudar la cámara. Pulsa Reintentar para recuperarla.');
                    }
                });
                clearTimeout(temporizadorInicioCamara);
                temporizadorInicioCamara = setTimeout(() => {
                    mostrarErrorCamara('No se pudo preparar el escáner. Vuelve a intentarlo.');
                }, 30000);
            }
            if (!arIniciando && !arListo) iniciarCamara();
            return;
        }
        const sistemaAR = escena.systems['mindar-image-system'];
        try {
            const tracks = sistemaAR.video.srcObject?.getVideoTracks() || [];
            if (!tracks.length || tracks.some((track) => track.readyState === 'ended')) {
                throw new Error('La captura de cámara terminó en segundo plano.');
            }
            tracks.forEach((track) => { track.enabled = true; });
            await sistemaAR.video.play();
            if (paginaSuspendida || version !== versionVisibilidad) return;
            sistemaAR.controller.processVideo(sistemaAR.video);
            arPausado = false;
            uiStatus.textContent = 'Escaneando logo...';
            reajustarInspector();
        } catch (error) {
            if (paginaSuspendida || version !== versionVisibilidad) return;
            tracksDesactivar();
            mostrarErrorCamara('No se pudo reanudar la cámara. Pulsa Reintentar para recuperarla.');
        }
    };

    const tracksDesactivar = () => {
        const video = escena.systems?.['mindar-image-system']?.video;
        video?.pause();
        video?.srcObject?.getTracks().forEach((track) => { track.enabled = false; });
    };

    const actualizarVisibilidad = (suspendida) => {
        if (paginaSuspendida === suspendida) return;
        paginaSuspendida = suspendida;
        ++versionVisibilidad;
        if (suspendida) {
            pausarCamara();
            tracksDesactivar();
        } else {
            reanudarCamara();
        }
    };
    document.addEventListener('visibilitychange', () => actualizarVisibilidad(document.hidden));
    window.addEventListener('pagehide', () => actualizarVisibilidad(true));
    window.addEventListener('pageshow', () => actualizarVisibilidad(document.hidden));

    // Escucha solo la escena para no interferir con los botones y menús.
    escena.addEventListener('touchstart', (e) => {
        if (!modoInspector) return;
        e.preventDefault();
        reiniciarGesto(e.targetTouches);
    }, { passive: false });

    escena.addEventListener('touchmove', (e) => {
        if (!modoInspector || !encuadre) return;
        e.preventDefault();
        const touches = e.targetTouches;

        if (touches.length === 1 && touchPrevio) {
            const deltaX = touches[0].clientX - touchPrevio.x;
            const deltaY = touches[0].clientY - touchPrevio.y;

            const rotacionActual = modeloCamara.getAttribute('rotation') || { x: 0, y: 0, z: 0 };

            modeloCamara.setAttribute('rotation', {
                x: rotacionActual.x + deltaY * 0.5,
                y: rotacionActual.y + deltaX * 0.5,
                z: rotacionActual.z
            });

            aplicarTransformacion();
            touchPrevio = { x: touches[0].clientX, y: touches[0].clientY };
        }

        else if (touches.length === 2 && paneoPrevio) {
            const paneoActual = medirDosDedos(touches);
            // Separa los dedos para ampliar y júntalos para reducir.
            if (distanciaPellizcoPrevia > 0 && paneoActual.distancia > 0) {
                zoom *= paneoActual.distancia / distanciaPellizcoPrevia;
            }
            // Convierte el movimiento de pantalla a la posición del modelo.
            const rect = escena.canvas.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) {
                desplazamiento.x += (paneoActual.x - paneoPrevio.x) / rect.width;
                desplazamiento.y -= (paneoActual.y - paneoPrevio.y) / rect.height;
            }
            aplicarTransformacion();
            distanciaPellizcoPrevia = paneoActual.distancia;
            paneoPrevio = paneoActual;
        }
    }, { passive: false });

    escena.addEventListener('touchend', (e) => {
        reiniciarGesto(modoInspector ? e.targetTouches : []);
    });
    escena.addEventListener('touchcancel', () => reiniciarGesto());

});
