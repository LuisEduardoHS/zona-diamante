import { supabase } from '../../services/supabase-client.js';

const PERFIL_SELECT =
    'username, display_name, avatar_path, points_balance';

function crearError(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
}

function normalizarError(error) {
    const codigo = String(error?.code || '').toLowerCase();
    const mensaje = String(error?.message || '').toLowerCase();

    if (
        mensaje.includes('invalid login credentials') ||
        codigo.includes('invalid_credentials')
    ) {
        return crearError(
            'INVALID_CREDENTIALS',
            'El correo o la contraseña son incorrectos.'
        );
    }

    if (
        mensaje.includes('already registered') ||
        mensaje.includes('already exists') ||
        codigo.includes('already')
    ) {
        return crearError(
            'ACCOUNT_EXISTS',
            'Ya existe una cuenta con esos datos.'
        );
    }

    if (
        mensaje.includes('rate limit') ||
        mensaje.includes('too many requests') ||
        codigo.includes('rate')
    ) {
        return crearError(
            'RATE_LIMITED',
            'Se realizaron demasiados intentos. Intenta nuevamente más tarde.'
        );
    }

    if (
        mensaje.includes('auth session missing') ||
        mensaje.includes('session missing') ||
        codigo.includes('session_not_found')
    ) {
        return crearError(
            'AUTH_REQUIRED',
            'Necesitas iniciar sesión para continuar.'
        );
    }

    return crearError(
        'AUTH_ERROR',
        'No fue posible completar la operación de autenticación.'
    );
}

function normalizarUsuario(user) {
    if (!user) return null;

    return {
        id: user.id,
        email: user.email || ''
    };
}

function obtenerAvatarUrl(avatarPath) {
    if (!avatarPath) return null;

    const {
        data
    } = supabase.storage
        .from('avatars')
        .getPublicUrl(avatarPath);

    return data?.publicUrl || null;
}

function normalizarPerfil(profile) {
    if (!profile) return null;

    return {
        username: profile.username,
        displayName: profile.display_name || '',
        avatarUrl: obtenerAvatarUrl(profile.avatar_path),
        pointsBalance: profile.points_balance ?? 0
    };
}

async function consultarPerfil(userId) {
    const { data, error } = await supabase
        .from('profiles')
        .select(PERFIL_SELECT)
        .eq('id', userId)
        .single();

    if (error) {
        throw normalizarError(error);
    }

    return normalizarPerfil(data);
}

async function normalizarSesion(session) {
    if (!session?.user) {
        return {
            cargando: false,
            user: null,
            profile: null,
            session: null
        };
    }

    const profile = await consultarPerfil(session.user.id);

    return {
        cargando: false,
        user: normalizarUsuario(session.user),
        profile,
        session
    };
}

async function iniciarSesion({ email, password }) {
    const { data, error } =
        await supabase.auth.signInWithPassword({
            email,
            password
        });

    if (error) {
        throw normalizarError(error);
    }

    return normalizarSesion(data.session);
}

async function crearCuenta({
    email,
    password,
    username,
    displayName
}) {
    const emailRedirectTo = new URL(
        '/pages/auth/perfil.html',
        window.location.origin
    ).toString();

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            emailRedirectTo,
            data: {
                username,
                display_name: displayName
            }
        }
    });

    if (error) {
        throw normalizarError(error);
    }

    // Si Supabase exige confirmar el correo,
    // todavía no existe una sesión autenticada.
    if (!data.session) {
        return {
            session: null
        };
    }

    return normalizarSesion(data.session);
}

async function solicitarRestablecimiento({ email }) {
    const redirectTo = new URL(
        '/pages/auth/restablecer.html',
        window.location.origin
    ).toString();

    const { error } =
        await supabase.auth.resetPasswordForEmail(email, {
            redirectTo
        });

    if (error) {
        throw normalizarError(error);
    }
}

async function restablecerContrasena({ password }) {
    const { error } = await supabase.auth.updateUser({
        password
    });

    if (error) {
        throw normalizarError(error);
    }
}

async function obtenerPerfil() {
    const {
        data: { user },
        error
    } = await supabase.auth.getUser();

    if (error || !user) {
        throw crearError(
            'AUTH_REQUIRED',
            'Necesitas iniciar sesión para continuar.'
        );
    }

    const profile = await consultarPerfil(user.id);

    return {
        user: normalizarUsuario(user),
        profile
    };
}

