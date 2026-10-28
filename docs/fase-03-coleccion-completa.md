# Fase 3 — Colección completa

Fecha: 28 de octubre de 2026, America/Mexico_City. Base comprobada tras fetch: `main` y `origin/main` en `efd9ea3`. Árbol limpio al inicio; rama creada `feat/collection-ui-complete`.

**Estado global: PARCIAL en verificación final. Implementación, pruebas locales, integración y publicación completadas.** Quedan la atribución externa del TypeError histórico de MutationObserver y la comprobación autenticada de producción con una cuenta de prueba autorizada. No se simula que esas verificaciones se hayan completado.

## Auditoría y checklist inicial

- [x] HTML existente: cuatro bloques estáticos, etiquetas de jugadores que no coinciden con todas las cartas del catálogo, sin saldo, inventario, filtros ni compra.
- [x] Estilo existente: Urbanist/turquesa/naranja, pero CSS de colección con reglas globales y ancho de escritorio limitado a 346 px. Se reemplazará por estilos acotados.
- [x] GET `/api/v1/cards`: catálogo activo + equipos activos + propiedad del usuario + saldo, autenticado. El total excluye equipos inactivos/ausentes.
- [x] POST `/api/v1/cards/{id}/purchase`: identidad JWT, `Idempotency-Key` obligatorio, RPC `purchase_card`; no acepta precio/saldo del cliente.
- [x] RPC y ledger: transacción existente, bloqueo de perfil/carta, saldo no negativo, propiedad única e idempotencia separada por usuario/actividad/operación. No se recrean.
- [x] Catálogo sembrado: 20 registros, cuatro equipos, tipos `team/player/mvp_player/mascot`, métodos `points/ar`; precios en DB, imágenes `NULL`. La cantidad se calculará de la respuesta, nunca como regla fija.
- [x] Recursos locales: logos y algunas fotos/MVP/mascotas; no existe una imagen fiable para cada jugador. El MVP editorial de varios equipos no coincide con la carta MVP: no se reutilizarán esos retratos para otras personas.
- [x] Auth y HTTP: proveedor Supabase, observador de sesión, cliente backend central y configuración de build; perfil/trivia consultan saldo del servidor.
- [x] Navegación: Colección era privada y no montaba controlador propio. Hace falta permitir explorar como invitado y montar/desmontar con AbortSignal.
- [x] AR: propiedad persistente disponible; concesión pública deshabilitada. Colección no habilitará premios ni compras de mascotas.
- [x] Lectura pública del catálogo sin revelar saldo/inventario; ruta de sólo lectura reutilizando el servicio.
- [x] UI completa, compra/reconciliación, pruebas y evidencias responsive.
- [x] Verificar esquema compatible y publicación del commit de implementación en Netlify y Render; sin SQL remoto nuevo.

Docker estaba detenido al inicio; se solicitó el arranque de la instalación existente, sin instalar dependencias. No se aplicarán migraciones remotas.

## 1. Arquitectura implementada

HTML nativo + CSS acotado + módulos JavaScript, sin framework ni dependencias nuevas. FastAPI mantiene los contratos privados de colección/compra, PostgREST y las RPC existentes. No hay migraciones nuevas: las 22 históricas permanecen idénticas a la base. Se leyó el catálogo remoto de forma no destructiva: 20 activas, cuatro categorías, cero imágenes individuales. Las pruebas económicas utilizan exclusivamente bases locales con identidad sintética.

El servicio extrae `get_card_catalog()` como fuente común de catálogo activo/equipos activos. `get_collection_for_user()` añade únicamente saldo e inventario del JWT. Una respuesta inválida de tablas ya no se convierte silenciosamente en un álbum vacío.

## 2. Diseño y estructura

Urbanist, superficies claras, turquesa/naranja, bordes redondeados. Encabezado compacto con monedero, progreso, segmentos Todas/Mis cartas/Bloqueadas, tipos desplazables, equipo y orden. Galería de dos columnas móvil, cuatro tablet y cinco escritorio. Detalle en diálogo nativo; confirmación dentro del mismo diálogo, sin superponer modales.

Se eliminó la restricción anterior de 346 px en escritorio y los selectores globales del CSS de colección. El resto del sitio conserva sus estilos. La navegación SPA monta `iniciarColeccion(signal)` y su cancelación destruye listeners, peticiones y diálogo. Colección pasa a ser explorable como invitado; Perfil conserva su guard privado.

## 3. Cartas y recursos

