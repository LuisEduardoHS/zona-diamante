# REPORTE PARA CHATGPT — FASE 4

Fecha: 31 de octubre de 2026, America/Mexico_City.

**Estado global: PARCIAL, implementación y verificación local listas para revisión.** Se completaron los bloques viables A–H, con mejoras reales del juego, correcciones de integración y pruebas locales de economía. La aceptación subjetiva del juego, los dispositivos físicos y la validación autenticada de producción siguen pendientes. No se publicó esta fase en producción ni se fusionó en main.

## 1. Estado inicial y Git

- Repositorio: `D:\projects\zona-diamante`.
- Rama inicial: `main`; HEAD `1bc8d73` (`fix(trivia): add Sultan artwork for zero and one correct answers`).
- `git status --short` inicial vacío; `git fetch origin main` y comparación `main...origin/main`: `0 0`.
- Rama nueva: `feat/phase04-experience-polish`, creada sin sobrescribir ramas ni cambios ajenos.
- Había ramas históricas de Auth, backend, colección y juego. Las funcionalidades vigentes ya estaban integradas en main; no se retomaron versiones antiguas.
- Se revisaron README, auditoría histórica, cierre de colección, informes de beta, scripts de build/test, módulos reales y las 23 migraciones.

La auditoría antigua del 24 de octubre describía un prototipo de victoria con un clic. **Ese diagnóstico ya no corresponde a esta base.** La beta integrada incorpora motor temporal, dos modalidades, derrotas, sesiones oficiales, economía transaccional y recuperación. Se conservó esa implementación.

## 2. Auditoría general y estado real de cada sección

Las estimaciones expresan madurez dentro del alcance observado, redondeada a decenas; no son cobertura de tests, porcentajes medidos ni certificaciones. Se ponderan flujo implementado, integración, errores y validación disponible. Diseño/responsive se revisaron en navegador; rendimiento no equivale a mediciones de FPS o Lighthouse.