async function actualizarPerfil({
    username,
    displayName,
    avatarFile,
    removeAvatar
}) {
    const {
        data: { user },
        error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
        throw crearError(
            'AUTH_REQUIRED',
            'Necesitas iniciar sesión para continuar.'
        );
    }

    // Consultamos el avatar actual para poder reemplazarlo
    // o eliminarlo después de actualizar el perfil.
    const {
        data: perfilActual,
        error: perfilActualError
    } = await supabase
        .from('profiles')
        .select('avatar_path')
        .eq('id', user.id)
        .single();

    if (perfilActualError) {
        throw normalizarError(perfilActualError);
    }

    const avatarPathAnterior = perfilActual?.avatar_path || null;
    let avatarPathNuevo = avatarPathAnterior;
    let archivoSubido = null;

    if (avatarFile) {
        const extensionesPermitidas = {
            'image/jpeg': 'jpg',
            'image/png': 'png',
            'image/webp': 'webp'
        };

        const extension = extensionesPermitidas[avatarFile.type];

        if (!extension) {
            throw crearError(
                'INVALID_AVATAR_TYPE',
                'La imagen debe ser JPG, PNG o WebP.'
            );
        }

        if (avatarFile.size > 5 * 1024 * 1024) {
            throw crearError(
                'AVATAR_TOO_LARGE',
                'La imagen debe pesar 5 MB o menos.'
            );
        }

        /*
         * Usamos un nombre nuevo para cada versión del avatar.
         * Esto evita que el navegador/CDN siga mostrando una
         * versión anterior del archivo después de cambiarlo.
         */
        archivoSubido =
            `${user.id}/profile-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(archivoSubido, avatarFile, {
                cacheControl: '3600',
                contentType: avatarFile.type,
                upsert: false
            });

        if (uploadError) {
            console.error('Error al subir avatar:', uploadError);
            throw normalizarError(uploadError);
        }

        avatarPathNuevo = archivoSubido;
    } else if (removeAvatar) {
        avatarPathNuevo = null;
    }

    const { data, error } = await supabase
        .from('profiles')
        .update({
            username,
            display_name: displayName,
            avatar_path: avatarPathNuevo
        })
        .eq('id', user.id)
        .select(PERFIL_SELECT)
        .single();

    if (error) {
        console.error('Error al actualizar perfil:', error);
        /*
         * Si acabábamos de subir una imagen pero falló
         * la actualización del perfil, intentamos limpiar
         * ese archivo para no dejarlo huérfano.
         */
        if (archivoSubido) {
            await supabase.storage
                .from('avatars')
                .remove([archivoSubido]);
        }

        throw normalizarError(error);
    }

    /*
     * Después de que el perfil ya apunta correctamente al
     * nuevo avatar (o a NULL), eliminamos el archivo anterior.
     *
     * Si esta limpieza falla, el perfil sigue siendo válido;
     * sólo quedaría un archivo huérfano en Storage.
     */
    if (
        avatarPathAnterior &&
        avatarPathAnterior !== avatarPathNuevo
    ) {
        const { error: deleteError } = await supabase.storage
            .from('avatars')
            .remove([avatarPathAnterior]);

        if (deleteError) {
            console.warn(
                'No fue posible eliminar el avatar anterior.',
                deleteError
            );
        }
    }

    return {
        user: normalizarUsuario(user),
        profile: normalizarPerfil(data)
    };
}

async function cerrarSesion() {
    const { error } = await supabase.auth.signOut();

    if (error) {
        throw normalizarError(error);
    }
}

function observarSesion(callback) {
    let activo = true;

    callback({
        cargando: true,
        user: null,
        profile: null
    });

    async function publicarSesion(session) {
        if (!activo) return;

        if (!session?.user) {
            callback({
                cargando: false,
                user: null,
                profile: null
            });
            return;
        }

        try {
            const estado = await normalizarSesion(session);

            if (activo) {
                callback(estado);
            }
        } catch {
            if (activo) {
                callback({
                    cargando: false,
                    user: normalizarUsuario(session.user),
                    profile: null
                });
            }
        }
    }

    supabase.auth.getSession().then(({ data }) => {
        publicarSesion(data.session);
    });

    const {
        data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
        /*
         * Dejamos salir primero al callback interno de Supabase antes
         * de realizar una consulta adicional a profiles.
         */
        setTimeout(() => {
            publicarSesion(session);
        }, 0);
    });

    return () => {
        activo = false;
        subscription.unsubscribe();
    };
}

export const proveedorSupabase = {
    iniciarSesion,
    crearCuenta,
    solicitarRestablecimiento,
    restablecerContrasena,
    obtenerPerfil,
    actualizarPerfil,
    cerrarSesion,
    observarSesion
};