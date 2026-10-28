# Cierre de Fase 4 — Beta funcional de béisbol

Fecha: 28 de octubre de 2026, America/Mexico_City. Base de auditoría `dbc6212`; rama de implementación `feat/game-beta-playable`.

## A. Estado general

**Beta funcional implementada, auditada e integrada en main; migración y despliegues públicos verificados.** La prueba económica autenticada en producción y los dispositivos físicos permanecen pendientes, sin presentarlos como aprobados. El usuario autorizó publicación/merge y migración necesaria; **no autorizó una cuenta autenticada de producción**, por lo que allí sólo se ejecutan comprobaciones públicas. Las recompensas se prueban con cuentas sintéticas y bases locales desechables.

## B. Mecánicas y flujo final

Inicio → instrucciones → modalidad → preparación/calibración → cuenta atrás real → lanzamiento → un bateo por pelota → feedback → siguiente lanzamiento → resultado de victoria/derrota → premio confirmado → replay/cambio de modalidad/Colección. El momento del bateo decide normal, perfecto, temprano o tardío; dejar pasar la pelota es fallo. No existe un botón de victoria ni un resultado predeterminado. Pulsar repetidamente no acumula aciertos.

La práctica usa reglas puras y un RAF con reloj monotónico. La partida oficial usa el horario y estadísticas de PostgreSQL; el navegador sólo anima su proyección. Se conservan pausa, reanudar, confirmación de reinicio/salida, abandono terminal, invalidación de callbacks y limpieza al navegar por SPA. En oficial la pausa detiene el siguiente lanzamiento; el plazo de la pelota actual continúa en el servidor y la UI lo explica.

## C. Modalidades, rachas y reglas definitivas de beta

| Modalidad | Victoria | Derrota |
| --- | --- | --- |
| Clásica | Al menos 6 aciertos después de resolver exactamente 10 lanzamientos | Menos de 6 al terminar los 10 |
| Racha | 5 aciertos consecutivos, con hasta 15 lanzamientos; termina al alcanzarlos | Agotar 15 sin esa racha |

Normal: 10 de score; perfecto: 20 **total**, además cuenta como acierto; fallo: 0 y reinicia racha. Máximo de racha se conserva. El score no es saldo del perfil. Base temporal: preparación 3000 ms, vuelo 1400, contacto 1200, ventana válida ±150 y perfecta ±50, feedback 600; factores de dificultad escalan juntos estos tiempos. La variación del lanzamiento oficial proviene del servidor, no determina victorias aleatorias.

## D. Cuatro dibujos y gráficos provisionales

Se usan íntegros los WebP originales b1 reposo, b2 carga, b3 swing y b4 seguimiento, RGBA 540×950. Manifiesto reemplazable `frontend/public/data/game-beta-art.json`: escala uniforme y desplazamientos de anclaje `(65,23),(74,1),(0,-1),(0,0)`. Los hashes de Prompt 2 confirman copia idéntica a los adjuntos. Se mantuvieron transparencia y estilo; no se generaron sustitutos.

Campo CSS/SVG, lanzador geométrico con brazo y pelota circular son provisionales y funcionales. Arte definitivo, audio y animaciones con más fotogramas son pendientes artísticos; no bloquean esta beta. Recursos ausentes tienen aviso/fallback sin conceder resultados ficticios.

## E. Frontend y experiencia

HTML/CSS/JavaScript nativos, sin framework ni dependencias nuevas. Botón grande de bateo, clic/toque/Espacio/Enter, guardas ante repetición y formularios, ayuda, puntuación/racha/progreso, récord local y resultado económico diferenciado. Invitados juegan práctica; personas autenticadas pueden elegir práctica sin puntos u oficial. Un 401 ofrece volver a iniciar sesión, no un premio ni una falsa sesión válida. Fallos de red ofrecen reconexión y mantienen la clave de recuperación.

Viewports reales del navegador integrado comprobados otra vez: 360×740, 390×844, 768×1024, 1440×900; sin overflow horizontal, controles principales ≥44 px, botón de bateo visible. CSS contempla movimiento reducido y mantiene el movimiento esencial de la pelota. Esto **no equivale a probar un teléfono físico ni a certificar su FPS**. Esa limitación se mantiene explícita.

## F. Backend, arquitectura y seguridad

FastAPI verifica el JWT con Supabase Auth en cada petición. Se reutilizan `activity_attempts`, `reward_events`, `profiles.points_balance`, `reward_operation_key`, `complete_activity_attempt` y compras existentes. No hay otro saldo ni inventario paralelo. DTOs estrictos rechazan usuario, score, victoria, premio o timestamp del cliente.

