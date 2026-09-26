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
