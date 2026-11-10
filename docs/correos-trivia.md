# Correos personalizados de trivia

## Estado operativo

Integración activada en producción con el remitente
`Zona Diamante <avisos@zonadiamante.dpdns.org>`. Dominio autenticado con DKIM
y DMARC; la prueba del propietario se recibió en su bandeja de entrada.

Se comprobó la ejecución real del job `zd-trivia-email` cada cinco minutos:
Cron terminó correctamente, pg_net recibió HTTP 200 del backend y los
envíos estaban habilitados. La primera tanda fue de seis correos aceptados
por Brevo, sin errores; repetir la ejecución y el siguiente ciclo automático
no volvió a enviar esos avisos.

El interruptor `TRIVIA_EMAIL_ENABLED` continúa siendo `false` por defecto
en el código y en `.env.example`; Render lo establece en `true`. Instalar
solamente la migración no crea cron jobs ni envía correos. Las credenciales
están fuera del repositorio, en variables privadas y Supabase Vault.

### Incidente de entrega a Gmail: 10 de noviembre de 2026

El programador ejecutó el turno de medianoche y Brevo aceptó los avisos,
pero Gmail rechazó cuatro mensajes con `550 5.7.1` por considerarlos
probablemente no solicitados. Outlook aceptó su mensaje. Se comprobaron el
remitente activo, DKIM, DMARC y cuota disponible; el código de rechazo por
sí solo no identifica si el motivo exacto es dominio, IP o contenido.

Se añadió `20261110000100_trivia_email_public_recipients.sql`, aplicada y
validada en la base remota, para excluir dominios reservados de prueba de
la preparación y la toma de envíos. No elimina cuentas ni altera las
preferencias reales o el historial. El backend también rechaza esos
destinatarios antes de llamar a Brevo, envía una alternativa de texto plano
y evita el texto oculto del preencabezado. Brevo agrega su propia cabecera
de baja; se conserva además el enlace de baja de la aplicación.

Una única prueba al propietario con el mensaje actualizado también fue
rechazada desde la IP de Brevo. Estos ajustes no demuestran que el bloqueo
esté resuelto: requiere revisión de entregabilidad con el proveedor. No se
debe reenviar toda la tanda ni reiniciar sus identificadores para intentar
sortear el rechazo. Los detalles con destinatarios se conservan únicamente
en archivos privados de operación, fuera del repositorio.

