# Correos de autenticación de Zona Diamante

## Configuración publicada

Supabase Auth usa las plantillas de `supabase/templates/auth/` y el
remitente `Zona Diamante <avisos@zonadiamante.dpdns.org>` mediante Brevo SMTP
con STARTTLS en el puerto 587. Los avisos de trivia continúan usando la API
de Brevo desde el backend; los correos de autenticación salen directamente
de Supabase y no dependen de que Render esté despierto.

Se publicaron seis plantillas de autenticación: confirmación de cuenta,
recuperación de contraseña, invitación, enlace de acceso, cambio de correo
y reautenticación con código. Las siete plantillas de notificaciones de
seguridad también tienen el diseño: cambios de contraseña, correo y teléfono,
métodos de acceso vinculados/desvinculados y verificaciones adicionales
añadidas/eliminadas. Sus interruptores se conservaron: actualmente estos
siete avisos opcionales están desactivados; personalizarlos no los activa.

Las plantillas comparten los colores, tipografía y botones de los avisos de
trivia. Los mensajes de autenticación toman el nombre de `.Data.display_name`
si existe y usan un saludo genérico si falta. Los códigos conservan
`{{ .Token }}` y los botones conservan `{{ .ConfirmationURL }}`, que Supabase
genera con el token, tipo y regreso apropiados. No se sustituyeron por enlaces
directos a la página de inicio ni por tokens creados en el frontend.

Se añadieron estas dos URL exactas al listado existente de redirecciones:

- `https://zona-diamante.pages.dev/pages/auth/perfil.html`
- `https://zona-diamante.pages.dev/pages/auth/restablecer.html`

Se preservaron las rutas de Netlify/desarrollo, Site URL, confirmación
obligatoria del correo, proveedores, MFA y límites de autenticación. El límite
configurado del proyecto sigue siendo de dos correos de Auth por hora;
se administra por separado en Authentication → Rate Limits. La cuota del
proveedor también se aplica a los correos enviados por SMTP.

## Fuentes y edición

`supabase/templates/generate_auth_templates.py` genera los trece HTML y su
manifiesto. La fuente es el generador; después de editar sus textos o diseño:

```powershell
backend/venv/Scripts/python.exe supabase/templates/generate_auth_templates.py
```

`supabase/config.toml` registra los archivos para desarrollo local. Para el
proyecto hospedado se usa un PATCH limitado a sujetos y cuerpos, remitente
SMTP y las dos redirecciones. No ejecutar un push de toda la configuración
local para publicar solamente estas plantillas.

Con un token personal de administración en `SUPABASE_ACCESS_TOKEN`:

```powershell
backend/venv/Scripts/python.exe backend/checks/configure_auth_emails.py
backend/venv/Scripts/python.exe backend/checks/configure_auth_emails.py --apply
```

El primer comando revisa sin publicar; `--apply` publica y relee para
comparar los trece HTML y sus asuntos. Se comprueban también los campos
ajenos al parche para detectar cambios concurrentes. Supabase actualiza
además dos mapas agregados derivados del contenido personalizado.

Para configurar o cambiar el SMTP, agregar `--smtp`. Ese modo lee
`BREVO_SMTP_LOGIN` y `BREVO_SMTP_KEY` de `backend/.env`. Son credenciales
distintas de la API usada para trivia. Se validó la clave SMTP con una
conexión TLS y autenticación sin enviar mensajes antes de publicarla.
Las claves no van al frontend, al HTML ni a Git. Supabase conserva la
configuración del SMTP: no hace falta copiar esta clave a Render.

Antes de publicar, el operador guarda un respaldo privado de los campos
afectados en `.tmp/auth-email/rollback-patch.json`. Ese archivo está ignorado
por Git y puede contener datos privados del SMTP anterior. Conservar una
copia apropiada antes de una segunda publicación; no compartirlo.

## Validación

- Las pruebas del backend comprueban campos permitidos, tokens y
  redirecciones preservadas, sin activar nuevas políticas.
- `frontend/checks/auth-email-browser.cjs` revisa los trece HTML a 320 y
  600 píxeles, con nombres largos y enlaces de confirmación extensos.
  Usa valores de muestra para los marcadores Go; no sustituye la prueba real.
- El proyecto hospedado se releyó para confirmar los trece asuntos y cuerpos
  y que solo cambiaron las claves esperadas del SMTP y las redirecciones.
- Se comprobó el mensaje de confirmación realmente procesado por Supabase y
  enviado por Brevo: nombre y diseño renderizados, sin marcadores Go restantes.
  El proveedor registró su entrega al buzón de prueba del propietario.
- Un enlace real de confirmación generado por Auth se verificó con una cuenta
  temporal: regresó a Perfil en Cloudflare y no pudo usarse una segunda vez.
- El correo real de recuperación se verificó con la misma cuenta temporal:
  regresó a Restablecer en Cloudflare, su enlace fue de un solo uso y permitió
  cambiar la contraseña. El inicio de sesión aceptó la nueva y rechazó la
  anterior. La cuenta y sus datos de prueba se eliminaron; la cuenta principal
  del propietario no se modificó.

Referencia de variables y tipos de correo:
[plantillas de Supabase](https://supabase.com/docs/guides/auth/auth-email-templates).
Configuración del transporte:
[SMTP de Supabase](https://supabase.com/docs/guides/auth/auth-smtp),
[claves SMTP de Brevo](https://help.brevo.com/hc/en-us/articles/7959631848850-Create-and-manage-your-SMTP-keys).
