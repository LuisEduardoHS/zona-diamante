import { renderBottomNav } from './components/BottonNav.js';
import { renderHeader } from './components/Header.js';
import { renderCarousel } from './components/CarouselEquipos.js';

// Siempre renderizar header y menú inferior en todas las páginas
renderHeader();
renderBottomNav();

// Solo renderizar el carrusel si existe el contenedor (solo en index.html)
renderCarousel();