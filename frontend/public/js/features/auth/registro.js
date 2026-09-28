import { crearCuenta } from './service.js';
import { establecerEstadoSesion } from './session.js';
import { RUTAS, ruta } from '../../app/rutas.js';
import { configurarNombreUsuario, establecerEstado, establecerFormularioCargando, iniciarControlesContrasena, iniciarRequisitosContrasena, mensajeErrorAutenticacion, mostrarPrimerError, validarContrasenasIguales } from './auth-ui.js';

export function iniciarRegistro() {
    const formulario = document.getElementById('crear-cuenta-form');
    const estado = document.getElementById('registro-estado');
    const pasos = [...formulario?.querySelectorAll('[data-paso]') || []];
    const progreso = document.getElementById('registro-paso');
    const siguiente = [...formulario?.querySelectorAll('.registro-siguiente') || []];
    const anterior = formulario?.querySelector('.registro-anterior');
    const indicadores = [...formulario?.querySelectorAll('[data-progreso]') || []];
    const exito = document.getElementById('registro-exito');
    const correoConfirmacion = document.getElementById('registro-correo-confirmacion');
    const usuario = document.getElementById('registro-usuario');
    const contrasena = document.getElementById('registro-contrasena');
    const confirmar = document.getElementById('registro-confirmar');
    if (!formulario || !estado || !pasos.length || !progreso || !anterior) return;

    iniciarControlesContrasena(formulario);
    configurarNombreUsuario(usuario);
    iniciarRequisitosContrasena(contrasena, formulario);
    const comprobarCoincidencia = () => validarContrasenasIguales(contrasena, confirmar);
    contrasena?.addEventListener('input', comprobarCoincidencia);
    confirmar?.addEventListener('input', comprobarCoincidencia);
    formulario.addEventListener('input', () => establecerEstado(estado));

    let pasoActual = 0;
    const nombresPasos = ['Tu perfil', 'Tu correo', 'Tu contraseña'];
    const mostrarPaso = (indice, enfocar = true) => {
        pasoActual = Math.max(0, Math.min(indice, pasos.length - 1));
        pasos.forEach((paso, indicePaso) => { paso.hidden = indicePaso !== pasoActual; });
        anterior.hidden = pasoActual === 0;
        indicadores.forEach((indicador, indicePaso) => indicador.dataset.activo = String(indicePaso <= pasoActual));
        progreso.textContent = `Paso ${pasoActual + 1} de ${pasos.length} · ${nombresPasos[pasoActual]}`;
        if (enfocar) pasos[pasoActual].querySelector('input')?.focus();
    };

    siguiente.forEach((boton, indice) => boton.addEventListener('click', () => {
        const campoInvalido = pasos[indice].querySelector(':invalid');
        if (campoInvalido) {
            campoInvalido.reportValidity();
            return;
        }
        mostrarPaso(indice + 1);
    }));

    anterior.addEventListener('click', () => mostrarPaso(pasoActual - 1));

    formulario.addEventListener('submit', async (event) => {
        event.preventDefault();
        comprobarCoincidencia();
        if (mostrarPrimerError(formulario)) return;
        const email = formulario.elements.email.value.trim().toLowerCase();
        establecerFormularioCargando(formulario, true, 'Creando cuenta…');
        establecerEstado(estado, 'Preparando tu perfil…');
        try {
            const resultado = await crearCuenta({
                email,
                password: formulario.elements.contrasena.value,
                username: formulario.elements.username.value.trim().toLowerCase(),
                displayName: formulario.elements.display_name.value.trim()
            });
            if (resultado?.session) {
                establecerEstadoSesion(resultado);
                location.assign(ruta(RUTAS.perfil));
                return;
            }
            formulario.hidden = true;
            correoConfirmacion.textContent = email;
            exito.hidden = false;
            exito.focus();
        } catch (error) {
            establecerEstado(estado, mensajeErrorAutenticacion(error), error?.code === 'AUTH_NOT_CONFIGURED' ? 'info' : 'error');
        } finally {
            establecerFormularioCargando(formulario, false);
        }
    });

    mostrarPaso(0, false);
}