`game_beta_command` deriva la secuencia, ventanas y estadísticas, bloquea perfil → intento, mantiene revisión/nonce/UUID de pitch y cierra mediante la transacción económica existente. Un índice impide dos betas activas; recurso/claves estables impiden duplicar eventos aunque cambie el header. Fallo parcial revierte intento, evento y saldo. Legacy, trivia y AR conservan contratos/guardas.

Endpoints bajo `/api/v1/games/beta`: GET `/config` público; POST raíz para inicio; GET `/current` y `/{id}`; POST `/{id}/probe`, `/pitches`, `/pitches/{pitch_id}/swing`, `/transitions`, `/complete`. Todos salvo config exigen JWT; mutaciones exigen `Idempotency-Key`. Ajeno/inexistente son 404, sesión inválida 401, conflicto 409, entrada inválida 422 y límite operativo 429.

Tres probes de nonce miden ida/vuelta sin aceptar relojes del cliente. Mínimo admitido ≤250 ms, compensación limitada a 160 ms. TTL de 8 minutos, 30 inicios/hora, 20 pausas y 128 claves por partida. Un bot puede observar el plan y enviar swings válidos; este protocolo no demuestra humanidad. El cupo acota el juego a 180 puntos internos/día/cuenta; multi-cuenta y jitter siguen como limitaciones técnicas a vigilar.

## G. Puntos, límites y persistencia

Completar con al menos tres intentos de bateo aceptados: 10 puntos. Victoria Clásica: 50 total; Racha: 60 total. Abandono/expiración no premian; inactividad con menos de tres swings da cero. Sólo tres partidas positivas por día y usuario, compartidas entre modalidades, fecha de decisión persistida en America/Mexico_City. Agotar cupo no impide terminar otra partida: registra cero y explica el motivo.

Un evento `game_beta_completion` por partida. Reintentos, otra pestaña, recarga o respuesta perdida leen el mismo cierre. El saldo actual sigue siendo el de `profiles`; se consulta de nuevo al entrar en Colección y puede gastarse con el precio/RPC existente. No se modificaron precios, inventario ni concesiones AR. No se migran prácticas a premios oficiales retrospectivos.

## H. Pruebas y defectos corregidos en el cierre

| Comprobación nueva de este cierre | Resultado |
| --- | --- |
| `npm test` | **132 aprobadas**, 0 fallidas/skips; incluye 31 heredadas locales ignoradas y 101 versionables |
| `pytest` | **148 aprobadas**, 0 fallidas; advertencia heredada Starlette/TestClient/HTTPX |
| Build de producción | Aprobado: configuración práctica, CSS, Supabase y marcador de revisión |
| SQL limpia + upgrade histórico | **406 pgTAP** existentes + **76 checks SQL beta**, sin cambios de datos históricos |
| Concurrencia real PostgreSQL | **48 escenarios** en ambos entornos, incluyendo cierre/compra simultáneos |
| HTTP beta con Auth/PostgREST/DB reales | **94 checks**, más regresión HTTP legacy y AR |
| Navegador invitado | Recorrido completo determinista de ambas modalidades y cuatro tamaños |
| Navegador oficial local | Clásica mixta ganada (+50), Clásica perdida (+10), Racha ganada (+60), cupo diario, respuesta perdida, recuperación, 401 y red interrumpida |

Correcciones de auditoría:

1. Se recupera un inicio incierto incluso antes de recibir UUID, conservando su clave; no se confunde con una partida histórica ya terminada.
2. No se duplican RAF al reconectar y se detiene el render ocioso durante un fallo; los UUID se generan sólo al emitir comandos.
3. Se ofrece reautenticación ante 401; la conciliación conserva ese error aunque proceda de GET tras un 409.
4. Guardas de generación/desmontaje y exclusión de confirmaciones evitan actuar sobre una vista/cuenta nueva después de un await.
5. La calibración muestra «Preparando lanzamiento», sin contar un uno ficticio antes del 3–2–1 real.
6. Confirmar el bateo no reinicia los fotogramas que ya comenzaron durante la espera de red.
7. El CHECK JSONB de beta exige forma completa y verdadera; NULL/campos ausentes ya no eluden la restricción.
8. Auth y REST reutilizan conexiones HTTP por loop/lifespan, con cierre explícito y sin cachear identidades ni tokens. La producción anterior tardó ~420 ms en rechazar JWT inválidos; después del despliegue se midieron 312/125/156 ms en tres peticiones. Son observaciones de rechazo de JWT, no una certificación de latencia de partidas autenticadas ni de todas las regiones. No se amplió la ventana ni se debilitó Auth.
9. Se versionó la entrada/CSS a `20261028-game4` y se ignora la caché de pytest en Git, sin eliminar archivos del usuario.