| Sección / estimación | Frontend y backend reales | Integración y datos | Diseño / responsive | Rendimiento / pruebas de esta fase | Pendiente / severidad |
| --- | --- | --- | --- | --- | --- |
| Landing e Inicio · ~90% | Una sola página `index.html`; carrusel, accesos, shell | Equipos desde JSON local, no calendario en vivo | Cuatro medidas sin overflow; calendario pendiente explícito | Proveedor de equipos cacheado; DOM/navegador y tests | Partidos no implementado; MEDIA, aclarado |
| Equipos · ~90% | Carrusel y proveedor normalizado | Cuatro equipos editoriales reales, contenido estático | Mantiene identidad y navegación | Tests de datos, rutas y ficha; lectura de código | No afirmar estadísticas actualizadas en tiempo real |
| Fichas · ~90% | `equipo.html?id=...`, galería, estadio, mascota, MVP | Sin exigir sesión; datos editoriales locales | Cuatro medidas auditadas, sin overflow | Tests de normalización/seguridad de URLs y carga | Calendario editorial/enlace no sustituye un calendario de producto |
| Auth · ~90% | Login, registro, recuperar, restablecer; Supabase Auth | Login real con cuenta sintética local; JWT FastAPI | Formularios existentes conservados; cuatro medidas | Suite backend y login usado por juego oficial | Registro con correo, expiración y logout no recorridos integralmente en esta fase |
| Perfil · ~90% | Consulta/edición/avatar/saldo y salida | Supabase, protegido por sesión | Controles y errores existentes; corrige cancelación | Tres regresiones UI nuevas, proveedor sintético; libera Blob URL | Edición/Storage remotos y prueba física pendientes |
| Trivia · ~90% | Cinco preguntas, guardado, resultados, límite diario | Backend/RPC y economía existentes; no se cambian importes | Ilustraciones 0–1, 2–3, 4–5 aciertos conservadas | Tests de estado, medianoche, recuperación y seis resultados en navegador | No se jugó trivia autenticada real en esta ejecución |
| Puntos · ~90% | Saldo de perfil y eventos transaccionales | Única economía existente, sin saldo paralelo | Se distingue score de partida y puntos de cuenta | Ledger real local, cierre, duplicados, rollback, concurrencia | Automatización/multicuenta siguen como límite del modelo |
| Colección · ~90% | Catálogo 20 cartas, filtros, inventario, compra, recuperación | FastAPI/Supabase; mascotas AR no comprables | Álbum y modal existentes conservados | Compra real **local sintética**, recarga, tests y SQL concurrente | Producción autenticada no probada; no reconstruida |
| Juego · ~90% | Motor de práctica y proyección oficial, dos modalidades | Servidor decide resultados económicos; cliente envía comandos | Panel unificado, señales de contacto, móvil y horizontal | 52 escenarios de navegador determinista; cuatro oficiales reales locales | Aceptación humana, teléfonos y latencia de redes móviles pendientes |
| AR · ~80% | MindAR/A-Frame, modelos GLB, inspector y panel de equipo | Inventario protegido; escaneo no concede cartas públicamente | Shell en cuatro medidas, editor existente | 35 checks con video/reconocimiento simulados y WebGL/Canvas reales | Escaneo y permisos en teléfonos reales pendientes |
| Foto/editor AR · ~90% | Captura, siete filtros, ajustes, confirmar/cancelar/exportar | Procesamiento local, no recompensa económica | Controles/modal existentes; prueba funcional en navegador | Píxeles JPEG, descarga, compartir simulado y cierre de pista | Web Share del SO y cámara física pendientes |
| Información/Ayuda · ~90% | Contenido editorial y controles existentes | Sin backend económico | Cuatro tamaños sin overflow observado | Smoke de DOM y consola, sin cambios visuales innecesarios | Revisión editorial futura |
| Navegación · ~90% | Router SPA, menú modal, barra inferior, limpieza por señal | Rutas públicas/Perfil protegido | Pausa al abrir menú, foco recuperado al reanudar | Salida/reentrada juego, limpieza RAF/Blob URL | bfcache y cambios de app en dispositivos físicos pendientes |
| Calendario · 0% como función independiente | No hay ruta/controlador de calendario completo | No hay fuente de partidos integrada | Inicio informa «Partidos · próximamente» | Botón deshabilitado comprobado en navegador | Producto pendiente, fuera del desarrollo de esta fase |

No se encontró una sección separada de landing ni un calendario funcional que debiera conservarse. Los datos editoriales de equipos no se presentan aquí como consultas en vivo a una liga.

## 3. Incidencias, prioridad y alcance

| Prioridad / severidad | Hallazgo antes de corregir | Resolución / evidencia |
| --- | --- | --- |
| P1 / ALTA | El bateo usa `click`: la acción llega al soltar, sumando el tiempo del gesto al timing | `pointerdown` primario; click de teclado/tecnología asistiva conservado; soltar después no batea otra pelota |
| P1 / MEDIA | Campo muy comprimido en 360×740 y HUD/objetivo/control visualmente dispersos | Panel único, marcador contrastado, distribución por altura, progreso del objetivo, composición móvil/horizontal |
| P1 / MEDIA | El jugador recibe una orden genérica sin saber cuándo está dentro de la ventana | «Espera la pelota», «¡Ahora! Batea», «Pasó el momento»; aro y botón cambian junto al texto |
| P1 / MEDIA | Temprano/tarde sin orientación para el siguiente intento | Consejos cortos según resultado y un solo intento por pelota |
| P1 / MEDIA | Menú global y pérdida de foco dejan transcurrir una práctica | Pausa al abrir diálogo global o perder foco; reanudar devuelve foco al campo |
| P1 / ALTA | Descartar en Perfil construye usuario sólo con email, perdiendo ID de sesión local | Se conserva el objeto de usuario original; regresión de identidad verificada |
| P2 / MEDIA | Respuesta tardía de Perfil puede reescribir sesión después de navegar; avatar temporal sin liberar al salir | Perfil recibe AbortSignal del router; descarta callbacks obsoletos y revoca URL temporal |
| P2 / MEDIA | Una solicitud oficial de red puede quedar esperando sin límite explícito | Deadline de 15 s por petición; el motor reintenta con la misma clave, luego permite reconectar |
| P2 / MEDIA | Pausa oficial sigue redibujando cada RAF | Un timer por segundo conserva conciliación de expiración/servidor; sin RAF ocioso |
| P2 / MEDIA | Coordenadas de pelota escritas como left/top por fotograma | Proyección por transform, dimensiones cacheadas por ResizeObserver y desconexión al desmontar |
| P2 / MEDIA | Botón Partidos sin acción | Estado próximo/deshabilitado accesible; no se simulan fechas |

