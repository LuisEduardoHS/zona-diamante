import { renderBottomNav, actualizarBottomNav } from '../components/BottonNav.js?v=20260927-2';
import { renderHeader, cerrarMenu, actualizarHeader } from '../components/Header.js?v=20260930-1';
import { iniciarNavegacion } from './navegacion.js?v=20260930-1';

import { configurarProveedorAutenticacion } from '../features/auth/service.js';
import { proveedorSupabase } from '../features/auth/supabase-provider.js';

configurarProveedorAutenticacion(proveedorSupabase);

renderHeader();
renderBottomNav();
actualizarBottomNav();

iniciarNavegacion(() => {
    cerrarMenu();
    actualizarHeader();
    actualizarBottomNav();
});
