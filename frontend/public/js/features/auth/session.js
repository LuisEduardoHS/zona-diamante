let estado = { cargando: false, user: null, profile: null };
const observadores = new Set();

export function obtenerEstadoSesion() {
    return estado;
}

export function establecerEstadoSesion(siguiente = {}) {
    estado = {
        cargando: Boolean(siguiente.cargando),
        user: siguiente.user || null,
        profile: siguiente.profile || null
    };
    observadores.forEach(observador => observador(estado));
    window.dispatchEvent(new CustomEvent('zd:auth-state', { detail: estado }));
}

export function observarEstadoSesion(observador) {
    observadores.add(observador);
    observador(estado);
    return () => observadores.delete(observador);
}
