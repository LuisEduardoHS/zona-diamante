// Integración real en navegador: /__navigation-tests del servidor de pruebas.
const frame = document.querySelector('#sitio');
const resultado = document.querySelector('#resultado');
const esperar = async (condicion, mensaje) => {
    const inicio = Date.now();
    while (!condicion()) {
        if (Date.now() - inicio > 15000) throw new Error(mensaje);
        await new Promise(resolve => setTimeout(resolve, 40));
    }
};
document.querySelector('#ejecutar').addEventListener('click', async event => {
    event.target.disabled = true;
    resultado.textContent = '';
    const verificar = (condicion, mensaje) => {
        if (!condicion) throw new Error(mensaje);
        resultado.textContent += `✓ ${mensaje}\n`;
    };
    try {
        await esperar(() => frame.contentDocument.querySelector('#carousel-dots button'), 'Inicio listo');
        const doc = frame.contentDocument;
        const cabecera = doc.querySelector('.site-header');
        const menu = doc.querySelector('.site-bottom-nav');
        const origen = frame.contentWindow.performance.timeOrigin;
        const errores = [];
        frame.contentWindow.addEventListener('error', event => errores.push(event.error?.stack || event.message));
        const identidad = () => {
            verificar(doc === frame.contentDocument && frame.contentWindow.performance.timeOrigin === origen, 'Se conserva el documento');
            verificar(doc.querySelector('.site-header') === cabecera && doc.querySelector('.site-bottom-nav') === menu, 'Header y navegación conservan los mismos nodos');
        };
        const ir = async (archivo, selector) => {
            const enlace = [...doc.querySelectorAll('a')].find(a => a.getAttribute('href')?.endsWith(archivo));
            if (!enlace) throw new Error(`Falta enlace: ${archivo}`);
            enlace.click();
            await esperar(() => frame.contentWindow.location.pathname.endsWith(archivo) && doc.querySelector(selector) && !doc.querySelector('#contenido-pagina[aria-busy]'), archivo);
            identidad();
        };
        await ir('trivia.html', '.trivia-content');
        await ir('juego.html', '#pantallaJuego');
        doc.querySelector('#pantallaJuego').click();
        verificar(doc.querySelector('#resultadoOverlay').classList.contains('activo'), 'El juego se inicializa después de navegar');
        await ir('Informacion.html', '.TitleBubble');
        await ir('Ayuda.html', '.TitleBubble');
        await ir('pages/coleccion.html', '.cards-grid');
        verificar([...doc.images].every(img => img.src.includes('/assets/img/')), 'Rutas de imágenes correctas en páginas anidadas');
        await ir('index.html', '#carousel-dots button');
        doc.querySelector('.site-bottom-nav a[href$="trivia.html"]').click();
        doc.querySelector('.site-bottom-nav a[href$="index.html"]').click();
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        verificar(frame.contentWindow.location.pathname.endsWith('index.html'), 'Volver a Inicio cancela otro destino pendiente');
        doc.querySelector('[data-slide="0"] a').click();
        await esperar(() => frame.contentWindow.location.search.includes('sultanes-mty') && doc.querySelector('#equipo-detalle-container h1'), 'Detalle de equipo');
        verificar(doc.querySelector('#equipo-detalle-container h1').textContent.trim() === 'Sultanes', 'El detalle respeta el parámetro de equipo');
        frame.contentWindow.history.back();
        await esperar(() => frame.contentWindow.location.pathname.endsWith('index.html') && doc.querySelector('#carousel-dots button'), 'Atrás a Inicio');
        identidad();
        frame.contentWindow.history.forward();
        await esperar(() => frame.contentWindow.location.pathname.endsWith('equipo.html') && doc.querySelector('#equipo-detalle-container h1'), 'Adelante al detalle');
        identidad();
        await ir('index.html', '#carousel-dots button');
        doc.querySelector('.site-bottom-nav a[href$="trivia.html"]').click();
        doc.querySelector('.site-bottom-nav a[href$="Informacion.html"]').click();
        await esperar(() => frame.contentWindow.location.pathname.endsWith('Informacion.html') && !doc.querySelector('#contenido-pagina[aria-busy]'), 'Navegación rápida');
        verificar(doc.querySelector('.TitleBubble') && !doc.querySelector('.trivia-content'), 'Sólo gana la última navegación rápida');
        const recursos = frame.contentWindow.performance.getEntriesByType('resource');
        verificar(recursos.filter(r => r.name.endsWith('/data/equipos.json')).length === 1, 'Una sola petición de equipos al recorrer y volver');
        verificar(!recursos.some(r => r.name.includes('/libs/')), 'Inicio y secciones normales no descargan las librerías AR');
        verificar([...doc.querySelectorAll('link[rel="stylesheet"]')].filter(l => l.media === 'all').length === 1, 'Sólo está activa la hoja de estilos de la sección actual');
        await ir('camara.html', '#ar-frame');
        const ar = doc.querySelector('#ar-frame');
        await esperar(() => ar.contentDocument?.querySelector('#btn-tomar-foto') && !ar.contentDocument.querySelector('#foto-controles').hidden, 'Cámara simulada lista (iniciar servidor con ZD_AR_SIMULADA=1)');
        verificar(!ar.contentDocument.querySelector('.site-header, .site-bottom-nav'), 'La cámara no duplica la navegación');
        ar.contentWindow.addEventListener('error', event => errores.push(event.error?.stack || event.message));
        ar.contentDocument.querySelector('#btn-tomar-foto').click();
        await esperar(() => ar.classList.contains('ar-frame-modal'), 'Vista previa sobre la navegación');
        verificar(doc.querySelector('#header-superior').inert, 'La foto protege el foco y cubre la interfaz completa');
        ar.contentDocument.querySelector('#btn-cerrar-foto').click();
        ar.contentDocument.querySelector('#btn-confirmar-descarte').click();
        await esperar(() => !ar.classList.contains('ar-frame-modal'), 'Cerrar foto');
        await ir('index.html', '#carousel-dots button');
        verificar(!ar.isConnected && !doc.querySelector('#ar-frame'), 'Salir de AR elimina su contexto y sus recursos');
        verificar(errores.length === 0, `Sin excepciones de la aplicación${errores.length ? ': ' + errores.join('\n') : ''}`);
        resultado.textContent += '\nTODAS LAS PRUEBAS PASARON';
    } catch (error) {
        resultado.textContent += `\nERROR: ${error.message}`;
    } finally {
        event.target.disabled = false;
    }
});
