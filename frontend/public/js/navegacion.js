import { rutaInterna } from './rutas.js';

const cache = new Map();
const estilos = new Map();
const ordenSecciones = ['index.html', 'trivia.html', 'juego.html', 'camara.html', 'pages/coleccion.html', 'Informacion.html', 'Ayuda.html'];

function posicionSeccion(url) {
    const archivo = rutaInterna(url)?.archivo;
    const posicion = ordenSecciones.indexOf(archivo);
    return posicion < 0 ? 0 : posicion;
}

function prepararPagina(doc, url) {
    const contenido = doc.body.cloneNode(true);
    contenido.querySelectorAll('#header-superior, #menu-inferior, script').forEach(node => node.remove());
    for (const node of contenido.querySelectorAll('[href], [src], [poster], [data-src]')) {
        for (const attr of ['href', 'src', 'poster', 'data-src']) {
            const value = node.getAttribute(attr);
            if (value && !value.startsWith('#')) node.setAttribute(attr, new URL(value, url).href);
        }
    }
    return {
        html: contenido.innerHTML,
        clase: doc.body.className,
        titulo: doc.title,
        estilos: [...doc.querySelectorAll('link[rel="stylesheet"]')]
            .map(node => new URL(node.getAttribute('href'), url).href)
            .filter(href => !href.endsWith('/css/output.css'))
    };
}

async function obtenerPagina(url) {
    const key = url.origin + url.pathname;
    if (!cache.has(key)) {
        const peticion = fetch(key).then(async response => {
            if (!response.ok) throw new Error('No se pudo abrir la sección.');
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
            if (!doc.getElementById('header-superior')) throw new Error('Página no compatible.');
            return prepararPagina(doc, key);
        }).catch(error => { cache.delete(key); throw error; });
        cache.set(key, peticion);
    }
    return cache.get(key);
}

function cargarEstilo(href) {
    if (!estilos.has(href)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.media = 'not all';
        const lista = new Promise((resolve, reject) => {
            link.onload = resolve;
            link.onerror = () => { estilos.delete(href); link.remove(); reject(new Error('Error al cargar los estilos.')); };
        });
        link.href = href;
        estilos.set(href, { link, lista });
        document.head.append(link);
    }
    return estilos.get(href).lista;
}

async function montarSeccion(archivo, signal) {
    if (archivo === 'index.html') {
        const { renderCarousel } = await import('./components/CarouselEquipos.js');
        if (!signal.aborted) await renderCarousel(signal);
    } else if (archivo === 'equipo.html') {
        const { cargarDetalleEquipo } = await import('./equipo.js');
        if (!signal.aborted) await cargarDetalleEquipo(signal);
    } else if (archivo === 'juego.html') {
        const { iniciarJuego } = await import('./ganar_juego.js');
        if (!signal.aborted) iniciarJuego(signal);
    } else if (archivo === 'camara.html') {
        const frame = document.getElementById('ar-frame');
        if (frame && !signal.aborted) frame.src = frame.dataset.src;
    }
}

