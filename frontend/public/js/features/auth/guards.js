import { RUTAS, ruta } from '../../app/rutas.js';
import {
    obtenerEstadoSesion,
    observarEstadoSesion
} from './session.js';

export function esErrorSesionRequerida(error) {
    const codigo = String(error?.code || '').toUpperCase();

    return [
        'AUTH_REQUIRED',
        'SESSION_REQUIRED',
        'NOT_AUTHENTICATED'
    ].includes(codigo);
}

export function redirigirAlLogin(destino = location.href) {
    const login = new URL(ruta(RUTAS.login));
    const objetivo = new URL(destino, location.href);

    if (objetivo.origin === location.origin) {
        login.searchParams.set(
            'next',
            objetivo.pathname + objetivo.search + objetivo.hash
        );
    }

    location.assign(login.href);
}

export function esperarEstadoSesion() {
    const actual = obtenerEstadoSesion();

    if (!actual.cargando) {
        return Promise.resolve(actual);
    }

    return new Promise(resolve => {
        let cancelar = () => {};

        cancelar = observarEstadoSesion(estado => {
            if (estado.cargando) return;

            resolve(estado);

            // observarEstadoSesion ejecuta el callback inmediatamente,
            // así que cancelamos en el siguiente microtask.
            queueMicrotask(() => cancelar());
        });
    });
}

export async function requerirSesion(destino = location.href) {
    const estado = await esperarEstadoSesion();

    if (estado.user) {
        return true;
    }

    redirigirAlLogin(destino);
    return false;
}
