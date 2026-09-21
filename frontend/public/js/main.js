import { renderBottomNav, actualizarBottomNav } from './components/BottonNav.js';
import { renderHeader, cerrarMenu, actualizarHeader } from './components/Header.js';
import { iniciarNavegacion } from './navegacion.js';

renderHeader();
renderBottomNav();
actualizarBottomNav();
iniciarNavegacion(() => {
    cerrarMenu();
    actualizarHeader();
    actualizarBottomNav();
});
