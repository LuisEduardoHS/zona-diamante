export function iniciarLogin() {
    const formularioLogin = document.getElementById('login-form');
    const estadoLogin = document.getElementById('login-estado');

    if (!formularioLogin || !estadoLogin) return;

    const enlaceRegistro = document.querySelector('a[href="registro.html"]');
    formularioLogin.querySelectorAll('input').forEach((campo) => {
        campo.addEventListener('focus', () => enlaceRegistro?.classList.add('hidden'));
        campo.addEventListener('blur', () => enlaceRegistro?.classList.remove('hidden'));
    });

    formularioLogin.addEventListener('submit', (event) => {
        event.preventDefault();
        estadoLogin.textContent = 'El acceso estará disponible próximamente.';
    });

}
