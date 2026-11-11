# Comentarios y sugerencias de Ayuda

El formulario de Ayuda envía reportes, sugerencias y preguntas a
`eduardohdz2111@gmail.com`. Requiere una sesión con correo confirmado.
Contacto es opcional; el mensaje admite entre 10 y 4000 caracteres.

## Flujo

1. `POST /api/v1/help/feedback` valida la sesión y guarda el mensaje en
   `public.help_feedback`. El cliente no puede elegir otra cuenta ni destinatario.
2. La respuesta `202 received` confirma el guardado, no la entrega al buzón.
   Un UUID por envío permite reintentar sin crear mensajes duplicados.
3. El backend llama por HTTPS a `help-feedback-email` en Supabase. La función
   lee el mensaje guardado y envía mediante Gmail SMTP con TLS en el puerto 465.
   Render gratuito bloquea los puertos SMTP; no se abre SMTP desde Render.
4. El asunto indica el motivo. El correo incluye cuenta, contacto, mensaje,
   fecha y referencia. Responder usa el correo de la cuenta del remitente.
5. El programador revisa pendientes cada cinco minutos. Las respuestas SMTP
   ambiguas y los procesos interrumpidos quedan `uncertain` para revisión;
   no se reenvían automáticamente. Gmail SMTP no ofrece idempotencia de API.

La tabla tiene RLS y no permite lectura/escritura directa a usuarios o invitados.
Las funciones SQL solo son ejecutables por `service_role`. El límite es tres
mensajes por hora y diez por 24 horas por cuenta. Se serializan los límites y
las claves de reintento para evitar carreras entre solicitudes concurrentes.
Los cuerpos HTML escapan el texto y no admiten archivos ni contenido remoto.

## Configuración

En `backend/.env`, mantener `SUPABASE_*`, `EMAIL_DISPATCH_SECRET` y:

```dotenv
FEEDBACK_RECIPIENT_EMAIL=eduardohdz2111@gmail.com
FEEDBACK_SMTP_USERNAME=eduardohdz2111@gmail.com
FEEDBACK_SMTP_PASSWORD=
```

La contraseña es una contraseña de aplicación de Google, no la contraseña
habitual. Solo se guarda localmente y como secreto de la Edge Function;
no se copia al frontend ni a Render. La función exige un secreto de trabajo
independiente de los JWT de usuarios, incluso con `verify_jwt=false`.

Tras aplicar las migraciones, publicar el relay con una sesión del CLI:

```powershell
backend/venv/Scripts/python.exe backend/checks/configure_help_feedback.py --apply
```

El comando comprueba TLS/login sin enviar mensajes, publica los secretos
privados y despliega solo esta función. No modifica Supabase Auth ni los
avisos de trivia. Si Google revoca la contraseña de aplicación, crear otra y
volver a ejecutar el comando. Las variables privadas temporales se eliminan.

Después de publicar el backend, ejecutar explícitamente
`backend/checks/help_feedback_scheduler.sql` en el proyecto. Reutiliza el
secreto y la URL de trabajos existentes en Vault; no depende de que los
avisos de trivia estén activados. El cron llama al endpoint interno del
backend, que verifica el secreto antes de invocar la Edge Function.

## Comprobaciones

- `backend/tests/test_feedback.py`: autenticación, límites de entrada,
  destinatario fijo, errores, guardado previo y contrato del relay HTTPS.
- `backend/checks/help_feedback.sql`: prueba transaccional con rollback para
  duplicados, límites, permisos, leases y envíos ambiguos; no envía correos.
- `frontend/checks/help-feedback.test.mjs`: escape de contenido, destinatario,
  Reply-To y clasificación de errores SMTP.
- `frontend/checks/help-feedback-browser.cjs`: formulario real con servicios
  simulados a 320, 390 y 1280 píxeles; preservación de texto y clave en errores.

Se probó el flujo con una cuenta temporal confirmada y autenticación real.
Gmail aceptó un único envío desde Supabase; repetir la solicitud no produjo
otro correo. El propietario confirmó su recepción. La cuenta temporal y sus
datos se eliminaron. Una prueba inicial por Brevo fue rechazada por Gmail;
el envío definitivo de Ayuda utiliza Gmail SMTP.

Referencias: [contraseñas de aplicación de Google](https://support.google.com/mail/answer/185833?hl=es),
[límites de Render gratuito](https://render.com/docs/free),
[límites de Edge Functions](https://supabase.com/docs/guides/functions/limits).