No se confirmó un nuevo fallo crítico de seguridad. Esto no constituye una auditoría de penetración ni una garantía de ausencia de vulnerabilidades. En la inspección final se corrigieron dos solapamientos adicionales: el borde de Batear con la cámara en 360×740, y la guía temporal con la barra inferior en escritorio. El test ahora comprueba hit testing real de ambos controles.

## 4. Diagnóstico del juego y decisión de arquitectura

### Antes

El juego ya era funcional: HTML/CSS/JS nativos, campo CSS/SVG, cuatro WebP de bateador, lanzador CSS, pelota DOM, RAF monotónico, funciones puras de puntuación y motor oficial. No utiliza Canvas para la simulación. Las poses y el lanzador siguen siendo arte limitado de beta; no se inventaron sprites nuevos.

Se ejecutó la interfaz real con reloj de prueba y con el reloj real del modo oficial. Se inspeccionaron inicio, contacto, victoria, derrota, pausa, reintento y navegación. La medición de la interacción mostró que el controlador esperaba `click`, confirmado por el código y por la prueba de mantener presionado/soltar. Las capturas iniciales se reconstruyeron sirviendo exactamente los archivos de `1bc8d73` mediante rutas del navegador; no se confundieron con capturas del código modificado.

### Decisión

Se eligió **refactorización parcial**. El estado puro y el contrato económico ya están separados y probados; reemplazarlos habría añadido riesgo sin resolver la demora del gesto ni la composición. Se conservaron el género, los cuatro originales, las reglas, precios y backend. No se introdujeron framework, motor, dependencias ni migraciones.

### Mecánica final

- Clásica: exactamente diez lanzamientos; gana con seis o más aciertos.
- Racha: cinco aciertos consecutivos; pierde al agotar quince sin lograrlos.
- Un bateo por pelota. Normal suma 10 de score; perfecto 20 en total; un fallo suma cero y reinicia la racha.
- Ventanas derivadas del plan vigente, incluidas sus variaciones de dificultad; las señales nuevas no amplían tolerancias ni deciden recompensas.
- Cuenta atrás, pelota, carga/swing/seguimiento, feedback y resultado conservan su secuencia.
- El progreso segmentado muestra aciertos hacia la meta en Clásica y racha actual en Racha.

### Controles y estados

Mouse/toque registran al presionar; se ignoran botón secundario, puntero no primario y click posterior a la liberación. Espacio, Enter y activación asistiva mantienen el botón nativo; se ignoran repetición, formularios, enlaces y diálogos. `touch-action` evita desplazamiento en el área de juego, sin bloquear toda la página.

La preparación corresponde a home/modos/carga. En práctica: `countdown → pitch → feedback → finished`; pausa conserva `pausedFrom`; `abandoned` es terminal. Victoria/derrota están en `outcome`. Reiniciar abandona la anterior y crea ID, métricas y cuenta atrás nuevos; cancelar confirmación conserva pausa. En oficial se proyectan `waiting`, `pitch`, `paused`, `ready`, `completed`, `expired` y `abandoned` del servidor. No se añadió un estado paralelo «ganado» que pudiera acreditar puntos.

