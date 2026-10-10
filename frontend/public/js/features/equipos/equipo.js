import { obtenerEquipos } from '../../services/datos-equipos.js?v=20261010-2';
import { RUTAS, ruta } from '../../app/rutas.js';

const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
// Font Awesome Free, Classic Solid — CC BY 4.0. See assets/icons/fontawesome/LICENSE.txt
const FA_ICONS = {
    "xmark": {
        "viewBox": "0 0 384 512",
        "body": "<!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill=\"currentColor\" d=\"M55.1 73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L147.2 256 9.9 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L192.5 301.3 329.9 438.6c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L237.8 256 375.1 118.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L192.5 210.7 55.1 73.4z\"/>"
    },
    "play": {
        "viewBox": "0 0 448 512",
        "body": "<!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill=\"currentColor\" d=\"M91.2 36.9c-12.4-6.8-27.4-6.5-39.6 .7S32 57.9 32 72l0 368c0 14.1 7.5 27.2 19.6 34.4s27.2 7.5 39.6 .7l336-184c12.8-7 20.8-20.5 20.8-35.1s-8-28.1-20.8-35.1l-336-184z\"/>"
    },
    "wand-magic-sparkles": {
        "viewBox": "0 0 576 512",
        "body": "<!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill=\"currentColor\" d=\"M263.4-27L278.2 9.8 315 24.6c3 1.2 5 4.2 5 7.4s-2 6.2-5 7.4L278.2 54.2 263.4 91c-1.2 3-4.2 5-7.4 5s-6.2-2-7.4-5L233.8 54.2 197 39.4c-3-1.2-5-4.2-5-7.4s2-6.2 5-7.4L233.8 9.8 248.6-27c1.2-3 4.2-5 7.4-5s6.2 2 7.4 5zM110.7 41.7l21.5 50.1 50.1 21.5c5.9 2.5 9.7 8.3 9.7 14.7s-3.8 12.2-9.7 14.7l-50.1 21.5-21.5 50.1c-2.5 5.9-8.3 9.7-14.7 9.7s-12.2-3.8-14.7-9.7L59.8 164.2 9.7 142.7C3.8 140.2 0 134.4 0 128s3.8-12.2 9.7-14.7L59.8 91.8 81.3 41.7C83.8 35.8 89.6 32 96 32s12.2 3.8 14.7 9.7zM464 304c6.4 0 12.2 3.8 14.7 9.7l21.5 50.1 50.1 21.5c5.9 2.5 9.7 8.3 9.7 14.7s-3.8 12.2-9.7 14.7l-50.1 21.5-21.5 50.1c-2.5 5.9-8.3 9.7-14.7 9.7s-12.2-3.8-14.7-9.7l-21.5-50.1-50.1-21.5c-5.9-2.5-9.7-8.3-9.7-14.7s3.8-12.2 9.7-14.7l50.1-21.5 21.5-50.1c2.5-5.9 8.3-9.7 14.7-9.7zM460 0c11 0 21.6 4.4 29.5 12.2l42.3 42.3C539.6 62.4 544 73 544 84s-4.4 21.6-12.2 29.5l-88.2 88.2-101.3-101.3 88.2-88.2C438.4 4.4 449 0 460 0zM44.2 398.5L308.4 134.3 409.7 235.6 145.5 499.8C137.6 507.6 127 512 116 512s-21.6-4.4-29.5-12.2L44.2 457.5C36.4 449.6 32 439 32 428s4.4-21.6 12.2-29.5z\"/>"
    },
    "arrow-up-right-from-square": {
        "viewBox": "0 0 512 512",
        "body": "<!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill=\"currentColor\" d=\"M320 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l82.7 0-201.4 201.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0L448 109.3 448 192c0 17.7 14.3 32 32 32s32-14.3 32-32l0-160c0-17.7-14.3-32-32-32L320 0zM80 96C35.8 96 0 131.8 0 176L0 432c0 44.2 35.8 80 80 80l256 0c44.2 0 80-35.8 80-80l0-80c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 80c0 8.8-7.2 16-16 16L80 448c-8.8 0-16-7.2-16-16l0-256c0-8.8 7.2-16 16-16l80 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L80 96z\"/>"
    },
    "location-dot": {
        "viewBox": "0 0 384 512",
        "body": "<!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill=\"currentColor\" d=\"M0 188.6C0 84.4 86 0 192 0S384 84.4 384 188.6c0 119.3-120.2 262.3-170.4 316.8-11.8 12.8-31.5 12.8-43.3 0-50.2-54.5-170.4-197.5-170.4-316.8zM192 256a64 64 0 1 0 0-128 64 64 0 1 0 0 128z\"/>"
    },
    "trophy": {
        "viewBox": "0 0 512 512",
        "body": "<!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill=\"currentColor\" d=\"M144.3 0l224 0c26.5 0 48.1 21.8 47.1 48.2-.2 5.3-.4 10.6-.7 15.8l49.6 0c26.1 0 49.1 21.6 47.1 49.8-7.5 103.7-60.5 160.7-118 190.5-15.8 8.2-31.9 14.3-47.2 18.8-20.2 28.6-41.2 43.7-57.9 51.8l0 73.1 64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-192 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l64 0 0-73.1c-16-7.7-35.9-22-55.3-48.3-18.4-4.8-38.4-12.1-57.9-23.1-54.1-30.3-102.9-87.4-109.9-189.9-1.9-28.1 21-49.7 47.1-49.7l49.6 0c-.3-5.2-.5-10.4-.7-15.8-1-26.5 20.6-48.2 47.1-48.2zM101.5 112l-52.4 0c6.2 84.7 45.1 127.1 85.2 149.6-14.4-37.3-26.3-86-32.8-149.6zM380 256.8c40.5-23.8 77.1-66.1 83.3-144.8L411 112c-6.2 60.9-17.4 108.2-31 144.8z\"/>"
    },
    "expand": {
        "viewBox": "0 0 448 512",
        "body": "<!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill=\"currentColor\" d=\"M32 32C14.3 32 0 46.3 0 64l0 96c0 17.7 14.3 32 32 32s32-14.3 32-32l0-64 64 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 32zM64 352c0-17.7-14.3-32-32-32S0 334.3 0 352l0 96c0 17.7 14.3 32 32 32l96 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0 0-64zM320 32c-17.7 0-32 14.3-32 32s14.3 32 32 32l64 0 0 64c0 17.7 14.3 32 32 32s32-14.3 32-32l0-96c0-17.7-14.3-32-32-32l-96 0zM448 352c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 64-64 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l96 0c17.7 0 32-14.3 32-32l0-96z\"/>"
    },
    "chevron-left": {
        "viewBox": "0 0 320 512",
        "body": "<!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill=\"currentColor\" d=\"M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z\"/>"
    },
    "chevron-right": {
        "viewBox": "0 0 320 512",
        "body": "<!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill=\"currentColor\" d=\"M311.1 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L243.2 256 73.9 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z\"/>"
    },
    "plus": {
        "viewBox": "0 0 448 512",
        "body": "<!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill=\"currentColor\" d=\"M256 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 160-160 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l160 0 0 160c0 17.7 14.3 32 32 32s32-14.3 32-32l0-160 160 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-160 0 0-160z\"/>"
    },
    "minus": {
        "viewBox": "0 0 448 512",
        "body": "<!--! Font Awesome Free 7.3.1 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free (Icons: CC BY 4.0, Fonts: SIL OFL 1.1, Code: MIT License) Copyright 2026 Fonticons, Inc. --><path fill=\"currentColor\" d=\"M0 256c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 288c-17.7 0-32-14.3-32-32z\"/>"
    }
};
const icon = name => { const item = FA_ICONS[name]; return `<svg viewBox="${item.viewBox}" fill="currentColor" aria-hidden="true" focusable="false">${item.body}</svg>`; };
const closeIcon = icon('xmark');
const playIcon = icon('play');
const magicIcon = icon('wand-magic-sparkles');
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
            ${d.calendarioUrl ? `<a class="equipo-text-link" href="${html(d.calendarioUrl)}" target="_blank" rel="noopener noreferrer">Consultar sitio oficial ${icon('arrow-up-right-from-square')}</a>` : ''}
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
            <summary class="equipo-section-bar">Estadísticas <span class="equipo-disclosure-icon" aria-hidden="true"><span class="equipo-disclosure-plus">${icon('plus')}</span><span class="equipo-disclosure-minus">${icon('minus')}</span></span></summary>
            <div class="equipo-statistics-body">
                <h3 class="equipo-pill">Historia y campeonatos</h3>
                <p class="equipo-history">${html(d.historia || 'Próximamente conocerás más sobre la historia del equipo.')}</p>
                <dl class="equipo-stats">${stats.map(([label, data, type]) => `<div class="equipo-stat ${type ? 'equipo-stat--wide' : ''}"><dt>${label}</dt><dd>${value(data)}</dd></div>`).join('')}</dl>
            </div>
        </details>
        <figure class="equipo-stadium">${image(d.estadio.imagen, d.estadio.nombre, d.estadio.recorteSuperior ? 'equipo-crop-top' : '')}<figcaption><span>${icon('location-dot')}${html(d.estadio.ubicacion || equipo.ciudad)}</span><h2>${html(d.estadio.nombre || 'Estadio por confirmar')}</h2></figcaption></figure>
        <section class="equipo-mascot equipo-card" aria-label="Mascota del equipo">${image(d.mascota.imagen, d.mascota.nombre)}<div><h2>${html(d.mascota.nombre || 'Mascota')}</h2><p>La energía de<br>nuestra afición.</p></div></section>
        ${d.palmares.length ? `<section class="equipo-honours" aria-label="Palmarés"><ul>${d.palmares.map(titulo => `<li>${icon('trophy')}${html(titulo)}</li>`).join('')}</ul></section>` : ''}
        <figure class="equipo-mvp">${image(d.mvp.imagen, d.mvp.nombre)}<span class="equipo-mvp-badge">MVP</span><figcaption><h2>${html(d.mvp.nombre || 'Jugador destacado')}</h2></figcaption></figure>
        ${calendarioTemplate(equipo, equipos)}
    </div>
    <section class="equipo-media" aria-label="Galería y video de ${html(equipo.nombre)}">
        <div class="equipo-media-heading"><p>Dentro del diamante</p><h2>En nuestra casa</h2></div>
        <div class="equipo-gallery">${gallery.map((foto, index) => `<button type="button" class="equipo-gallery-item" data-gallery-index="${index}" aria-label="Ampliar imagen: ${html(foto.alt || equipo.nombre)}">${image(foto.imagen, foto.alt || equipo.nombre)}<span aria-hidden="true">${icon('expand')}</span></button>`).join('')}</div>
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
        ${video?.fuente ? `<a class="equipo-text-link" href="${html(video.fuente)}" target="_blank" rel="noopener noreferrer">Ver en la fuente original ${icon('arrow-up-right-from-square')}</a>` : ''}
    </dialog>
    <dialog class="equipo-dialog equipo-photo-dialog" id="equipo-photo-dialog" aria-labelledby="photo-dialog-title"><div class="equipo-dialog-head"><h2 id="photo-dialog-title">Galería de ${html(equipo.nombre)}</h2><button type="button" class="equipo-close" data-close-dialog aria-label="Cerrar imagen">${closeIcon}</button></div><figure><img id="equipo-photo" alt=""><figcaption id="equipo-photo-caption"></figcaption><a id="equipo-photo-credit" class="equipo-text-link" target="_blank" rel="noopener noreferrer" hidden></a></figure><div class="equipo-photo-controls"><button type="button" data-photo-step="-1" aria-label="Imagen anterior">${icon('chevron-left')}</button><span id="equipo-photo-count"></span><button type="button" data-photo-step="1" aria-label="Imagen siguiente">${icon('chevron-right')}</button></div></dialog>`;
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
        const credit = container.querySelector('#equipo-photo-credit');
        credit.hidden = !foto.fuente;
        if (foto.fuente) {
            credit.href = foto.fuente;
            credit.textContent = `Foto: ${foto.credito || 'Fuente original'}`;
        } else credit.removeAttribute('href');
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

export function iniciarRevelado(container, signal) {
    if (signal?.aborted || typeof IntersectionObserver === 'undefined') return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (motion.matches) return;
    const animations = new Set();
    let stopped = false;
    const observer = new IntersectionObserver(entries => {
        if (stopped) return;
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            observer.unobserve(entry.target);
            if (typeof entry.target.animate !== 'function') continue;
            const animation = entry.target.animate([
                { opacity: 0, transform: 'translateY(22px)' },
                { opacity: 1, transform: 'translateY(0)' }
            ], { duration: 520, easing: 'cubic-bezier(.2,.65,.3,1)' });
            animations.add(animation);
            animation.finished.catch(() => {}).finally(() => animations.delete(animation));
        }
    }, { threshold: 0.08 });
    container.querySelectorAll('.equipo-sections > *, .equipo-media-heading, .equipo-gallery-item, .equipo-video').forEach(element => observer.observe(element));
    const cleanup = () => {
        stopped = true;
        observer.disconnect();
        animations.forEach(animation => animation.cancel());
        animations.clear();
        motion.removeEventListener('change', onMotionChange);
    };
    const onMotionChange = event => { if (event.matches) cleanup(); };
    motion.addEventListener('change', onMotionChange);
    signal?.addEventListener('abort', cleanup, { once: true });
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
        iniciarRevelado(container, signal);
    } catch (error) {
        if (signal?.aborted || !container.isConnected) return;
        console.error('No se pudo cargar el detalle del equipo:', error);
        errorView('No pudimos cargar el equipo');
    }
}
