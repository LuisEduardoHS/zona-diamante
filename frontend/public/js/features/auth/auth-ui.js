const iconoOjo = (visible) => visible
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m3 3 18 18M10.6 10.7a2 2 0 0 0 2.7 2.7M9.9 4.2A10.6 10.6 0 0 1 12 4c5 0 8.5 4 9 6.7a5 5 0 0 1-.8 1.8M6.6 6.6C4.6 8 3.4 9.8 3 12c.5 2.7 4 6.7 9 6.7 1.3 0 2.5-.3 3.6-.7"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.5"/></svg>';

export function iniciarControlesContrasena(contenedor = document) {
    contenedor.querySelectorAll('[data-password-toggle]').forEach((boton) => {
        if (boton.dataset.iniciado === 'true') return;
        const campo = document.getElementById(boton.dataset.passwordToggle);
        if (!campo) return;
        boton.dataset.iniciado = 'true';
        boton.innerHTML = iconoOjo(false);
        boton.addEventListener('click', () => {
            const mostrar = campo.type === 'password';
            campo.type = mostrar ? 'text' : 'password';
            boton.innerHTML = iconoOjo(mostrar);
            boton.setAttribute('aria-label', mostrar ? 'Ocultar contraseña' : 'Mostrar contraseña');
            boton.setAttribute('aria-pressed', String(mostrar));
            campo.focus({ preventScroll: true });
        });
    });
}

export function mostrarPrimerError(formulario) {
    if (formulario.checkValidity()) return false;
    formulario.querySelector(':invalid')?.reportValidity();
    return true;
}

export function establecerEstado(elemento, mensaje = '', tipo = 'info') {
    if (!elemento) return;
    elemento.textContent = mensaje;
    elemento.dataset.tipo = mensaje ? tipo : '';
}

export function establecerFormularioCargando(formulario, cargando, texto = 'Procesando…') {
    formulario?.setAttribute('aria-busy', String(cargando));
    const boton = formulario?.querySelector('button[type="submit"]');
    if (!boton) return;
    boton.disabled = cargando;
    boton.textContent = cargando ? texto : (boton.dataset.submitLabel || 'Continuar');
}

export function mensajeErrorAutenticacion(error) {
    if (error?.code === 'AUTH_NOT_CONFIGURED') {
        return 'La interfaz está lista. Falta conectar el proveedor de autenticación.';
    }
    const codigo = String(error?.code || '').toLowerCase();
    if (codigo.includes('invalid') || codigo.includes('credentials')) return 'El correo o la contraseña no son correctos.';
    if (codigo.includes('already') || codigo.includes('registered') || codigo.includes('exists')) return 'Ya existe una cuenta con esos datos.';
    if (codigo.includes('rate') || codigo.includes('limit')) return 'Espera un momento antes de volver a intentarlo.';
    if (codigo.includes('network') || error instanceof TypeError) return 'No pudimos comunicarnos con el servicio. Revisa tu conexión.';
    return 'No pudimos completar la solicitud. Inténtalo nuevamente.';
}

export function configurarNombreUsuario(campo) {
    if (!campo || campo.dataset.normalizado === 'true') return;
    campo.dataset.normalizado = 'true';
    campo.addEventListener('input', () => {
        const inicio = campo.selectionStart;
        campo.value = campo.value.toLowerCase().replace(/[^a-z0-9._]/g, '');
        campo.setSelectionRange(inicio, inicio);
    });
}

export function iniciarRequisitosContrasena(campo, contenedor = document) {
    if (!campo) return () => true;
    const reglas = {
        length: valor => valor.length >= 8,
        letter: valor => /[a-záéíóúñ]/i.test(valor),
        number: valor => /\d/.test(valor)
    };
    const actualizar = () => {
        const resultados = Object.fromEntries(Object.entries(reglas).map(([nombre, validar]) => [nombre, validar(campo.value)]));
        contenedor.querySelectorAll('[data-password-rule]').forEach(elemento => {
            elemento.dataset.cumplido = String(Boolean(resultados[elemento.dataset.passwordRule]));
        });
        const valido = Object.values(resultados).every(Boolean);
        campo.setCustomValidity(campo.value && !valido ? 'La contraseña debe cumplir todos los requisitos.' : '');
        return valido;
    };
    campo.addEventListener('input', actualizar);
    actualizar();
    return actualizar;
}

export function validarContrasenasIguales(contrasena, confirmacion) {
    if (!contrasena || !confirmacion) return true;
    const iguales = !confirmacion.value || contrasena.value === confirmacion.value;
    confirmacion.setCustomValidity(iguales ? '' : 'Las contraseñas no coinciden.');
    return iguales;
}