La pausa local congela simulación y puntuación. La pausa oficial **no congela el plazo de la pelota actual en el servidor**; la interfaz lo explica y bloquea bateo hasta reanudar/conciliar. El tiempo oficial tampoco se detiene por pérdida de conexión. Se cancelan RAF, timer de conciliación, observador de tamaño, listeners y solicitudes al desmontar.

### Diseño, pantallas y animaciones

Inicio/modalidades conservan la identidad y el arte existente. La partida reúne estadio, marcador y control; adapta el campo a la altura disponible. Turquesa, naranja, Urbanist y controles redondeados se mantienen. Se añadieron señales textuales y visuales de contacto y orientación tras fallar. No se añadieron confeti ni efectos que bloqueen el bateo.

Resultado conserva estadísticas, reintento, cambio de modo y acceso a Colección. La animación de resultado y el pop de racha respetan movimiento reducido; se mantuvo la trayectoria esencial para jugar. Se probó `prefers-reduced-motion: reduce` en 768×1024. No se certifica conformidad WCAG ni se afirma haber medido todos los contrastes.

## 5. Backend, seguridad y limitaciones económicas

Se inspeccionaron router/esquemas/servicio beta, validación de JWT, cliente HTTP compartido y SQL de sesiones/recompensas. El backend no recibió cambios de producto. Se reutilizan `activity_attempts`, `reward_events`, `profiles`, inventario, revisiones, claves de idempotencia y transacción de cierre/compra.

FastAPI determina identidad mediante Auth. PostgreSQL calcula plan, timing, score, estado y premio; el cliente no envía `won`, score arbitrario, puntos ni identidad elegida por él. El cierre bloquea datos y se acredita una vez. Funciones económicas restringidas al servidor, RLS y restricciones existentes permanecen intactas. Los checks locales incluyen usuario ajeno, transición inválida, duplicados, concurrencia, rollback y compra simultánea.

Economía conservada: completar con tres intentos aceptados da 10; victoria Clásica 50 total, Racha 60 total; tres partidas positivas por día de Ciudad de México. Expiración/abandono sin premio, cupo agotado devuelve cero. No se alteraron precios ni saldos reales. No se habilitaron concesiones públicas AR ni se utilizó un reconocimiento local como prueba física.

La automatización puede jugar correctamente: el protocolo no demuestra humanidad ni evita multicuenta. El cupo limita puntos por cuenta, no resuelve esos abusos por sí mismo. La latencia/jitter también puede dificultar el modo oficial. Se conserva el límite de probes existente; no se relajó para aprobar pruebas. El deadline nuevo conserva la clave de una operación incierta: **timeout no significa que el servidor no haya aplicado la operación**.

No hay migraciones nuevas ni cambios a las 23 históricas. No se ejecutó `db push`, SQL remoto ni operaciones económicas contra producción. Se levantaron bases desechables propias con puertos/IDs únicos; se preservó el stack local preexistente de Zona Diamante.

## 6. Rendimiento, integración y accesibilidad

- Pelota: transform en vez de left/top cada RAF; tamaño leído al crear/redimensionar, sin medición de layout por frame.
- Vista oficial: reutilizada entre snapshots con reglas iguales; el observador anterior se desconecta al cambiar reglas, reiniciar o salir.
- Pausa oficial: cero RAF de render continuo; timer de un segundo para conciliar, retirado al reanudar o destruir.
- Perfil: Blob URL liberada al descartar/salir, callbacks de otra vista ignorados; identidad conservada al cancelar.
- Red del juego: límite 15 s por solicitud y recuperación explícita, sin nuevos premios locales. No se modificó el cliente global de compras/trivia.
- Controles principales ≥44 px; se verificó que Batear y la franja no queden tapados por la navegación.
- Teclado, foco visible, diálogos nativos, consejos textuales y movimiento reducido conservados/mejorados. Al reanudar, Espacio vuelve a actuar sobre el campo.

No se midieron FPS, consumo de memoria, batería ni tiempos de carga bajo una red móvil física. La reducción de trabajo se sustenta en código y pruebas del planificador; no se presenta como una mejora porcentual de rendimiento.