Componente reutilizable `cardFace/cardTile`, generado desde la respuesta. Marco deportivo, logo, iniciales, nombre/equipo/tipo y precio/propiedad; MVP tiene borde cálido y propiedad borde turquesa. Las bloqueadas conservan el arte legible. Los números son IDs del catálogo, no una cantidad fija de negocio.

Prioridad de imagen: URL/ruta pública de `image_path`; foto editorial sólo si coincide el nombre normalizado del personaje; logo del equipo; monograma. No se asignó una foto genérica a cada jugador. Las fotos del MVP de Charros/Dorados y el nombre editorial de algunas mascotas difieren de las cartas: se usa logo cuando no hay coincidencia. No se inventaron deportistas ni se modificó información deportiva. Errores de imagen tienen fallback; se verificó el casing Git de los cuatro logos para Linux. Futuras imágenes en Storage deben proporcionar una URL pública o ruta web válida, no una clave de bucket sin resolver.

## 4. Filtros y progreso

Propiedad, equipo y tipo se combinan. Orden por catálogo, nombre español o precio. Restablecer elimina filtros. Abrir/cerrar detalle conserva la galería y sus filtros. Total, adquiridas y porcentaje se calculan sobre el catálogo activo devuelto; no se cuenta catálogo inactivo como obtenible. Invitado no recibe saldo ni progreso personal ficticio.

## 5. Sesión, puntos e inventario

Se reutilizan observador de sesión y cliente HTTP. Cada identidad nueva elimina datos personales previos antes de cargar. Solicitudes tardías de una sesión anterior se descartan por generación. Un cambio de token del mismo usuario no duplica el montaje. Sesión vencida pide login y bloquea compras; error de red conserva el estado previo con advertencia y lo marca desactualizado. Carga sin datos usa skeletons; no muestra falsamente cero puntos.

El saldo siempre viene del GET autenticado o de la respuesta transaccional; nunca se resta el precio en JS. Actualizar, volver a la página o recuperar foco vuelve a consultar el servidor, por lo que puntos de trivia y cambios de otro dispositivo aparecen en la próxima lectura. El perfil sigue obteniendo su balance de Supabase; no se duplica la recompensa de trivia.

## 6. Compra, idempotencia y respuesta incierta

Detalle → Desbloquear → costo y confirmación explícita → POST autenticado con ID y `Idempotency-Key`. No se envía cuerpo con usuario/precio/saldo/premio. Se bloquean doble clic, compra adquirida, mascota, saldo insuficiente y datos desactualizados. La RPC existente valida identidad, precio, disponibilidad y propiedad dentro de la transacción. UI no sustituye los permisos ni las restricciones del servidor.

Antes del POST se guarda `{cardId,key}` bajo una clave local separada por usuario. Es metadata de recuperación, nunca prueba de propiedad. Sin almacenamiento utilizable se bloquea el POST. Red/timeout/5xx/respuesta inválida mantienen la misma clave, consultan inventario y no anuncian éxito arbitrario. Si el servidor confirma propiedad, se reconcilia; si sigue incierto, sólo se ofrece reintentar la operación guardada. No se crea otra compra desde esa vista hasta resolverla. El journal sobrevive a recarga; el saldo/inventario no se persisten como autoridad local.

La idempotencia económica y concurrencia entre dispositivos siguen siendo responsabilidad de PostgreSQL, no de localStorage. El control del navegador no es un bloqueo distribuido. Un reintento confirmado usa `already_processed` y el balance actual del servidor, sin segundo cobro. 400/403/404/409/422/429 producen explicación y reconciliación; 401 conserva recuperación y requiere sesión. La cancelación por salida conserva una petición económica incierta para la próxima visita.

## 7. Animación y mascotas AR

Una respuesta transaccional válida destaca brevemente la carta y actualiza saldo/propiedad. La reconciliación de propiedad sin respuesta de compra comunica propiedad confirmada, sin inventar un cobro o una nueva entrega. La animación respeta `prefers-reduced-motion`.

Mascotas muestran Exclusiva AR o Adquirida; jamás se pueden comprar. Enlazan a la cámara real del proyecto. La nota explica que la entrega automática sigue pendiente: escanear no desbloquea aún. No se agregó ninguna ruta de concesión ni se convirtió `marker_found` en evidencia. La propiedad proviene de `/api/v1/cards`; no hace falta otra consulta AR redundante.

## 8. Responsive y accesibilidad

