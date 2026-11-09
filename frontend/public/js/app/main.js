import { renderBottomNav, actualizarBottomNav } from '../components/BottonNav.js?v=20260927-2';
import { renderHeader, cerrarMenu, actualizarHeader } from '../components/Header.js?v=20261108-partidos';
import { iniciarNavegacion } from './navegacion.js?v=20261109-email';

import { configurarProveedorAutenticacion } from '../features/auth/service.js';
import { proveedorSupabase } from '../features/auth/supabase-provider.js';
import { iniciarPremiosPendientesJuego } from '../features/juego/game-rewards.js';

configurarProveedorAutenticacion(proveedorSupabase);
iniciarPremiosPendientesJuego();

renderHeader();
renderBottomNav();
actualizarBottomNav();

iniciarNavegacion(() => {
    cerrarMenu();
    actualizarHeader();
    actualizarBottomNav();
});