## 7. Pruebas ejecutadas y resultados

Evidencia nueva exclusivamente en `docs/evidencias/fase04/experiencia/`, sin reemplazar informes históricos de fases anteriores.

| Verificación / comando | Resultado y alcance |
| --- | --- |
| `npm --prefix frontend test` | 137 aprobadas, cero fallos/skips; 106 de `checks/` versionados y 31 heredadas locales ignoradas |
| `backend/venv/Scripts/python.exe -m pytest -q -p no:cacheprovider`, cwd backend | 148 aprobadas; una advertencia heredada de Starlette/TestClient/httpx |
| `npm --prefix frontend run build` | Configuración práctica, CSS, bundle Supabase y configuración pública generados correctamente |
| `python backend/checks/phase04_database.py` usando venv | Aprobado en base limpia y upgrade histórico; datos/IDs/editorial/economía anteriores conservados |
| pgTAP | 203 aserciones por entorno: 81 economía +63 juego legacy +45 AR +14 esquema; **406 total** |
| Checks beta SQL | 38 por entorno, **76 total**; incluye cierre, premio, colección y rollback |
| Concurrencia real | 7 economía +7 juego legacy +5 AR +5 beta por entorno; **48 escenarios** total |
| Auth/FastAPI/PostgREST beta | 47 checks por entorno, **94 total**, con reloj real y victoria de cinco hits; además 34 HTTP legacy por entorno y recorrido AR/inventario |
| `node frontend/checks/experience-browser.cjs --baseline` | 15 capturas de base `1bc8d73`; tres estados ×cinco tamaños, sin alegar escenarios nuevos aprobados |
| `node frontend/checks/experience-browser.cjs` | **52 escenarios** UI, reloj monotónico inyectado, invitado sin economía; cero page errors |
| `node frontend/checks/experience-integration-browser.cjs` | **44 página/viewports** sin overflow horizontal; tres regresiones de Perfil con proveedor sintético |
| `node frontend/checks/experience-official-browser.cjs` | Cuatro partidas oficiales con Auth/FastAPI/PostgreSQL reales locales; reloj real, sin alterar estado, plan ni deadlines |
| Fixture AR existente `phase02b-preview.cjs` + `phase02b-browser.js` | **35 comprobaciones** de editor y una de salida/liberación de pista; Canvas/Blob/WebGL/GLB reales, video/reconocimiento/share simulados; cero page errors |
| GET públicos de producción | Inicio y juego 200; health/config/catalog 200, catálogo 20; `/me` y trivia sin JWT 401. Sin mutaciones |
| Revisión de Git | diff sin errores de espacios, sin backend/migraciones modificadas ni archivos de entorno añadidos; escaneo por patrones sin hallazgos en los archivos de texto modificados/nuevos antes de publicar rama |

Los tests de navegador requieren Playwright instalado y Edge. En esta máquina se utilizó Playwright del runtime ya disponible mediante NODE_PATH, sin añadirlo a package.json. La suite `npm test` incluye tests heredados ignorados; se informa esa diferencia para que un checkout limpio no prometa 137 casos si sólo tiene los 106 versionados.

### Partidas oficiales y conciliación económica real local

Se creó cuenta sintética en un stack desechable con 190 puntos de fixture. El navegador inició sesión mediante el formulario real. Resultados: Clásica ganada +50, Racha ganada +60, Clásica perdida con tres swings +10, otra Racha ganada +0 por cupo diario. La primera respuesta de cierre se perdió **después del commit** mediante intercepción controlada; el reintento reutilizó la misma clave. Recargar recuperó el resultado persistido.

Colección leyó saldo 310. Una compra sintética de 250 quedó adquirida y persistió después de recargar. Consulta final de PostgreSQL: funding 190, cuatro eventos de juego, premios 120, una compra, una carta; **ledger=balance=60**. Esto no equivale a una compra de un usuario real ni una prueba autenticada de producción.

### Límites y correcciones durante las pruebas