Se verificaron viewports **reales de navegador** 360×740, 390×844, 768×1024 y 1440×900 mediante override temporal, después restablecido. Se guardó galería/detalle para cada tamaño y confirmación móvil. `responsive.json` registra dimensiones efectivas: sin overflow horizontal de documento, sin imágenes rotas observadas y diálogos dentro del viewport. Los filtros móviles desplazan su propia fila. No se afirma emulación de hardware/DPR/Safari.

Botones nativos, filtros con `aria-pressed`, selects etiquetados, progreso etiquetado, skeletons ocultos a accesibilidad, estados con `role=status`, diálogo con nombre accesible y foco nativo. Escape/cierre disponible excepto durante la confirmación en curso; se puede navegar fuera y recuperar después. Controles principales de 44–46 px. El diálogo limita altura y permite scroll interno.

## 9. API y seguridad

| Ruta | Uso / compatibilidad |
| --- | --- |
| GET `/api/v1/cards/catalog` | Nueva, pública y sólo lectura. Campos de catálogo, sin perfiles, balances, IDs de usuario, propiedad ni fechas personales. |
| GET `/api/v1/cards` | Existente, JWT obligatorio. Saldo/catálogo/inventario propios; contrato conservado. |
| POST `/api/v1/cards/{id}/purchase` | Existente, JWT + header obligatorio. RPC y reglas económicas intactas. |
| GET `/version` | Nueva lectura de `RENDER_GIT_COMMIT` si es SHA40 válido; permite acreditar commit desplegado sin mostrar variables/secretos. `/health` mantiene exactamente su contrato. |

El build escribe `build-info.json` con `COMMIT_REF` validado de Netlify y fecha; artefacto ignorado en Git. No contiene credenciales. Backend URL proviene de runtime-config existente; se comprobó que producción usa `https://zona-diamante.onrender.com`, no localhost. Tests de navegador tienen adaptadores sólo en `checks/` y servidores loopback; no son referenciados por el sitio ni el build publicado. Sin cambios de RLS, SQL, precios, saldos reales o recompensas públicas.

## 10. Corrección de login encontrada en integración

Un envío programático muy temprano del formulario real, antes de montar JS, hizo un GET nativo con los valores de la cuenta **sintética local** en la URL. El comprobador esperaba sólo que existiera el input, no su inicialización. Se corrigió esa espera y también el riesgo del producto: formulario `method=post`, botón inicialmente deshabilitado y habilitación sólo después de instalar el listener que cancela el envío nativo. Se versionó la importación. No se registraron credenciales reales ni se copiaron esos valores a evidencias. La prueba automatizada comprueba el orden listener→habilitación y el HTML seguro; el acceso local posterior pasó.

## 11. Pruebas automatizadas y SQL

- Frontend: **90 aprobadas, cero fallidas/skips**; 22 nuevas de colección/login + 68 previas del entorno. `collection.test.mjs` cubre catálogo, filtros, progreso, invitado, saldo, compra, doble clic, mascota, adquirida, insuficiencia, respuesta perdida, reintento con la misma clave después de recrear el store, reconciliación, error, cambio de usuario, respuesta tardía, expiración, almacenamiento, timeout, respuesta inválida, XSS/URLs/arte y errores HTTP.
- Backend: **118 aprobadas**, cero fallidas. Seis nuevas de catálogo (incluidos tres casos parametrizados) y una de revisión desplegada; autenticación/compra/trivia/AR y pruebas previas pasan. Una advertencia heredada de deprecación Starlette/TestClient/HTTPX; no se actualizaron dependencias.
- Base de datos: runner existente `phase02b_database.py`, **exit 0**, clean + upgrade aislados: **406 aserciones pgTAP** (203 por entorno: 81 economía, 63 juego, 45 AR, 14 esquema/permisos) y **38 escenarios concurrentes** (19 por entorno). También **34 checks Auth/FastAPI/PostgREST de Fase 2A por entorno** y controles AR. Verifican RLS, permisos, idempotencia, atomicidad, saldo/inventario/ledger y compatibilidad histórica. Se levantó Docker existente; no se instalaron componentes.
- Build CSS/esbuild/configuración: aprobado. `git diff --check`: sin errores. Migraciones históricas: sin diff. Escaneo de fuentes nuevas sin literales de claves secretas/JWT/llaves privadas.

`npm test` ahora descubre `checks/` versionado y `tests/` local si existe; evita que una copia limpia falle por un glob inexistente. Este entorno incluye 44 comprobaciones heredadas ignoradas en Git; una copia nueva ejecuta las 46 versionadas disponibles, no debe afirmar que ejecutó esas 44 locales. Las 22 de esta fase son versionadas. Package script actualizado, sin cambios de dependencias o lockfiles.

