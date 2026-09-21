import { renderBottomNav, actualizarBottomNav } from './components/BottonNav.js?v=20260921-1';
import { renderHeader, cerrarMenu, actualizarHeader } from './components/Header.js?v=20260921-1';
import { iniciarNavegacion } from './navegacion.js?v=20260921-1';

renderHeader();
renderBottomNav();
actualizarBottomNav();
iniciarNavegacion(() => {
    cerrarMenu();
    actualizarHeader();
    actualizarBottomNav();
});