export function iniciarNavegacion(actualizarShell) {
    const inicial = prepararPagina(document, location.href);
    cache.set(location.origin + location.pathname, Promise.resolve(inicial));
    for (const link of document.querySelectorAll('link[rel="stylesheet"]')) {
        if (!link.href.endsWith('/css/output.css')) estilos.set(link.href, { link, lista: Promise.resolve() });
    }
    const vista = document.createElement('div');
    vista.id = 'contenido-pagina';
    const nodos = [...document.body.childNodes].filter(node =>
        !['header-superior', 'menu-inferior'].includes(node.id) && node.nodeName !== 'SCRIPT');
    vista.append(...nodos);
    document.body.append(vista);
    const aviso = document.createElement('div');
    aviso.className = 'sr-only';
    aviso.setAttribute('role', 'status');
    document.body.append(aviso);
    let ciclo = new AbortController();
    let animacionVista;
    let seccionActual = posicionSeccion(location.href);
    let version = 0;
    const nuevaEntrada = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    let entrada = history.state?.zdEntrada || nuevaEntrada();
    let restaurando = false;
    const posiciones = new Map();
    history.replaceState({ ...history.state, zdEntrada: entrada }, '');
    history.scrollRestoration = 'manual';
    const guardarScroll = () => { if (!restaurando) posiciones.set(entrada, [scrollX, scrollY]); };
    window.addEventListener('scroll', guardarScroll, { passive: true });

    async function navegar(destino, pop = false) {
        const info = rutaInterna(destino);
        if (!info) return;
        const solicitud = ++version;
        guardarScroll();
        vista.setAttribute('aria-busy', 'true');
        const progreso = setTimeout(() => {
            if (solicitud === version) { document.documentElement.classList.add('navegando'); aviso.textContent = 'Cargando sección…'; }
        }, 180);
        try {
            const pagina = await obtenerPagina(info.url);
            await Promise.all(pagina.estilos.map(cargarEstilo));
            if (solicitud !== version) return;
            const posicion = pop ? posiciones.get(history.state?.zdEntrada) || [0, 0] : [0, 0];
            restaurando = true;
            ciclo.abort();
            ciclo = new AbortController();
            if (!pop) {
                entrada = nuevaEntrada();
                history.pushState({ zdEntrada: entrada }, '', info.url);
            } else entrada = history.state?.zdEntrada || nuevaEntrada();
            for (const [href, { link }] of estilos) link.media = pagina.estilos.includes(href) ? 'all' : 'not all';
            document.body.className = pagina.clase;
            document.title = pagina.titulo;
            const direccion = posicionSeccion(info.url) >= seccionActual ? 1 : -1;
            animacionVista?.cancel();
            vista.innerHTML = pagina.html;
            animacionVista = vista.animate([
                { transform: `translateX(${direccion * 100}%)`, opacity: .85 },
                { transform: 'translateX(0)', opacity: 1 }
            ], {
                duration: matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 320,
                easing: 'cubic-bezier(.22, .75, .25, 1)',
                fill: 'both'
            });
            for (const id of ['header-superior', 'menu-inferior']) document.getElementById(id).inert = false;
            actualizarShell();
            await montarSeccion(info.archivo, ciclo.signal);
            if (solicitud !== version) return;
            const foco = vista.querySelector('h1, main');
            if (foco) { foco.setAttribute('tabindex', '-1'); foco.focus({ preventScroll: true }); }
            const ancla = info.url.hash && document.getElementById(decodeURIComponent(info.url.hash.slice(1)));
            if (ancla) ancla.scrollIntoView();
            else window.scrollTo(...posicion);
            aviso.textContent = pagina.titulo;
            seccionActual = posicionSeccion(info.url);
        } catch (error) {
            // Si falla la carga parcial, el enlace normal sigue disponible.
            if (solicitud === version) location.assign(info.url.href);
        } finally {
            clearTimeout(progreso);
            if (solicitud === version) {
                restaurando = false;
                vista.removeAttribute('aria-busy');
                document.documentElement.classList.remove('navegando');
            }
        }
    }

    document.addEventListener('click', event => {
        const enlace = event.target.closest('a[href]');
        if (!enlace || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || enlace.hasAttribute('download') || (enlace.target && enlace.target !== '_self')) return;
        const info = rutaInterna(enlace.href);
        if (!info || (info.url.pathname === location.pathname && info.url.search === location.search && info.url.hash)) return;
        event.preventDefault();
        if (info.url.href === location.href) {
            // Volver a pulsar la sección actual cancela un destino aún pendiente.
            ++version;
            restaurando = false;
            vista.removeAttribute('aria-busy');
            document.documentElement.classList.remove('navegando');
            actualizarShell();
            return;
        }
        void navegar(info.url);
    });
    window.addEventListener('popstate', () => void navegar(location.href, true));

    // Anticipa sólo HTML: nunca imágenes ni el motor AR de secciones no abiertas.
    const anticipar = event => {
        if (navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType || '')) return;
        const enlace = event.target.closest('a[href]');
        const info = enlace && rutaInterna(enlace.href);
        if (info) void obtenerPagina(info.url).catch(() => {});
    };
    document.addEventListener('pointerover', anticipar, { passive: true });
    document.addEventListener('focusin', anticipar);

    // AR vive en un contexto WebGL aislado; salir destruye cámara, workers y listeners.
    window.addEventListener('message', event => {
        const frame = vista.querySelector('#ar-frame');
        if (frame && event.origin === location.origin && event.source === frame.contentWindow && event.data?.tipo === 'ar-foto-modal') {
            frame.classList.toggle('ar-frame-modal', event.data.abierto === true);
            for (const id of ['header-superior', 'menu-inferior']) document.getElementById(id).inert = event.data.abierto === true;
        }
    });
    actualizarShell();
    void montarSeccion(rutaInterna(location.href)?.archivo, ciclo.signal);
}