La primera ejecución de pytest desde la raíz no encontraba `app`; se repitió desde backend con el intérprete correcto. El primer harness global esperaba visibilidad de un wrapper de altura cero en páginas de posición fija; se corrigió para esperar su existencia, conservando las aserciones de viewport. El hit test móvil detectó el solapamiento de cámara y Batear; se ajustaron espacios/altura. La inspección visual de escritorio detectó guía temporal bajo navegación; se corrigió y se añadió aserción explícita.

La revisión general de las 44 páginas/tamaños es un smoke de DOM/red/consola, no 44 recorridos autenticados completos. La prueba de pérdida de foco del juego usa un evento de navegador controlado. La prueba táctil es emulación de touchscreen de Edge. No se sustituye con ello el cambio de app, bfcache, cámara o Web Share de un teléfono físico.

## 8. Evidencias visuales y reproducción

- `antes-{inicio,activo,contacto}-{ancho}x{alto}.png`: base sin cambios.
- `despues-{inicio,activo,contacto,pausa,victoria,derrota}-{ancho}x{alto}.png`: interfaz final en 360×740, 390×844, 768×1024, 1440×900 y 844×390.
- `oficial-*.png`: resultados reales de cuatro partidas locales. No contienen credenciales.
- `game-browser.json`, `integration-browser.json`, `official-browser.json`: alcance, comprobaciones y consola.
- `browser-db-final.json`: conciliación SQL de la cuenta sintética, sin JWT ni claves.
- `ar-browser.json`, `ar-editor-simulado.png`: resultado y alcance explícitamente simulado de cámara/reconocimiento/share.
- `public-read.json`: smoke público de producción de sólo lectura.
- Logs `frontend-tests.txt`, `backend-tests.txt`, `build.txt`, `database-tests.txt` y `game-browser.txt` acompañan la entrega.

Reproducción de práctica: iniciar `node frontend/checks/phase04-preview.cjs`; abrir `http://127.0.0.1:4190/pages/experiencias/juego.html` para jugar con reloj real. Puerto 4191 se reserva al reloj determinista utilizado por `experience-browser.cjs`. Ejecutar los scripts desde la raíz con NODE_PATH si Playwright no es dependencia local.

Reproducción oficial: iniciar `backend/venv/Scripts/python.exe backend/checks/phase04_live.py --evidence docs/evidencias/fase04/experiencia`; después `node frontend/checks/phase04-official-preview.cjs` y `node frontend/checks/experience-official-browser.cjs`. Usa sólo el manifiesto de localhost generado por ese helper. Terminar creando `.tmp/phase04-live/STOP` y esperar el cierre. El helper comprueba la conciliación y elimina exclusivamente su stack. Nunca sustituir por credenciales ni hosts de producción.

## 9. Pruebas físicas pendientes

1. Android Chrome e iPhone Safari: abrir el juego como invitado, completar Clásica y Racha con toque; verificar que mantener/soltar no duplica bateo y no desplaza la página.
2. Cambiar vertical/horizontal durante pelota y pausa; comprobar aro, pelota, franja y Batear sobre las áreas seguras del dispositivo.
3. Abrir menú, bloquear teléfono y cambiar de app; confirmar pausa y recuperación sin aceleración ni juego duplicado. En oficial, comprobar que el plazo del servidor continúa según el mensaje.
4. Navegar Inicio→Juego→Colección→atrás, usar bfcache y varias partidas; observar foco, animaciones y posibles callbacks obsoletos.
5. En AR autorizar, denegar y revocar cámara; reconocer los cuatro marcadores físicos con diferentes luces, entrar/salir del inspector y verificar indicador de cámara apagado al abandonar.
6. Capturar, editar, confirmar/cancelar, descargar y compartir con la hoja real del SO; comprobar colores, orientación, archivo y cancelación.
7. Con una cuenta de QA autorizada, validar latencia y recuperación de una partida oficial en la red objetivo. No gastar saldos reales sin autorización específica.

Nada de esta lista se marca aprobado por haber usado emulación.

