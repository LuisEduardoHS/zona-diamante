import { solicitarRestablecimiento } from './service.js';
import { establecerEstado, establecerFormularioCargando, mensajeErrorAutenticacion, mostrarPrimerError } from './auth-ui.js';

export function iniciarRecuperacion() {
    const formulario = document.getElementById('recuperar-form');
    const estado = document.getElementById('recuperar-estado');
    const exito = document.getElementById('recuperar-exito');
    if (!formulario || !estado || !exito) return;
    formulario.addEventListener('input', () => establecerEstado(estado));
    formulario.addEventListener('submit', async event => {
        event.preventDefault();
        if (mostrarPrimerError(formulario)) return;
        establecerFormularioCargando(formulario, true, 'Enviando enlace…');
        try {
            await solicitarRestablecimiento({ email: formulario.elements.email.value.trim().toLowerCase() });
            formulario.hidden = true;
            exito.hidden = false;
            exito.focus();
        } catch (error) {
            establecerEstado(estado, mensajeErrorAutenticacion(error), error?.code === 'AUTH_NOT_CONFIGURED' ? 'info' : 'error');
        } finally {
            establecerFormularioCargando(formulario, false);
        }
    });
}
