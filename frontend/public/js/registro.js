export function iniciarRegistro() {
    const formulario = document.getElementById('crear-cuenta-form');
    const estado = document.getElementById('registro-estado');
    const pasos = [...formulario?.querySelectorAll('[data-paso]') || []];
    const progreso = document.getElementById('registro-paso');
    const siguiente = [...formulario?.querySelectorAll('.registro-siguiente') || []];
    const anterior = formulario?.querySelector('.registro-anterior');
    const foto = document.getElementById('registro-foto');
    const nombreFoto = document.getElementById('registro-foto-nombre');
    if (!formulario || !estado || !pasos.length || !progreso || !anterior) return;

    const enlaceLogin = document.querySelector('a[href="login.html"]');
    formulario.querySelectorAll('input').forEach((campo) => {
        campo.addEventListener('focus', () => enlaceLogin?.classList.add('hidden'));
        campo.addEventListener('blur', () => enlaceLogin?.classList.remove('hidden'));
    });

    let pasoActual = 0;
    const mostrarPaso = (indice, enfocar = true) => {
        pasoActual = Math.max(0, Math.min(indice, pasos.length - 1));
        pasos.forEach((paso, indicePaso) => paso.classList.toggle('hidden', indicePaso !== pasoActual));
        anterior.classList.toggle('hidden', pasoActual === 0);
        progreso.textContent = `${pasoActual + 1} de ${pasos.length}`;
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
        nombreFoto.textContent = foto.files?.[0]?.name || 'Aún no seleccionas una foto.';
    });

    formulario.addEventListener('submit', (event) => {
        event.preventDefault();
        estado.textContent = 'La creación de cuentas estará disponible próximamente.';
    });

    mostrarPaso(0, false);
}
