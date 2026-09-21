import { ruta } from '../rutas.js';

const secciones = [
    ['index.html', 'Inicio', 'Tu zona de béisbol', 'M3 10 12 3l9 7v10h-6v-6H9v6H3z'],
    ['trivia.html', 'Trivia', 'Pon a prueba lo que sabes', 'M9 8a3 3 0 0 1 6 0c0 3-3 2-3 5m0 4h.01'],
    ['juego.html', 'Juego', 'Entra al campo', 'M7 8h10a4 4 0 0 1 4 4v4a3 3 0 0 1-5 2l-2-2h-4l-2 2a3 3 0 0 1-5-2v-4a4 4 0 0 1 4-4zM7 10v4m-2-2h4m7-1h.01m2 3h.01'],
    ['camara.html', 'Cámara AR', 'Escanea y descubre', 'M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M3 16v3a2 2 0 0 0 2 2h3m8 0h3a2 2 0 0 0 2-2v-3M8 12a4 4 0 1 0 8 0 4 4 0 0 0-8 0'],
    ['pages/coleccion.html', 'Colección', 'Tus cartas de jugadores', 'M7 4h12v16H7zM4 7v13a3 3 0 0 0 3 3m4-15h4m-4 4h4m-4 4h4'],
    ['Informacion.html', 'Información', 'Conoce Zona Diamante', 'M12 11v6m0-10h.01M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0'],
    ['Ayuda.html', 'Ayuda', 'Todo para empezar', 'M4 13v-1a8 8 0 0 1 16 0v1M4 12H2v6h4v-6zm16 0h2v6h-4v-6zm0 6c0 3-4 3-8 3']
];
const icono = path => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;

let animacionMenu;
let cerrando = false;
const duracionMenu = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 280;

export function cerrarMenu() {
    const dialogo = document.getElementById('menu-overlay');
    if (!dialogo?.open || cerrando) return;
    cerrando = true;
    const desde = getComputedStyle(dialogo).transform;
    animacionMenu?.cancel();
    animacionMenu = dialogo.animate([
        { transform: desde }, { transform: 'translateX(100vw)' }
    ], { duration: duracionMenu(), easing: 'cubic-bezier(.4, 0, 1, 1)', fill: 'forwards' });
    animacionMenu.finished.then(() => {
        dialogo.close();
        animacionMenu.cancel();
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
            <button id="btn-cerrar-menu" type="button" aria-label="Cerrar menú" autofocus>${icono('m6 6 12 12M6 18 18 6')}</button>
            <nav class="site-menu-links" aria-label="Menú principal">
                ${[['Principal', secciones.slice(0, 3)], ['Experiencia', secciones.slice(3, 5)], ['Información', secciones.slice(5)]].map(([grupo, enlaces]) => `
                    <section class="site-menu-group" aria-label="${grupo}">
                        <p class="site-menu-group-title">${grupo}</p>
                        ${enlaces.map(([path, nombre, , dibujo]) => `<a class="site-menu-link" href="${ruta(path)}"><span class="site-menu-icon">${icono(dibujo)}</span><span>${path === 'Informacion.html' ? 'Info' : nombre}</span></a>`).join('')}
                    </section>`).join('')}
            </nav>
        </dialog>`;
    const dialogo = document.getElementById('menu-overlay');
    const abrir = document.getElementById('btn-abrir-menu');
    abrir.addEventListener('click', () => {
        actualizarHeader();
        animacionMenu?.cancel();
        cerrando = false;
        dialogo.showModal();
        animacionMenu = dialogo.animate([
            { transform: 'translateX(100vw)' }, { transform: 'translateX(0)' }
        ], { duration: duracionMenu(), easing: 'cubic-bezier(.16, 1, .3, 1)' });
        abrir.setAttribute('aria-expanded', 'true');
        document.documentElement.classList.add('menu-abierto');
    });
    document.getElementById('btn-cerrar-menu').addEventListener('click', cerrarMenu);
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
