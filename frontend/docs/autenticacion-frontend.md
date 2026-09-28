# Contrato del frontend de autenticación

Las pantallas de autenticación y perfil no dependen directamente de Supabase. Todos los controladores llaman a `public/js/features/auth/service.js`, que expone un único contrato. Para conectar Supabase se debe crear un adaptador y registrarlo con `configurarProveedorAutenticacion()` al iniciar la aplicación.

## Métodos que debe implementar el adaptador

```js
{
  iniciarSesion({ email, password }),
  crearCuenta({ email, password, username, displayName }),
  solicitarRestablecimiento({ email }),
  restablecerContrasena({ password }),
  obtenerPerfil(),
  actualizarPerfil({ username, displayName, avatarFile, removeAvatar }),
  cerrarSesion(),
  observarSesion(callback) // opcional
}
```

Todos los métodos pueden ser asíncronos. `observarSesion(callback)` debe devolver, si es necesario, una función para cancelar la suscripción.

## Forma normalizada de sesión y perfil

```js
{
  user: {
    id: 'uuid',
    email: 'correo@ejemplo.com'
  },
  profile: {
    username: 'aficionado24',
    displayName: 'Nombre visible',
    avatarUrl: 'https://...',
    pointsBalance: 0
  }
}
```

El adaptador puede recibir columnas de PostgreSQL en `snake_case`; el controlador de perfil también reconoce `display_name`, `avatar_url` y `points_balance`. Es preferible normalizar los nombres en el adaptador.

## Resultados esperados

- `iniciarSesion()` devuelve la sesión normalizada.
- `crearCuenta()` devuelve `{ session: null }` cuando hace falta confirmar el correo, o la sesión normalizada si el acceso es inmediato.
- `obtenerPerfil()` y `actualizarPerfil()` devuelven la sesión y el perfil normalizados.
- Los demás métodos pueden devolver `undefined` cuando terminan correctamente.

## Errores

Los errores deben incluir un `code`. Las pantallas reconocen:

- `AUTH_REQUIRED`, `SESSION_REQUIRED` o `NOT_AUTHENTICATED`: redirigen desde Perfil hacia Login.
- códigos con `invalid` o `credentials`: credenciales incorrectas.
- códigos con `already`, `registered` o `exists`: datos duplicados.
- códigos con `rate` o `limit`: límite temporal.
- `AUTH_NOT_CONFIGURED`: proveedor aún no conectado.

No se deben mostrar mensajes crudos de Supabase al usuario.

## Avatar

La foto no forma parte del registro. Se añade desde Perfil una vez creada la cuenta. El frontend acepta JPG, PNG o WebP de hasta 5 MB y entrega el objeto `File` al adaptador. El adaptador será responsable de:

1. subir el archivo al bucket `avatars`;
2. reemplazar o eliminar el archivo anterior;
3. guardar `avatar_path` en `profiles`;
4. devolver una `avatarUrl` utilizable por la interfaz.

## Archivos de las pantallas

- `pages/auth/login.html` + `js/features/auth/login.js`
- `pages/auth/registro.html` + `js/features/auth/registro.js`
- `pages/auth/recuperar.html` + `js/features/auth/recuperar.js`
- `pages/auth/restablecer.html` + `js/features/auth/restablecer.js`
- `pages/auth/perfil.html` + `js/features/auth/perfil.js`
- `js/features/auth/service.js`: frontera con el proveedor.
- `js/features/auth/session.js`: estado visual compartido.
- `js/features/auth/guards.js`: redirección de páginas protegidas.
- `js/features/auth/auth-ui.js`: validaciones y estados visuales compartidos.
- `js/app/rutas.js`: catálogo central de rutas públicas.