## 10. Revisión final, pendientes y aceptación

Se compararon capturas iniciales/finales. El control ahora registra al tocar; las señales explican espera/contacto/fallo; el objetivo es visible por segmentos y las estadísticas permanecen consistentes tras reinicio/navegación. La barra temporal y Batear quedaron visibles en los cinco tamaños. La continuidad económica se comprobó con SQL real local. No se promete que una prueba automatizada demuestre diversión: **el usuario debe aceptar el resultado visual y la sensación al jugar**.

Checklist:

- [x] Auditoría A con matriz, hallazgos y prioridades.
- [x] Juego B mejorado y ambas modalidades completadas; controles/estados probados.
- [x] C/D: revisión general, corrección de Perfil y estado honesto de Partidos.
- [x] E: animación de pelota, vista, pausa y limpieza mejoradas; sin dependencias nuevas.
- [x] F: protecciones económicas conservadas, SQL/concurrencia local aprobados.
- [x] G: frontend/backend/build/navegador y evidencias, diferenciando mocks/integración.
- [x] H: segunda inspección y corrección de solapamientos.
- [ ] Aceptación humana de la experiencia.
- [ ] Teléfonos/cámara/share físicos y rendimiento real.
- [ ] Verificación autenticada de producción después de una publicación autorizada.
- [ ] Merge/despliegue, deliberadamente pendientes de revisión.

Pendientes de producto/técnicos: calendario independiente; arte/animaciones adicionales del lanzador si se desean; pruebas de red móvil y balance de dificultad con personas; resistencia a automatización/multicuenta; QA de correos Auth, logout y Storage en un entorno controlado. Ninguno se disfraza de funcionalidad terminada.

## 11. Archivos, dependencias, commits y publicación

Producto modificado: HTML/CSS del juego; `game-input`, `game-media`, `game-view`, `game-page`, `game-official`, cliente API de juego; router/entrada principal para ciclo de Perfil y versión de recursos; Perfil e Inicio. Se mantuvieron los assets originales, backend, economía, precios, colección y migraciones.

Pruebas versionadas nuevas: `game-experience.test.mjs`, `experience-browser.cjs`, `experience-integration-browser.cjs`, `experience-official-browser.cjs`; se amplió `game-official.test.mjs`. Documentación/evidencias nuevas bajo esta fase. El listado exacto queda en el commit y `git show --stat`.

Dependencias añadidas: **ninguna**. No se incluyen `.env`, venv, node_modules, configuraciones públicas generadas ni manifiestos de cuentas locales. Los servidores AR/oficial y los stacks desechables se cierran al entregar; se conserva el Docker/Supabase preexistente del usuario. Se deja la previsualización de práctica en 4190 y la fixture determinista en 4191 para revisión local; pertenecen al proceso `node frontend/checks/phase04-preview.cjs`, sin sesiones ni recompensas oficiales.

Commit de implementación y evidencias: `df05498` (`feat(experience): improve batting input, game feedback and session lifecycle`). Push normal completado a `origin/feat/phase04-experience-polish`; comparación local/remota `0 0` y árbol limpio, verificados después del push. Un commit posterior registra este cierre documental. Main local permanece en `1bc8d73`; no hay force push, merge automático, migraciones remotas ni despliegue de esta fase.

**Recomendación de publicación:** rama apta para revisión visual y funcional; integrar sólo después de aceptar la experiencia y resolver los requisitos físicos del público objetivo. Esta entrega no afirma que main contenga estos cambios.

## 12. Tres próximas prioridades

1. QA humana y de teléfonos: timing, dificultad, orientación, latencia, segundo plano y recuperación oficial; decidir si hace falta más arte del juego a partir de esa evidencia.
2. Validar Auth/Storage/AR en entorno controlado y dispositivos físicos, con una cuenta de QA, sin abrir recompensas AR basadas sólo en el navegador.
3. Definir el calendario: fuente de partidos, actualización, zona horaria y estados sin datos; desarrollarlo como fase independiente.