Evidencias actuales en `docs/evidencias/fase04-cierre/`; los informes frontend/backend conservan sus evidencias históricas. Las fixtures SQL cambian deadlines sólo en bases propias para cubrir muchos casos; los recorridos HTTP y oficial del navegador usan reloj real. Los fallos controlados 401/red son explícitos y no invalidan JWT de usuarios reales. No se filtraron errores de consola ni se parchearon dependencias vendorizadas.

Consola oficial local sin entradas capturadas; la de invitado queda guardada íntegra. El MutationObserver intermitente del navegador integrado sigue descrito en Fase 2B; no se declara reparado por esta fase. Dos capturas largas de la herramienta fallaron y se conservaron en su lugar estado DOM, textos y consulta SQL local; no se atribuyen al juego ni se inventan imágenes.

La consulta SQL del stack propio confirma: Clásica ganó con 6 aciertos/3 perfectos/score 90 y +50; Clásica perdió con 0 aciertos y +10; Racha ganó con 5 perfectos y +60; dos victorias adicionales dieron cero por cupo; el spam perdió con 0/15 y cero; un inicio con latencia excesiva fue abandonado sin premio. Saldo final: 190 de fondos sintéticos +120 de premios −250 de compra =60, una carta, seis eventos de cierre. Los cambios de pestaña ralentizaron una calibración y activaron el guard de latencia; al mantener la vista activa se completó el recorrido de spam. No se amplió el límite para forzar aprobación.

Para repetir: `python backend/checks/phase04_live.py --evidence docs/evidencias/fase04-cierre`, seguido de `node frontend/checks/phase04-official-preview.cjs` y revisión en 4211. El helper deja por defecto evidencia en `.tmp`, evitando sobrescribir informes históricos. Los contenedores/servidores propios se cerraron; se preservó el Supabase local preexistente.

## I. Git y archivos

Cambios de esta fase: nuevo motor/estado/media/entrada/vista/controlador/cliente oficial en `frontend/public/js/features/juego/`, cliente `js/api/game-client.js`, HTML/CSS del juego, cuatro WebP/manifiesto, generador de reglas y scripts de build/test. Backend: router/esquemas/servicio beta, JSON canónico, pool HTTP, registro de rutas, pruebas unitarias y validadores. Documentación/evidencias Fase 4 y una migración nueva. Los archivos de Colección, AR y trivia permanecen iguales a main; las suites verifican sus contratos.

No se incluyen `.env`, node_modules, venv, runtime configs generadas, manifests con credenciales locales, respaldos ni `.tmp`. Revisión de texto actual e historia de Git sin patrones de secretos reales; se identificó y excluyó del detector únicamente el literal falso de una prueba de credenciales existente. Informe del escaneo sin imprimir valores.

Código publicado como `fd1b490b15e186b6d66881f07402169133c83bf9` en `feat/game-beta-playable` y main. Fetch confirmó que main no había recibido trabajo ajeno; integración fast-forward desde `dbc62123a0ac3519484f8e4759979c4a4926cd58`, sin force push ni conflictos. Main local y remoto coincidieron y el árbol quedó limpio antes de generar las evidencias de producción. El commit de cierre posterior contiene exclusivamente documentación/evidencias; la comprobación final de main se informa en el reporte de entrega. No se creó PR: se utilizó el procedimiento fast-forward ya empleado por el repositorio.

## J. Migración y producción

Nueva `20261028000100_game_beta_authority.sql`; las 22 anteriores se conservan. El proyecto enlazado coincide con el host de Supabase de producción. Se guardó respaldo de esquema público de 62.006 bytes en `.tmp/phase04-close/remote-public-before.sql`, fuera de Git y sin datos de usuarios. Dry-run identifica sólo esta migración pendiente, sin seeds ni roles adicionales.

