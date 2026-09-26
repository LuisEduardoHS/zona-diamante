import { iniciarControlesContrasena, mostrarPrimerError } from './auth-ui.js';

export function iniciarRegistro() {
    const formulario = document.getElementById('crear-cuenta-form');
    const estado = document.getElementById('registro-estado');
    const pasos = [...formulario?.querySelectorAll('[data-paso]') || []];
    const progreso = document.getElementById('registro-paso');
    const siguiente = [...formulario?.querySelectorAll('.registro-siguiente') || []];
    const anterior = formulario?.querySelector('.registro-anterior');
    const indicadores = [...formulario?.querySelectorAll('[data-progreso]') || []];
    const foto = document.getElementById('registro-foto');
    const nombreFoto = document.getElementById('registro-foto-nombre');
    if (!formulario || !estado || !pasos.length || !progreso || !anterior) return;

    iniciarControlesContrasena(formulario);
    formulario.addEventListener('input', () => { estado.textContent = ''; });

    let pasoActual = 0;
    const nombresPasos = ['Tu correo', 'Tu contraseña', 'Confirmación', 'Tu foto'];
    const mostrarPaso = (indice, enfocar = true) => {
        pasoActual = Math.max(0, Math.min(indice, pasos.length - 1));
        pasos.forEach((paso, indicePaso) => { paso.hidden = indicePaso !== pasoActual; });
        anterior.hidden = pasoActual === 0;
        indicadores.forEach((indicador, indicePaso) => indicador.dataset.activo = String(indicePaso <= pasoActual));
        progreso.textContent = `Paso ${pasoActual + 1} de ${pasos.length} · ${nombresPasos[pasoActual]}`;
        if (enfocar) pasos[pasoActual].querySelector('input')?.focus();
    };

    siguiente.forEach((boton, indice) => boton.addEventListener('click', () => {
        const campo = pasos[indice].querySelector('input');
        if (!campo.checkValidity()) {
            campo.reportValidity();
            return;
        }
        if (indice === 2) {
            const contrasena = document.getElementById('registro-contrasena');
            if (campo.value !== contrasena.value) {
                campo.setCustomValidity('Las contraseñas no coinciden.');
                campo.reportValidity();
                campo.setCustomValidity('');
                return;
            }
        }
        mostrarPaso(indice + 1);
    }));

    anterior.addEventListener('click', () => mostrarPaso(pasoActual - 1));
    foto?.addEventListener('change', () => {
        nombreFoto.textContent = foto.files?.[0]?.name || 'JPG, PNG o WebP.';
    });

    formulario.addEventListener('submit', (event) => {
        event.preventDefault();
        if (mostrarPrimerError(formulario)) return;
        estado.textContent = 'La creación de cuentas estará disponible próximamente.';
    });

    mostrarPaso(0, false);
}
