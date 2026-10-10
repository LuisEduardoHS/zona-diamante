import { obtenerEquipos } from '../../services/datos-equipos.js?v=20261010-2';
import { RUTAS, ruta } from '../../app/rutas.js';

const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const icon = (path, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
const closeIcon = icon('m6 6 12 12M18 6 6 18');
const playIcon = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>';
const magicIcon = icon('m4 20 12-12 4 4-12 12M14 10l4 4M5 3v4M3 5h4M18 2v4M16 4h4M21 16v4M19 18h4');
const image = (src, alt, cls = '', eager = false) => src ? `<img class="${cls}" src="${html(src)}" alt="${html(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async">` : `<span class="equipo-image-empty ${cls}">Imagen por confirmar</span>`;
const value = data => data === undefined || data === null || data === '' ? '—' : html(data);
export const FILTROS_VIDEO = Object.freeze({
    original: { nombre: 'Original', css: 'none' },
    cine: { nombre: 'Cine', css: 'contrast(1.18) saturate(.8) brightness(.95)' },
    calido: { nombre: 'Cálido', css: 'sepia(.3) saturate(1.35)' },
    blancoNegro: { nombre: 'Blanco y negro', css: 'grayscale(1)' },
    retro: { nombre: 'Retro', css: 'sepia(.6) contrast(.9) saturate(.8)' }
});

export function fuenteVideo(video) {
    if (video?.tipo === 'youtube' && /^[\w-]{11}$/.test(video.id || '')) return `https://www.youtube-nocookie.com/embed/${video.id}?playsinline=1&rel=0`;
    if (video?.tipo === 'archivo' && /^https?:\/\//.test(video.src || '')) return video.src;
    return '';
}

function calendarioTemplate(equipo, equipos) {
    const d = equipo.detalles;
    const juegos = d.calendario;
    return `<section class="equipo-calendar equipo-card" aria-labelledby="equipo-calendario">
        <h2 class="equipo-section-bar" id="equipo-calendario">Calendario de juegos</h2>
        <div class="equipo-calendar-body">
            ${juegos.length ? `<ul>${juegos.map(juego => {
                const rival = equipos.find(item => item.id === juego.oponenteId || item.nombre === juego.oponente);
                const pendiente = !juego.inicio && (!juego.fecha || /próximamente|definir|confirmar/i.test(juego.fecha));
                const date = juego.inicio ? new Date(juego.inicio) : null;
                const valid = date && Number.isFinite(date.getTime());
                const fecha = valid ? new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', timeZone: 'America/Mexico_City' }).format(date) : pendiente ? 'Por confirmar' : juego.fecha;
                const hora = valid ? new Intl.DateTimeFormat('es-MX', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Mexico_City' }).format(date) + ' · CDMX' : juego.hora || 'Horario por definir';
                return `<li class="equipo-match">
                    <div class="equipo-match-clubs"><span>${image(equipo.imagenes.logoFondo, equipo.nombre)}<small>${html(equipo.nombre)}</small></span><b>vs</b><span>${rival ? image(rival.imagenes.logoFondo, rival.nombre) : '<span class="equipo-rival-placeholder" aria-hidden="true">?</span>'}<small>${html(juego.oponente || 'Rival por confirmar')}</small></span></div>
                    <div class="equipo-match-date">${valid ? `<time datetime="${html(juego.inicio)}">${html(fecha)}</time>` : `<strong>${html(fecha)}</strong>`}<small>${html(hora)}</small></div>
                </li>`;
            }).join('')}</ul>` : '<p class="equipo-empty">Aún no hay juegos programados.</p>'}
            ${juegos.some(juego => !juego.inicio && /próximamente|definir|confirmar/i.test(juego.fecha || '')) ? '<p class="equipo-note">Fechas y horarios pendientes de confirmación.</p>' : ''}
            ${d.calendarioUrl ? `<a class="equipo-text-link" href="${html(d.calendarioUrl)}" target="_blank" rel="noopener noreferrer">Consultar sitio oficial ${icon('M7 17 17 7M7 7h10v10')}</a>` : ''}
        </div>
    </section>`;
}

export function detalleTemplate(equipo, equipos) {
    const d = equipo.detalles;
    const [ganados, perdidos] = String(d.record || '').split('-').map(item => item.trim());
    const stats = [['Porcentaje de victorias (PCT)', d.estadisticas.pct, 'wide'], ['Racha (Streak)', d.estadisticas.streak, ''], ['Promedio de bateo (AVG)', d.estadisticas.avg, 'wide'], ['Home runs (HR)', d.estadisticas.hr, ''], ['Carreras (CI)', d.estadisticas.ci, '']];
    const gallery = d.galeria;
    const video = d.video;
    const videoReady = Boolean(fuenteVideo(video));
    return `<header class="equipo-hero">
        <svg class="equipo-hero-wave" viewBox="0 0 480 170" preserveAspectRatio="none" aria-hidden="true"><path d="M0 0H380C295 72 135 22 0 150Z" fill="currentColor"/></svg>
        <p>${html(equipo.ciudad)}</p><h1>${html(equipo.nombre)}</h1>
    </header>
    <div class="equipo-sections">
        <section class="equipo-overview equipo-card" aria-label="Resumen de ${html(equipo.nombre)}">
            <h2 class="equipo-pill">${html(d.zona || 'Liga Mexicana de Béisbol')}</h2>
            <div class="equipo-record"><span>Récord:</span><p class="equipo-pill"><span class="equipo-wins">${value(ganados)}</span><span aria-hidden="true"> – </span><span class="equipo-losses">${value(perdidos)}</span><span class="sr-only"> victorias y derrotas</span></p></div>
            <p class="equipo-pill equipo-position">${value(d.posicion)} <span>en su zona</span></p>
        </section>
        <details class="equipo-statistics equipo-card" open>
            <summary class="equipo-section-bar">Estadísticas <span class="equipo-disclosure-icon" aria-hidden="true"></span></summary>
            <div class="equipo-statistics-body">
                <h3 class="equipo-pill">Historia y campeonatos</h3>
                <p class="equipo-history">${html(d.historia || 'Próximamente conocerás más sobre la historia del equipo.')}</p>
                <dl class="equipo-stats">${stats.map(([label, data, type]) => `<div class="equipo-stat ${type ? 'equipo-stat--wide' : ''}"><dt>${label}</dt><dd>${value(data)}</dd></div>`).join('')}</dl>
            </div>
        </details>
        <figure class="equipo-stadium">${image(d.estadio.imagen, d.estadio.nombre, d.estadio.recorteSuperior ? 'equipo-crop-top' : '')}<figcaption><span>${icon('M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM15 10a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z')}${html(d.estadio.ubicacion || equipo.ciudad)}</span><h2>${html(d.estadio.nombre || 'Estadio por confirmar')}</h2></figcaption></figure>
        <section class="equipo-mascot equipo-card" aria-label="Mascota del equipo">${image(d.mascota.imagen, d.mascota.nombre)}<div><h2>${html(d.mascota.nombre || 'Mascota')}</h2><p>La energía de<br>nuestra afición.</p></div></section>
        ${d.palmares.length ? `<section class="equipo-honours" aria-label="Palmarés"><ul>${d.palmares.map(titulo => `<li>${icon('M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v2a4 4 0 0 0 4 4M16 5h4v2a4 4 0 0 1-4 4M12 13v6M8 21h8')}${html(titulo)}</li>`).join('')}</ul></section>` : ''}
        <figure class="equipo-mvp">${image(d.mvp.imagen, d.mvp.nombre)}<span class="equipo-mvp-badge">MVP</span><figcaption><h2>${html(d.mvp.nombre || 'Jugador destacado')}</h2></figcaption></figure>
        ${calendarioTemplate(equipo, equipos)}
    </div>
    <section class="equipo-media" aria-label="Galería y video de ${html(equipo.nombre)}">
        <div class="equipo-media-heading"><p>Dentro del diamante</p><h2>En nuestra casa</h2></div>
        <div class="equipo-gallery">${gallery.map((foto, index) => `<button type="button" class="equipo-gallery-item" data-gallery-index="${index}" aria-label="Ampliar imagen: ${html(foto.alt || equipo.nombre)}">${image(foto.imagen, foto.alt || equipo.nombre)}<span aria-hidden="true">${icon('M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5')}</span></button>`).join('')}</div>
        <section class="equipo-video" aria-labelledby="equipo-video-title">
            <div class="equipo-video-title"><div><p>En movimiento</p><h2 id="equipo-video-title">${html(video?.titulo || 'Videos del equipo')}</h2></div>${videoReady ? `<button class="equipo-filter-launch" type="button" data-open-video="filters" aria-label="Abrir video con filtros">${magicIcon}<span>Filtros</span></button>` : ''}</div>
            ${videoReady ? `<button type="button" class="equipo-video-cover" data-open-video="play" aria-label="Reproducir ${html(video.titulo)}">${image(video.poster || d.estadio.imagen, '')}<span class="equipo-play">${playIcon}</span><span class="equipo-watch-label">Ver video</span></button>` : '<p class="equipo-empty">Próximamente habrá un video de este equipo.</p>'}
        </section>
    </section>
    <dialog class="equipo-dialog equipo-video-dialog" id="equipo-video-dialog" aria-labelledby="video-dialog-title">
        <div class="equipo-dialog-head"><h2 id="video-dialog-title">${html(video?.titulo || 'Video del equipo')}</h2><button type="button" class="equipo-close" data-close-dialog aria-label="Cerrar video">${closeIcon}</button></div>
        <div class="equipo-video-stage" id="equipo-video-stage"></div>
        <fieldset class="equipo-video-filters"><legend>Elige tu filtro</legend><div>${Object.entries(FILTROS_VIDEO).map(([key, filter]) => `<button type="button" data-filter="${key}" aria-pressed="${key === 'original'}">${filter.nombre}</button>`).join('')}</div></fieldset>
        <p class="equipo-filter-note">Los filtros se quitan al cerrar el video.</p>
        ${video?.fuente ? `<a class="equipo-text-link" href="${html(video.fuente)}" target="_blank" rel="noopener noreferrer">Ver en la fuente original ${icon('M7 17 17 7M7 7h10v10')}</a>` : ''}
    </dialog>
    <dialog class="equipo-dialog equipo-photo-dialog" id="equipo-photo-dialog" aria-labelledby="photo-dialog-title"><div class="equipo-dialog-head"><h2 id="photo-dialog-title">Galería de ${html(equipo.nombre)}</h2><button type="button" class="equipo-close" data-close-dialog aria-label="Cerrar imagen">${closeIcon}</button></div><figure><img id="equipo-photo" alt=""><figcaption id="equipo-photo-caption"></figcaption></figure><div class="equipo-photo-controls"><button type="button" data-photo-step="-1" aria-label="Imagen anterior">${icon('m14 6-6 6 6 6')}</button><span id="equipo-photo-count"></span><button type="button" data-photo-step="1" aria-label="Imagen siguiente">${icon('m10 6 6 6-6 6')}</button></div></dialog>`;
}

function iniciarMedios(container, equipo, signal) {
    const videoDialog = container.querySelector('#equipo-video-dialog');
    const photoDialog = container.querySelector('#equipo-photo-dialog');
    const stage = container.querySelector('#equipo-video-stage');
    const gallery = equipo.detalles.galeria;
    let photoIndex = 0;
    let opener;
    const setFilter = key => {
        stage.style.filter = FILTROS_VIDEO[key]?.css || 'none';
        videoDialog.querySelectorAll('[data-filter]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === key)));
    };
    const resetVideo = () => {
        stage.querySelector('video')?.pause();
        stage.replaceChildren(); // Destruye el iframe y detiene su audio.
        setFilter('original');
    };
    const showPhoto = index => {
        photoIndex = (index + gallery.length) % gallery.length;
        const foto = gallery[photoIndex];
        const img = container.querySelector('#equipo-photo');
        img.src = foto.imagen;
        img.alt = foto.alt || equipo.nombre;
        container.querySelector('#equipo-photo-caption').textContent = img.alt;
        container.querySelector('#equipo-photo-count').textContent = `${photoIndex + 1} / ${gallery.length}`;
    };
    const openDialog = (dialog, button) => {
        opener = button;
        dialog.showModal();
        document.documentElement.classList.add('equipo-media-open');
    };
    [videoDialog, photoDialog].forEach(dialog => {
        dialog.addEventListener('close', () => {
            if (dialog === videoDialog) resetVideo();
            document.documentElement.classList.remove('equipo-media-open');
            if (!signal?.aborted && opener?.isConnected) opener.focus({ preventScroll: true });
        });
        dialog.addEventListener('click', event => {
            if (event.target !== dialog) return;
            const box = dialog.getBoundingClientRect();
            if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) dialog.close();
        });
    });
    container.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button) return;
        if (button.hasAttribute('data-close-dialog')) return button.closest('dialog').close();
        if (button.dataset.filter) return setFilter(button.dataset.filter);
        if (button.dataset.galleryIndex !== undefined) {
            showPhoto(Number(button.dataset.galleryIndex));
            openDialog(photoDialog, button);
        }
        if (button.dataset.photoStep) showPhoto(photoIndex + Number(button.dataset.photoStep));
        if (button.dataset.openVideo) {
            resetVideo();
            const data = equipo.detalles.video;
            const src = fuenteVideo(data);
            if (!src) return;
            const player = document.createElement(data.tipo === 'youtube' ? 'iframe' : 'video');
            player.src = src;
            if (data.tipo === 'youtube') {
                player.title = data.titulo;
                player.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
                player.allowFullscreen = true;
                player.referrerPolicy = 'strict-origin-when-cross-origin';
            } else {
                player.controls = true;
                player.playsInline = true;
                player.poster = data.poster;
                player.addEventListener('error', () => {
                    const notice = document.createElement('p');
                    notice.className = 'equipo-empty';
                    notice.textContent = 'No se pudo cargar el video. Puedes abrir la fuente original.';
                    stage.replaceChildren(notice);
                }, { once: true });
            }
            stage.append(player);
            openDialog(videoDialog, button);
            if (button.dataset.openVideo === 'filters') videoDialog.querySelector('[data-filter="original"]').focus();
        }
    }, signal ? { signal } : undefined);
    photoDialog.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); showPhoto(photoIndex + (event.key === 'ArrowRight' ? 1 : -1)); }
    });
    signal?.addEventListener('abort', () => {
        resetVideo();
        videoDialog.close();
        photoDialog.close();
        document.documentElement.classList.remove('equipo-media-open');
    }, { once: true });
    container.querySelectorAll('img').forEach(img => img.addEventListener('error', () => {
        const placeholder = document.createElement('span');
        placeholder.className = 'equipo-image-empty';
        placeholder.textContent = img.alt || 'Imagen no disponible';
        img.replaceWith(placeholder);
    }, { once: true }));
}