Después del merge se ejecutó `supabase db push --linked --yes`: aplicó únicamente `20261028000100_game_beta_authority.sql`, sin seeds ni roles adicionales. `migration list --linked` confirmó las 23 versiones locales/remotas. Un dump posterior de esquema público (78.758 bytes, ignorado en Git) confirmó CHECK completo, índices únicos, RLS de intentos/eventos y ACL de `game_beta_command`: PUBLIC revocado, sólo service_role autorizado; sin grants a anon/authenticated. No hubo reset ni consultas de datos privados para las pruebas. Evidencia: `migration-apply.txt`, `migration-history.txt`, `migration-verified.json`. Las pruebas autenticadas de producción quedan **no ejecutadas por instrucción expresa del usuario: sin cuenta autorizada, sólo públicas**. No se crean usuarios ni se financian cuentas en producción.

Los marcadores anteriores señalaban `d183ffb`; después del merge se comprobó cada plataforma independientemente. `production.json`, tomado a las 19:17:47 UTC del 28/10, registra **Netlify y Render en `fd1b490b15e186b6d66881f07402169133c83bf9`**. Netlify indica build 19:16:58 UTC. `/health` OK, configuración beta correcta, siete páginas 200, cuatro imágenes byte a byte iguales al repositorio, CSS/JS/vendor disponibles, configuración pública sin credenciales privadas, catálogo de 20 cartas y CORS de Netlify aprobado. Cuatro rutas privadas sin sesión devuelven 401. El JSON público de práctica conserva economía deshabilitada.

El navegador abrió el juego publicado sin sesión, consultó/cerró ayuda, eligió Clásica, observó cuenta atrás y lanzamientos, bateó temprano, pausó y reanudó, terminó con derrota 0/10 sin puntos de cuenta y cambió a Racha. Capturas `produccion-pausa.png` y `produccion-resultado.png`; DOM en `produccion-resultado.txt` y `produccion-modalidad.txt`. Colección pública mostró las 20 cartas y el saldo oculto (—); perfil redirigió correctamente al login con next local, sin iniciar sesión. DOM en `produccion-coleccion.txt` y `produccion-perfil-login.txt`. El registro acumulado del recorrido conserva tres eventos con la misma firma MutationObserver entre juego/Colección/login (`consola-produccion-recorrido.json`); no se omitieron al cambiar de página.

**Estado final de consola del juego público:** un TypeError `MutationObserver.observe` con la firma histórica, guardado sin filtros en `consola-produccion.json`. Fase 2B lo reprodujo también en un iframe sin scripts y apunta al entorno de inspección, pero no se obtuvo pila del evento de producción: no se declara demostrada su atribución ni corregido. No hubo otra entrada capturada en ese recorrido. La consola oficial local quedó vacía; estas observaciones son distintas. Revisión externa con DevTools y pausa en excepciones sigue pendiente.

## K. Limitaciones y pendientes separados

- **Arte:** lanzador/campo/pelota provisionales, más fotogramas, fondos y audio. Funcionalidad presente, no bloquea la beta.
- **Técnicos:** bots/multi-cuenta, jitter y calibración en regiones/dispositivos, retención a escala y pruebas físicas de Safari/iOS/Android. No se simula aprobación de hardware.
- **Producción:** autenticación/recompensa real no probada allí por falta de cuenta autorizada; se valida localmente con Auth/DB reales y se contrasta despliegue público.
- **Herramienta:** MutationObserver intermitente del contexto de inspección, pendiente de pila externa; consola preservada.

## L. Checklist final

- [x] Reglas, rachas, victoria/derrota, pausas y repetición comprobadas.
- [x] Arte original, animación, pelota/lanzador y cuatro viewports comprobados.
- [x] Auth, propiedad, eventos, saldo, cupo, idempotencia, rollback y carreras aprobados.
- [x] Colección/precios/AR preservados; compras verificadas en entorno aislado.
- [x] Recuperación de arranque/red y sesión vencida corregidas y probadas.
- [x] Suites, build, SQL clean/upgrade y seguridad de archivos revisados.
- [x] Push y merge del código, main local/remoto iguales y árbol limpio antes de guardar evidencias públicas; cierre documental posterior sin cambios de producto.
- [x] Migración remota única, Netlify/Render comprobados por separado y smoke público.
- [ ] Prueba económica autenticada de producción: **no ejecutada por instrucción del usuario**, sin cuenta autorizada.
- [ ] Contraste físico móvil y pila externa del MutationObserver histórico.

Revisión recomendada: `game-official.js`, `game-page.js`, `game-state.js`, `game_beta.py` (router/servicio/esquema), `http_client.py`, la migración nueva y los checks `phase04_database.py`, `game-official.test.mjs`, `test_game_beta.py`, `test_http_client.py` y `phase04_deploy_check.py`.
