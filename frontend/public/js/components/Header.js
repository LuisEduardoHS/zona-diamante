import { ruta } from '../rutas.js';

const secciones = [
    ['index.html', 'Inicio', 'Tu zona de béisbol', 'M341.8 72.6C329.5 61.2 310.5 61.2 298.3 72.6L74.3 280.6C64.7 289.6 61.5 303.5 66.3 315.7C71.1 327.9 82.8 336 96 336L112 336L112 512C112 547.3 140.7 576 176 576L464 576C499.3 576 528 547.3 528 512L528 336L544 336C557.2 336 569 327.9 573.8 315.7C578.6 303.5 575.4 289.5 565.8 280.6L341.8 72.6zM304 384L336 384C362.5 384 384 405.5 384 432L384 528L256 528L256 432C256 405.5 277.5 384 304 384z', true],
    ['trivia.html', 'Trivia', 'Pon a prueba lo que sabes', 'M353.8 118.1L330.2 70.3C326.3 62 314.1 61.7 309.8 70.3L286.2 118.1L233.9 125.6C224.6 127 220.6 138.5 227.5 145.4L265.5 182.4L256.5 234.5C255.1 243.8 264.7 251 273.3 246.7L320.2 221.9L366.8 246.3C375.4 250.6 385.1 243.4 383.6 234.1L374.6 182L412.6 145.4C419.4 138.6 415.5 127.1 406.2 125.6L353.9 118.1zM288 320C261.5 320 240 341.5 240 368L240 528C240 554.5 261.5 576 288 576L352 576C378.5 576 400 554.5 400 528L400 368C400 341.5 378.5 320 352 320L288 320zM80 384C53.5 384 32 405.5 32 432L32 528C32 554.5 53.5 576 80 576L144 576C170.5 576 192 554.5 192 528L192 432C192 405.5 170.5 384 144 384L80 384zM448 496L448 528C448 554.5 469.5 576 496 576L560 576C586.5 576 608 554.5 608 528L608 496C608 469.5 586.5 448 560 448L496 448C469.5 448 448 469.5 448 496z', true],
    ['juego.html', 'Juego', 'Entra al campo', 'M448 128C554 128 640 214 640 320C640 426 554 512 448 512L192 512C86 512 0 426 0 320C0 214 86 128 192 128L448 128zM192 240C178.7 240 168 250.7 168 264L168 296L136 296C122.7 296 112 306.7 112 320C112 333.3 122.7 344 136 344L168 344L168 376C168 389.3 178.7 400 192 400C205.3 400 216 389.3 216 376L216 344L248 344C261.3 344 272 333.3 272 320C272 306.7 261.3 296 248 296L216 296L216 264C216 250.7 205.3 240 192 240zM432 336C414.3 336 400 350.3 400 368C400 385.7 414.3 400 432 400C449.7 400 464 385.7 464 368C464 350.3 449.7 336 432 336zM496 240C478.3 240 464 254.3 464 272C464 289.7 478.3 304 496 304C513.7 304 528 289.7 528 272C528 254.3 513.7 240 496 240z', true],
    ['camara.html', 'Cámara AR', 'Escanea y descubre', 'M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0'],
    ['pages/coleccion.html', 'Colección', 'Tus cartas de jugadores', 'M288 32L352 32C369.7 32 384 46.3 384 64L384 128L256 128L256 64C256 46.3 270.3 32 288 32zM96 96L208 96L208 128C208 154.5 229.5 176 256 176L384 176C410.5 176 432 154.5 432 128L432 96L544 96C579.3 96 608 124.7 608 160L608 480C608 515.3 579.3 544 544 544L96 544C60.7 544 32 515.3 32 480L32 160C32 124.7 60.7 96 96 96zM208 464C208 472.8 215.2 480 224 480L416 480C424.8 480 432 472.8 432 464C432 419.8 396.2 384 352 384L288 384C243.8 384 208 419.8 208 464zM320 344C350.9 344 376 318.9 376 288C376 257.1 350.9 232 320 232C289.1 232 264 257.1 264 288C264 318.9 289.1 344 320 344z', true],
    ['Informacion.html', 'Información', 'Conoce Zona Diamante', 'M320 576C461.4 576 576 461.4 576 320C576 178.6 461.4 64 320 64C178.6 64 64 178.6 64 320C64 461.4 178.6 576 320 576zM288 224C288 206.3 302.3 192 320 192C337.7 192 352 206.3 352 224C352 241.7 337.7 256 320 256C302.3 256 288 241.7 288 224zM280 288L328 288C341.3 288 352 298.7 352 312L352 400L360 400C373.3 400 384 410.7 384 424C384 437.3 373.3 448 360 448L280 448C266.7 448 256 437.3 256 424C256 410.7 266.7 400 280 400L304 400L304 336L280 336C266.7 336 256 325.3 256 312C256 298.7 266.7 288 280 288z', true],
    ['Ayuda.html', 'Ayuda', 'Todo para empezar', 'M320 128C241 128 175.3 185.3 162.3 260.7C171.6 257.7 181.6 256 192 256L208 256C234.5 256 256 277.5 256 304L256 400C256 426.5 234.5 448 208 448L192 448C139 448 96 405 96 352L96 288C96 164.3 196.3 64 320 64C443.7 64 544 164.3 544 288L544 456.1C544 522.4 490.2 576.1 423.9 576.1L336 576L304 576C277.5 576 256 554.5 256 528C256 501.5 277.5 480 304 480L336 480C362.5 480 384 501.5 384 528L384 528L424 528C463.8 528 496 495.8 496 456L496 435.1C481.9 443.3 465.5 447.9 448 447.9L432 447.9C405.5 447.9 384 426.4 384 399.9L384 303.9C384 277.4 405.5 255.9 432 255.9L448 255.9C458.4 255.9 468.3 257.5 477.7 260.6C464.7 185.3 399.1 127.9 320 127.9z', true]
];
const icono = (path, relleno = false) => `<svg viewBox="${relleno ? '0 0 640 640' : '0 0 24 24'}" fill="${relleno ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
const iconoCamara = () => `<svg viewBox="0 0 56 52" fill="none" aria-hidden="true"><path d="M4.17822 47.8031C1.2817 44.8404 0.364811 39.6045 0.0991822 35.8193C-0.0936785 33.071 3.24694 29.177 4.17821 31.7698C6.13025 37.2047 4.78179 47.299 20.8448 47.7916C22.0855 47.8297 23.3856 49.2328 23.274 50.469C23.162 51.71 22.2329 51.8998 20.9881 51.9548C17.0157 52.1308 8.27267 51.9911 4.17822 47.8031Z" fill="currentColor"/><path d="M51.2355 47.8031C54.1498 44.8496 55.0785 39.6368 55.3498 35.8544C55.5484 33.0859 52.1814 29.1603 51.2355 31.7698C49.2645 37.207 50.6275 47.3076 34.3938 47.7923C33.1532 47.8293 31.8505 49.2303 31.9626 50.4664C32.0754 51.7095 33.0068 51.8991 34.2539 51.9541C38.2555 52.1308 47.0976 51.9967 51.2355 47.8031Z" fill="currentColor"/><path d="M4.2169 4.15407C1.31277 7.06726 0.38043 12.2011 0.105468 15.9416C-0.0976205 18.7044 3.26423 22.625 4.2169 20.0238C6.18878 14.6395 4.82362 4.63511 21.0816 4.16415C22.3097 4.12821 23.6016 2.74419 23.49 1.52095C23.3776 0.288111 22.453 0.100724 21.2162 0.0461953C17.223 -0.129867 8.36091 -0.00285188 4.2169 4.15407Z" fill="currentColor"/><path d="M51.2742 4.15407C54.1607 7.0764 55.0812 12.2334 55.3504 15.9769C55.5477 18.7194 52.2121 22.6085 51.2742 20.0238C49.3215 14.6418 50.6719 4.64357 34.5846 4.16475C33.3567 4.12821 32.0671 2.74174 32.1781 1.51831C32.2898 0.287629 33.212 0.100004 34.4465 0.0454976C38.4107 -0.129523 47.1736 0.00265237 51.2742 4.15407Z" fill="currentColor"/><ellipse cx="28.3994" cy="26.3994" rx="12.3994" ry="12.3993" stroke="currentColor" stroke-width="5"/></svg>`;
const cambiarIconoMenu = (boton, path) => {
    boton.classList.add('menu-icono-cambiando');
    boton.innerHTML = icono(path);
    requestAnimationFrame(() => boton.classList.remove('menu-icono-cambiando'));
};

let animacionMenu;
let cerrando = false;
const duracionMenu = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 360;

export function cerrarMenu() {
    const dialogo = document.getElementById('menu-overlay');
    const abrir = document.getElementById('btn-abrir-menu');
    if (!dialogo?.open || cerrando || !abrir) return;
    cerrando = true;
    const desde = getComputedStyle(dialogo).transform;
    animacionMenu?.cancel();
    animacionMenu = dialogo.animate([
        { transform: desde }, { transform: 'translateX(-100vw)' }
    ], { duration: duracionMenu(), easing: 'cubic-bezier(.32, .72, 0, 1)', fill: 'forwards' });
    animacionMenu.finished.then(() => {
        dialogo.close();
        animacionMenu.cancel();
        document.getElementById('header-superior').querySelector('.site-header').prepend(abrir);
        abrir.id = 'btn-abrir-menu';
        abrir.setAttribute('aria-label', 'Abrir menú');
        abrir.setAttribute('aria-expanded', 'false');
        cambiarIconoMenu(abrir, 'M5 6h14M5 12h14M5 18h14');
        cerrando = false;
    }).catch(() => { cerrando = false; });
}
export function actualizarHeader() {
    const actual = location.pathname === new URL(ruta('')).pathname ? ruta('index.html') : location.origin + location.pathname;
    document.querySelectorAll('.site-menu-link').forEach(enlace => {
        if (enlace.href === actual) enlace.setAttribute('aria-current', 'page');
        else enlace.removeAttribute('aria-current');
    });
}
export function renderHeader() {
    const contenedor = document.getElementById('header-superior');
    if (!contenedor || contenedor.children.length) return;
    contenedor.innerHTML = `
        <header class="site-header fixed top-0 left-0 w-full z-50 flex justify-between items-center px-6 py-5">
            <button id="btn-abrir-menu" type="button" aria-label="Abrir menú" aria-haspopup="dialog" aria-controls="menu-overlay" aria-expanded="false" class="shell-menu-button">${icono('M5 6h14M5 12h14M5 18h14')}</button>
            <span class="shell-brand" aria-label="Zona Diamante"><svg viewBox="0 0 41 37" fill="none" aria-hidden="true"><path d="M24.4351 11H16.4351L14.9351 12.5L20.4351 19L25.9351 12.5L24.4351 11Z" fill="#2B2B31" stroke="#2B2B31" stroke-width="22"/></svg></span>
        </header>
        <dialog id="menu-overlay" class="site-menu" aria-labelledby="menu-titulo">
            <h2 id="menu-titulo" class="sr-only">Menú principal</h2>
            <nav class="site-menu-links" aria-label="Menú principal">
                ${[['Principal', secciones.slice(0, 3)], ['Experiencia', secciones.slice(3, 5)], ['Información', secciones.slice(5)]].map(([grupo, enlaces]) => `
                    <section class="site-menu-group" aria-label="${grupo}">
                        <p class="site-menu-group-title">${grupo}</p>
                        ${enlaces.map(([path, nombre, , dibujo, relleno]) => `<a class="site-menu-link${path === 'camara.html' ? ' site-menu-link--ar' : ''}" href="${ruta(path)}"><span class="site-menu-icon">${path === 'camara.html' ? iconoCamara() : icono(dibujo, relleno)}</span><span>${path === 'Informacion.html' ? 'Info' : nombre}</span></a>`).join('')}
                    </section>`).join('')}
            </nav>
        </dialog>`;
    const dialogo = document.getElementById('menu-overlay');
    const abrir = document.getElementById('btn-abrir-menu');
    abrir.addEventListener('click', () => {
        if (dialogo.open) {
            cerrarMenu();
            return;
        }
        actualizarHeader();
        animacionMenu?.cancel();
        cerrando = false;
        abrir.setAttribute('aria-label', 'Cerrar menú');
        abrir.setAttribute('aria-expanded', 'true');
        cambiarIconoMenu(abrir, 'm6 6 12 12M6 18 18 6');
        dialogo.showModal();
        dialogo.prepend(abrir);
        animacionMenu = dialogo.animate([
            { transform: 'translateX(-100vw)' }, { transform: 'translateX(0)' }
        ], { duration: duracionMenu(), easing: 'cubic-bezier(.32, .72, 0, 1)' });
        document.documentElement.classList.add('menu-abierto');
        abrir.focus({ preventScroll: true });
    });
    dialogo.addEventListener('cancel', event => { event.preventDefault(); cerrarMenu(); });
    dialogo.addEventListener('close', () => {
        abrir.setAttribute('aria-expanded', 'false');
        document.documentElement.classList.remove('menu-abierto');
    });
    dialogo.addEventListener('click', event => {
        if (event.target.closest('a')) cerrarMenu();
        if (event.target === dialogo) {
            const rect = dialogo.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) cerrarMenu();
        }
    });
}