export async function cargarDetalleEquipo(signal) {
    const container = document.getElementById('equipo-detalle-container');
    if (!container) return;
    const equipoId = new URLSearchParams(location.search).get('id');
    const errorView = message => {
        container.innerHTML = `<section class="equipo-error"><h1>${html(message)}</h1><p>Explora los equipos desde el inicio.</p><a class="equipo-action" href="${ruta(RUTAS.inicio)}">Volver a los equipos</a></section>`;
        container.setAttribute('aria-busy', 'false');
    };
    if (!equipoId) return errorView('Elige un equipo');
    try {
        const equipos = await obtenerEquipos();
        if (signal?.aborted || !container.isConnected) return;
        const equipo = equipos.find(item => item.id === equipoId);
        if (!equipo) return errorView('No encontramos ese equipo');
        container.style.setProperty('--equipo-primary', equipo.colores.primario);
        container.style.setProperty('--equipo-secondary', equipo.colores.secundario);
        container.innerHTML = detalleTemplate(equipo, equipos);
        container.setAttribute('aria-busy', 'false');
        document.title = `${equipo.nombre} | Zona Diamante`;
        iniciarMedios(container, equipo, signal);
    } catch (error) {
        if (signal?.aborted || !container.isConnected) return;
        console.error('No se pudo cargar el detalle del equipo:', error);
        errorView('No pudimos cargar el equipo');
    }
}