## 12. Navegador: fixtures frente a integración real

Ocho recorridos **HTTP simulados claramente señalizados**: guest 13, member 15, poor 12, owned 13, lost 15, uncertain 15, expired 15 y server-error 3 comprobaciones. Son recorridos con aserciones compartidas, no 101 casos únicos. Se conservan resultados y consola completa. En respuesta perdida el navegador puede reintentar transporte con el mismo header; la fixture registra idempotencia y el cliente también reconcilia. Los 502/401/cierre de conexión de los escenarios negativos son intencionales, no se ocultan.

Integración separada con **Auth + FastAPI + PostgreSQL locales reales**: cuenta sintética financiada sólo en proyecto desechable; **16 comprobaciones aprobadas**. Login real, catálogo, filtros, detalle, cancelar, confirmar/doble clic, compra de 250, saldo 1000→750, propiedad y saldo tras recargar. Otra sesión Auth independiente leyó 750 y una carta. Snapshot SQL final: **saldo 750, suma del ledger 750, un evento de compra y una carta**. No se declaró una compra simulada como real; tampoco se realizó una compra de producción.

Salida/reentrada SPA por Inicio→Colección: 20 cartas, un diálogo, nueva inicialización. Consolas de integración real, responsive y SPA guardadas sin errores. El viejo TypeError de observación del entorno integrado no apareció en esas consolas de colección; su investigación histórica no se considera resuelta por esta fase.

## 13. Ejecuciones fallidas intermedias y correcciones

El primer runner live no encontraba `app` al ejecutarse como script de `checks/`; se añadió al sys.path el backend del propio proyecto. Su `finally` detuvo los contenedores creados. No se cuenta ese intento como aprobado. La primera comprobación de confirmación pulsaba el botón durante la actualización por foco y falló; se espera habilitación. La primera automatización del login se adelantó al controlador y agotó timeout; corrección descrita arriba. Se repitieron los recorridos finales y pasaron.

Una operación de teclado del automatizador no funcionó al preparar capturas; se usó interacción de página y se verificaron dimensiones reales en cada evidencia. No es un fallo de la galería. No se declaran verificaciones de producción antes de observar su despliegue.

## 14. Archivos y dependencias

Backend: `app/services/cards.py`, `schemas/card.py`, `api/routes/cards.py`, `api/routes/health.py`, `tests/test_health.py`; nuevos `tests/test_collection_catalog.py`, `checks/phase03_live.py`, `checks/phase03_deploy_check.py`.

Frontend: `public/pages/coleccion/coleccion.html`, `public/css/Collect-Style.css`, shell `js/app/{main,navegacion}.js`; nuevo `js/api/collection-client.js`, `js/features/coleccion/{collection-page,model,store,view}.js`; corrección mínima de `pages/auth/login.html` y `js/features/auth/login.js`. Build-info en `scripts/generate-runtime-config.cjs` y `.gitignore`. Nuevo runner `scripts/test.cjs`, script test de package.json; checks/fixture de colección. Informe y evidencias.

Sin dependencias nuevas, iconografía externa ni imágenes generadas. Se reutilizan recursos locales. Sin modificaciones funcionales del motor AR, editor, trivia o juego.

## 15. Reproducción y evidencia

```powershell
Push-Location frontend
npm test
npm run build
Pop-Location
Push-Location backend
.\venv\Scripts\python.exe -m pytest -q -p no:cacheprovider
Pop-Location
.\backend\venv\Scripts\python.exe backend/checks/phase02b_database.py
node frontend/checks/phase03-preview.cjs
# Fixture explícita: http://127.0.0.1:4180/__review
# Integración real local en dos terminales:
.\backend\venv\Scripts\python.exe backend/checks/phase03_live.py
node frontend/checks/phase03-preview.cjs --live
# http://127.0.0.1:4181/__review; Entrar con cuenta local → Probar colección.
# Detener sólo ese proyecto: crear .tmp/phase03-live/STOP.
```

El runner live genera config/cuenta en `.tmp` ignorado, rechaza destino no loopback y para sólo sus contenedores. El catálogo de fixture versionado es una captura pública, no una constante de negocio. Tras la aceptación se detuvieron los entornos SQL propios; se preservó el stack `zona-diamante` que Docker restauró y no se usó para las compras.