Consultar los eventos por `provider_message_id` en Brevo para distinguir
aceptación, entrega y rebote. **`sent` en la cola significa aceptado por
Brevo, no entregado al destinatario.** Guía del proveedor:
[problemas de entrega a Gmail](https://help.brevo.com/hc/en-us/articles/36039161138706-Troubleshooting-Deliverability-issues-with-Gmail).

## Preparación de una cuenta nueva

Crear una cuenta en [Brevo](https://www.brevo.com/) y verificar el remitente. Puede
verificarse con el código que llega a esa bandeja. Sin dominio propio,
Brevo puede reemplazar el dominio visible del remitente por uno suyo.
[Instrucciones oficiales para crear el remitente](https://help.brevo.com/hc/en-us/articles/208836149-Create-a-new-sender-From-name-and-From-email),
[reemplazo del dominio](https://help.brevo.com/hc/en-us/articles/16045394674066-Troubleshooting-Domain-authentication).

## Configuración y prueba

En `backend/.env` (ignorado por Git) y después en las variables de Render:

```dotenv
TRIVIA_EMAIL_ENABLED=false
BREVO_API_KEY=<clave de API de Brevo, no clave SMTP>
EMAIL_FROM_ADDRESS=<correo que verificaste como remitente>
EMAIL_FROM_NAME=Zona Diamante
EMAIL_DISPATCH_SECRET=<valor aleatorio de al menos 32 caracteres>
EMAIL_SITE_URL=https://zona-diamante.pages.dev
EMAIL_API_URL=https://zona-diamante.onrender.com
TRIVIA_EMAIL_BATCH_SIZE=10
```

No agregar las claves al frontend ni al repositorio. Usar el mismo secreto
de ejecución en Render y en la configuración local que instalará el cron.
Los correos de inicio de sesión y recuperación de Supabase permanecen aparte.
La clave de Brevo usa acceso restringido: **Emails transaccionales → Todos**
para enviar y **Cuenta → Leer** para consultar el remitente. Los otros
recursos no son necesarios.

Desde `backend/`:

```powershell
venv/Scripts/python.exe -m app.jobs.trivia_email preview --name Luis
venv/Scripts/python.exe -m app.jobs.trivia_email check
venv/Scripts/python.exe -m app.jobs.trivia_email send-test --to TU_CORREO --name Luis
```

`preview` genera HTML y texto sin acceder a usuarios. `check` verifica las
variables y consulta que el remitente exista y esté activo en Brevo; no
envía. `send-test` envía únicamente al destinatario indicado y no crea una
campaña. Su enlace de baja es de muestra. Una aceptación de Brevo no
demuestra entrega en bandeja: comprobar también spam y sus registros.

## Activación después de probar el correo

1. Aplicar `20261109000100_trivia_email_notifications.sql` y publicar backend
   y frontend.
2. Configurar las variables en Render, comprobar el remitente y entregar
   el correo de prueba al propietario.
3. Cambiar `TRIVIA_EMAIL_ENABLED=true` en Render y en la configuración local.
4. Desde la raíz, ejecutar:

```powershell
backend/venv/Scripts/python.exe backend/checks/configure_trivia_email_scheduler.py --linked --activate
```

Esto configura Supabase Cron y pg_net con un secreto guardado en Vault.
El cron llama al backend cada cinco minutos, aunque no haya visitas al
sitio. El backend crea/consulta la trivia del período vigente con
`TRIVIA_TIMEZONE`: actualmente cambia a medianoche y mediodía. El envío
se realiza en grupos de diez por ejecución; para muchos usuarios la tanda
completa puede tardar varios ciclos. Brevo puede exigir activar la cuenta
transaccional y aplica las cuotas del plan contratado.

Para detener envíos inmediatamente, poner `TRIVIA_EMAIL_ENABLED=false` en
Render. También se puede desactivar el job `zd-trivia-email` en el panel de
Cron de Supabase. No hay temporizadores en el navegador para enviar emails.

## Destinatarios y persistencia

Se avisa a las cuentas registradas antes de iniciar el período, con correo
confirmado, no eliminadas ni suspendidas, que no hayan completado esa trivia
y hayan activado voluntariamente los avisos desde Perfil. La preferencia
inicial está desactivada; crear una cuenta o consultar el perfil no suscribe.
Se requiere marcar la opción y pulsar **Activar avisos**. La interfaz informa
que pueden recibirse hasta dos avisos diarios.

La migración `20261110000200_trivia_email_explicit_opt_in.sql`, aplicada el
10 de noviembre de 2026, desactiva las preferencias automáticas anteriores y
cancela sus trabajos aún no enviados. Las cuentas existentes también deben
activar la opción de nuevo. Las entregas ya aceptadas conservan su historial
y no se reenvían para intentar levantar el bloqueo de Gmail.

El RPC de preferencia registra `consented_at`, `consent_version` y
`consent_source` únicamente al recibir una activación explícita. El backend
obtiene el usuario de su sesión; esos metadatos no se aceptan en el cuerpo
del cliente. La restricción de la tabla impide activar una preferencia sin
esa evidencia, y la cola la comprueba al preparar y tomar cada envío.
Desactivar la opción conserva la evidencia de la última activación, pero
impide nuevas entregas. Leer la preferencia no crea ni renueva la evidencia.

Se pueden desactivar los avisos en Perfil o desde un correo sin iniciar sesión. Abrir
el enlace de baja muestra confirmación; solamente el POST desactiva, para
que un escáner de enlaces no dé de baja a la persona involuntariamente.

El asunto actual es **Zona Diamante: nueva trivia disponible**. El contenido
describe la disponibilidad del periodo, la cantidad de preguntas y la
puntuación máxima, con HTML, texto plano y enlace de baja. El pie explica
que se recibe porque se activaron los avisos desde Perfil. Se envía
individualmente; no comparte las direcciones de otros
usuarios. Las tablas y RPC del sistema son exclusivas de `service_role`,
con RLS y sin acceso directo para usuarios del navegador.

La combinación usuario/trivia es única. Los trabajadores toman una reserva
temporal y usan el ID del envío como `headers.idempotencyKey` en Brevo. Los
reintentos ambiguos terminan a los diez minutos, dentro de los treinta que
[Brevo documenta para su clave](https://developers.brevo.com/docs/heterogenous-versions-batch-emails).
Una respuesta `duplicate_parameter` confirma que ya se aceptó. Si falta
confirmación después de esa ventana, el registro queda `uncertain` y no se
reenvía automáticamente: primero se revisan los registros del proveedor.
El estado `sent` significa aceptado por Brevo, no entrega final.

Se revalidan correo, preferencia, suspensión, finalización y vigencia al
tomar cada envío. Una trivia vencida se suprime. Los errores de cuota o
conexión detienen la tanda y se reintentan después; una clave ausente o un
remitente sin verificar impiden iniciar la tanda.

## Comprobaciones

- `backend/venv/Scripts/python.exe -m pytest backend/tests`.
- `backend/venv/Scripts/python.exe backend/checks/check_trivia_email_database.py --linked --with-migration`
  antes de instalar la migración; omitir `--with-migration` después. Crea
  fixtures y verifica selección, permisos, baja, unicidad y reintentos dentro
  de una transacción revertida; nunca llama al proveedor ni envía correo.
- `frontend/checks/trivia-email-browser.cjs`: interfaz real con API/cuenta
  simuladas y vista previa del HTML en tamaños de teléfono y escritorio.
- Para verificar la migración de activación voluntaria antes de aplicarla:
  `backend/venv/Scripts/python.exe backend/checks/check_trivia_email_database.py --linked --with-opt-in-migration`.
  La comprobación se revierte por completo y nunca llama a Brevo. Después
  de aplicarla, omitir `--with-opt-in-migration`.
