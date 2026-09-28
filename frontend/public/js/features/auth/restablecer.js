import { restablecerContrasena } from './service.js';
import { RUTAS, ruta } from '../../app/rutas.js';
import { establecerEstado, establecerFormularioCargando, iniciarControlesContrasena, iniciarRequisitosContrasena, mensajeErrorAutenticacion, mostrarPrimerError, validarContrasenasIguales } from './auth-ui.js';

export function iniciarRestablecimiento() {
    const formulario = document.getElementById('restablecer-form');
    const estado = document.getElementById('restablecer-estado');
    const contrasena = document.getElementById('restablecer-contrasena');
    const confirmar = document.getElementById('restablecer-confirmar');
    if (!formulario || !estado) return;
    iniciarControlesContrasena(formulario);
    iniciarRequisitosContrasena(contrasena, formulario);
    const comprobar = () => validarContrasenasIguales(contrasena, confirmar);
    contrasena.addEventListener('input', comprobar);
    confirmar.addEventListener('input', comprobar);
    formulario.addEventListener('input', () => establecerEstado(estado));
    formulario.addEventListener('submit', async event => {
        event.preventDefault();
        comprobar();
        if (mostrarPrimerError(formulario)) return;
        establecerFormularioCargando(formulario, true, 'Guardando…');
        try {
            await restablecerContrasena({ password: contrasena.value });
            location.assign(`${ruta(RUTAS.login)}?password=updated`);
        } catch (error) {
            establecerEstado(estado, mensajeErrorAutenticacion(error), error?.code === 'AUTH_NOT_CONFIGURED' ? 'info' : 'error');
        } finally {
            establecerFormularioCargando(formulario, false);
        }
    });
}
