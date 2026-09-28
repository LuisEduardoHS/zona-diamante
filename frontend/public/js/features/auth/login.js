import { iniciarSesion } from './service.js';
import { establecerEstadoSesion } from './session.js';
import { RUTAS, ruta, rutaInterna } from '../../app/rutas.js';
import { establecerEstado, establecerFormularioCargando, iniciarControlesContrasena, mensajeErrorAutenticacion, mostrarPrimerError } from './auth-ui.js';

export function iniciarLogin() {
    const formularioLogin = document.getElementById('login-form');
    const estadoLogin = document.getElementById('login-estado');

    if (!formularioLogin || !estadoLogin) return;

    iniciarControlesContrasena(formularioLogin);
    const parametros = new URLSearchParams(location.search);
    if (parametros.get('password') === 'updated') establecerEstado(estadoLogin, 'Contraseña actualizada. Ya puedes iniciar sesión.', 'success');
    formularioLogin.addEventListener('input', () => establecerEstado(estadoLogin));

    formularioLogin.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (mostrarPrimerError(formularioLogin)) return;
        establecerFormularioCargando(formularioLogin, true, 'Iniciando sesión…');
        establecerEstado(estadoLogin, 'Comprobando tus datos…');
        try {
            const resultado = await iniciarSesion({
                email: formularioLogin.elements.correo.value.trim().toLowerCase(),
                password: formularioLogin.elements.contrasena.value
            });
            establecerEstadoSesion(resultado || {});
            const siguiente = parametros.get('next');
            const destino = siguiente && rutaInterna(new URL(siguiente, location.href))?.url;
            location.assign(destino?.href || ruta(RUTAS.perfil));
        } catch (error) {
            establecerEstado(estadoLogin, mensajeErrorAutenticacion(error), error?.code === 'AUTH_NOT_CONFIGURED' ? 'info' : 'error');
        } finally {
            establecerFormularioCargando(formularioLogin, false);
        }
    });
}