Evidencias en `docs/evidencias/fase03/`: `{360,390,768,1440}-{galeria,detalle}.png`, `390-confirmacion.png`, `responsive.json`, resultados de ocho escenarios, `live-pruebas.txt`, `live-db-final.json`, `independent-session.json`, consolas completas y `spa-reentrada.txt`. Las capturas de propiedad usan fixtures y están documentadas como tales; el snapshot SQL y la sesión independiente corresponden a la compra local real.

## 16. Git y publicación

Commits de implementación: `abc83c7` (catálogo público/backend/revisión desplegada), `6d456a5` (álbum, compra y recuperación, login seguro, pruebas y evidencias), `d183ffb` (normalización/completitud de evidencia). La comprobación del diff staged detectó dos espacios finales en una captura AX; se quitaron en el tercer commit antes de integrar, sin cambiar mensajes de consola. El diff completo desde `efd9ea3` quedó limpio. No se reescribió historial.

La rama se subió a GitHub. Tras un nuevo fetch se comprobó que `main/origin/main` seguían en `efd9ea3`; integración **fast-forward** hasta `d183ffb` y push de `main` satisfactorios. La comprobación del árbol integrado coincidió con la rama de trabajo; compilación Python y sintaxis del servidor de revisión correctas. Sin force, conflictos ni cambios ajenos descartados. Los contenedores de pruebas y servidores 4180/4181 propios quedaron detenidos; las pestañas de prueba se cerraron.

**Publicación observada:** Netlify `build-info.json` y Render `/version` devolvieron ambos `d183ffb62b8f6206933257f113858f723ed34eb6`. Build Netlify: `2026-10-28T07:07:28.204Z`; smoke completo aprobado a `2026-10-28T07:08:48.116Z`. Evidencia `production.json`. Las primeras consultas, durante despliegue, obtuvieron 404 del marcador y timeout de Render; se esperó al servicio operativo, sin declarar éxito prematuro.

Smoke **no destructivo**: health 200, catálogo público real de 20 activas sin datos personales, colección/AR/me privados 401, CORS para el frontend, JS/CSS/bundle y seis páginas públicas 200. En navegador publicado: 20 cartas, detalle de invitado con login y sin compra, cuatro mascotas filtradas, reentrada SPA con 20 cartas/un diálogo. Trivia mostró el estado invitado; juego cargó sus controles; shell AR cargó el documento y estado de inicio de cámara, sin acreditar hardware. Se guardaron capturas públicas de invitado a 390/1440 y consola completa. No se probó compra ni saldo autenticado de producción.

Las configuraciones privadas de dashboards no se alteraron ni se leyeron directamente; los marcadores acreditan los commits efectivos y el build/publicación resultantes. La configuración pública de frontend apunta al backend correcto. No hay SQL remoto nuevo pendiente para esta colección. Un commit posterior de cierre documental puede contener este informe/evidencias sin cambiar el código publicado; para su revisión efectiva ejecutar el smoke con el HEAD de ese cierre.

## 17. Límites y aceptación pendiente

- No se gastaron puntos ni se modificó inventario de usuarios reales.
- No se ejecutaron migraciones remotas ni cambios de las históricas.
- Mascotas automáticas siguen pendientes de verificador fiable; AR se puede explorar y propiedad existente se respeta.
- Faltan retratos individuales para parte del catálogo; fallback explícito a identidad del equipo, sin información inventada.
- No se certifican hardware móvil, Safari, cámara/share físicos ni una compra autenticada en producción sin cuenta de prueba autorizada.
- El acceso a configuraciones privadas de Netlify/Render puede requerir sesión de dashboard; los artefactos/revisiones públicas acreditan el resultado efectivo cuando se desplieguen.
- La consola del navegador integrado publicó nuevamente `TypeError: Failed to execute 'observe' on 'MutationObserver': parameter 1 is not of type 'Node'`, ya desde Colección y antes de entrar a AR. `produccion-consola.json` lo conserva, sin filtros. Ningún módulo nuevo de colección usa MutationObserver. La investigación de Fase 2B ya lo reprodujo en un iframe sin scripts; eso apunta al entorno de inspección, pero no aporta la pila del contexto responsable de este evento. No se declara limpia esta consola ni se parchearon dependencias por suposición. Repetir en Chrome/Safari externo con pausa en excepciones antes de cerrar esa atribución.
- Las revisiones efectivas de ambas plataformas y el smoke público están comprobados; la compra de producción y el contraste externo de consola quedan expresamente pendientes. No impidieron probar la transacción local real y publicar la integración ya autorizada.
