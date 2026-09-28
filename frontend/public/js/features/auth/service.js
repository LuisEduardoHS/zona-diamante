import { establecerEstadoSesion } from './session.js';

export class AutenticacionNoConfiguradaError extends Error {
    constructor() {
        super('El proveedor de autenticación todavía no está conectado.');
        this.name = 'AutenticacionNoConfiguradaError';
        this.code = 'AUTH_NOT_CONFIGURED';
    }
}

let proveedor = null;
let cancelarObservador = null;

const metodosRequeridos = [
    'iniciarSesion',
    'crearCuenta',
    'solicitarRestablecimiento',
    'restablecerContrasena',
    'obtenerPerfil',
    'actualizarPerfil',
    'cerrarSesion'
];

/**
 * Punto único de integración con Supabase.
 * El adaptador futuro debe implementar los métodos de `metodosRequeridos` y,
 * opcionalmente, `observarSesion(callback)`.
 */
export function configurarProveedorAutenticacion(siguienteProveedor) {
    if (!siguienteProveedor || metodosRequeridos.some(metodo => typeof siguienteProveedor[metodo] !== 'function')) {
        throw new TypeError('El proveedor de autenticación no implementa el contrato completo.');
    }
    cancelarObservador?.();
    proveedor = siguienteProveedor;
    cancelarObservador = proveedor.observarSesion?.(establecerEstadoSesion) || null;
}

export function autenticacionConfigurada() {
    return proveedor !== null;
}

function ejecutar(metodo, payload) {
    if (!proveedor) return Promise.reject(new AutenticacionNoConfiguradaError());
    return proveedor[metodo](payload);
}

export const iniciarSesion = credenciales => ejecutar('iniciarSesion', credenciales);
export const crearCuenta = datos => ejecutar('crearCuenta', datos);
export const solicitarRestablecimiento = datos => ejecutar('solicitarRestablecimiento', datos);
export const restablecerContrasena = datos => ejecutar('restablecerContrasena', datos);
export const obtenerPerfil = () => ejecutar('obtenerPerfil');
export const actualizarPerfil = datos => ejecutar('actualizarPerfil', datos);
export const cerrarSesion = () => ejecutar('cerrarSesion');
