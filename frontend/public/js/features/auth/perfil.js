import { actualizarPerfil, cerrarSesion, obtenerPerfil } from './service.js';
import { esErrorSesionRequerida, redirigirAlLogin } from './guards.js';
import { establecerEstadoSesion } from './session.js';
import { RUTAS, ruta } from '../../app/rutas.js';
import { configurarNombreUsuario, establecerEstado, establecerFormularioCargando, mensajeErrorAutenticacion, mostrarPrimerError } from './auth-ui.js';

const TIPOS_AVATAR = ['image/jpeg', 'image/png', 'image/webp'];
const TAMANO_MAXIMO_AVATAR = 5 * 1024 * 1024;

function iniciales(nombre = '') {
    const partes = nombre.trim().split(/\s+/).filter(Boolean);
    return (partes.length ? `${partes[0][0]}${partes[1]?.[0] || ''}` : 'ZD').toUpperCase();
}

export function iniciarPerfil() {
    const formulario = document.getElementById('perfil-form');
    const estado = document.getElementById('perfil-estado');
    const sesionEstado = document.getElementById('perfil-sesion-estado');
    const nombre = document.getElementById('perfil-nombre');
    const usuario = document.getElementById('perfil-usuario');
    const correo = document.getElementById('perfil-correo');
    const puntos = document.getElementById('perfil-puntos');
    const avatar = document.getElementById('perfil-avatar');
    const avatarImagen = document.getElementById('perfil-avatar-imagen');
    const avatarIniciales = document.getElementById('perfil-avatar-iniciales');
    const quitarAvatar = document.getElementById('perfil-avatar-quitar');
    const cambios = document.getElementById('perfil-cambios');
    const cancelar = document.getElementById('perfil-cancelar');
    const botonCerrarSesion = document.getElementById('perfil-cerrar-sesion');
    if (!formulario || !estado) return;

    configurarNombreUsuario(usuario);
    let original = { displayName: '', username: '', email: '', avatarUrl: '', pointsBalance: 0 };
    let usuarioSesion = null;
    let archivoAvatar = null;
    let quitarAvatarSolicitado = false;
    let urlTemporal = '';

    const limpiarUrlTemporal = () => {
        if (urlTemporal) URL.revokeObjectURL(urlTemporal);
        urlTemporal = '';
    };

    const mostrarAvatar = (url, texto) => {
        avatarIniciales.textContent = iniciales(texto);
        if (url) {
            avatarImagen.src = url;
            avatarImagen.alt = `Foto de perfil de ${texto || 'usuario'}`;
            avatarImagen.hidden = false;
            avatarIniciales.hidden = true;
        } else {
            avatarImagen.removeAttribute('src');
            avatarImagen.alt = '';
            avatarImagen.hidden = true;
            avatarIniciales.hidden = false;
        }
        quitarAvatar.hidden = !url;
    };

    const hayCambios = () => Boolean(
        archivoAvatar || quitarAvatarSolicitado ||
        nombre.value.trim() !== original.displayName ||
        usuario.value.trim() !== original.username
    );

    const actualizarCambios = () => {
        const modificado = hayCambios();
        cambios.hidden = !modificado;
        cancelar.disabled = !modificado;
    };

    const pintar = datos => {
        const perfil = datos?.profile || datos || {};
        const user = datos?.user || usuarioSesion || {};
        usuarioSesion = user;
        original = {
            displayName: perfil.displayName ?? perfil.display_name ?? '',
            username: perfil.username ?? '',
            email: user.email ?? perfil.email ?? '',
            avatarUrl: perfil.avatarUrl ?? perfil.avatar_url ?? '',
            pointsBalance: Number(perfil.pointsBalance ?? perfil.points_balance ?? 0)
        };
        nombre.value = original.displayName;
        usuario.value = original.username;
        correo.value = original.email;
        puntos.textContent = new Intl.NumberFormat('es-MX').format(original.pointsBalance);
        archivoAvatar = null;
        quitarAvatarSolicitado = false;
        avatar.value = '';
        limpiarUrlTemporal();
        mostrarAvatar(original.avatarUrl, original.displayName || original.username);
        actualizarCambios();
        establecerEstadoSesion({ user, profile: perfil });
    };

    const restaurar = () => pintar({
        user: { email: original.email },
        profile: {
            displayName: original.displayName,
            username: original.username,
            avatarUrl: original.avatarUrl,
            pointsBalance: original.pointsBalance
        }
    });

    nombre.addEventListener('input', () => {
        if (!avatarImagen.hidden) avatarImagen.alt = `Foto de perfil de ${nombre.value.trim() || 'usuario'}`;
        else avatarIniciales.textContent = iniciales(nombre.value || usuario.value);
        actualizarCambios();
        establecerEstado(estado);
    });
    usuario.addEventListener('input', () => {
        if (!nombre.value) avatarIniciales.textContent = iniciales(usuario.value);
        actualizarCambios();
        establecerEstado(estado);
    });

    avatar.addEventListener('change', () => {
        const archivo = avatar.files?.[0];
        if (!archivo) return;
        if (!TIPOS_AVATAR.includes(archivo.type)) {
            avatar.value = '';
            establecerEstado(estado, 'Selecciona una imagen JPG, PNG o WebP.', 'error');
            return;
        }
        if (archivo.size > TAMANO_MAXIMO_AVATAR) {
            avatar.value = '';
            establecerEstado(estado, 'La imagen debe pesar 5 MB o menos.', 'error');
            return;
        }
        limpiarUrlTemporal();
        urlTemporal = URL.createObjectURL(archivo);
        archivoAvatar = archivo;
        quitarAvatarSolicitado = false;
        mostrarAvatar(urlTemporal, nombre.value || usuario.value);
        actualizarCambios();
        establecerEstado(estado);
    });

    quitarAvatar.addEventListener('click', () => {
        limpiarUrlTemporal();
        archivoAvatar = null;
        quitarAvatarSolicitado = Boolean(original.avatarUrl);
        avatar.value = '';
        mostrarAvatar('', nombre.value || usuario.value);
        actualizarCambios();
    });

    cancelar.addEventListener('click', restaurar);

    formulario.addEventListener('submit', async event => {
        event.preventDefault();
        if (mostrarPrimerError(formulario)) return;
        establecerFormularioCargando(formulario, true, 'Guardando…');
        establecerEstado(estado, 'Guardando tus cambios…');
        try {
            const resultado = await actualizarPerfil({
                displayName: nombre.value.trim(),
                username: usuario.value.trim().toLowerCase(),
                avatarFile: archivoAvatar,
                removeAvatar: quitarAvatarSolicitado
            });
            pintar(resultado);
            establecerEstado(estado, 'Tu perfil se actualizó correctamente.', 'success');
        } catch (error) {
            establecerEstado(estado, mensajeErrorAutenticacion(error), error?.code === 'AUTH_NOT_CONFIGURED' ? 'info' : 'error');
        } finally {
            establecerFormularioCargando(formulario, false);
        }
    });

    botonCerrarSesion.addEventListener('click', async () => {
        botonCerrarSesion.disabled = true;
        establecerEstado(sesionEstado, 'Cerrando sesión…');
        try {
            await cerrarSesion();
            establecerEstadoSesion({});
            location.assign(ruta(RUTAS.login));
        } catch (error) {
            establecerEstado(sesionEstado, mensajeErrorAutenticacion(error), error?.code === 'AUTH_NOT_CONFIGURED' ? 'info' : 'error');
            botonCerrarSesion.disabled = false;
        }
    });

    formulario.setAttribute('aria-busy', 'true');
    obtenerPerfil().then(datos => {
        pintar(datos);
        establecerEstado(estado);
    }).catch(error => {
        if (esErrorSesionRequerida(error)) {
            redirigirAlLogin();
            return;
        }
        establecerEstado(estado, mensajeErrorAutenticacion(error), error?.code === 'AUTH_NOT_CONFIGURED' ? 'info' : 'error');
    }).finally(() => formulario.setAttribute('aria-busy', 'false'));
}
