import { renderBottomNav, actualizarBottomNav } from '../components/BottonNav.js?v=20260927-2';
import { renderHeader, cerrarMenu, actualizarHeader } from '../components/Header.js?v=20260927-2';
import { iniciarNavegacion } from './navegacion.js?v=20260927-14';

renderHeader();
renderBottomNav();
actualizarBottomNav();
iniciarNavegacion(() => {
    cerrarMenu();
    actualizarHeader();
    actualizarBottomNav();
});
