import { iniciarControlesContrasena, mostrarPrimerError } from './auth-ui.js';

export function iniciarLogin() {
    const formularioLogin = document.getElementById('login-form');
    const estadoLogin = document.getElementById('login-estado');

    if (!formularioLogin || !estadoLogin) return;

    iniciarControlesContrasena(formularioLogin);
    formularioLogin.addEventListener('input', () => { estadoLogin.textContent = ''; });

    formularioLogin.addEventListener('submit', (event) => {
        event.preventDefault();
        if (mostrarPrimerError(formularioLogin)) return;
        estadoLogin.textContent = 'El acceso estará disponible próximamente.';
    });
}
