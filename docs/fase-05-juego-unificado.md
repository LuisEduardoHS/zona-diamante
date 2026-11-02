# Fase 5 — Juego de bateo unificado

Fecha: 1 de noviembre de 2026, America/Mexico_City.

Actualización: las partidas nuevas ahora siguen la [fase 06](fase-06-juego-supervivencia.md):
meta de 10 hits, tiros ilimitados y tres fallos acumulados. Esta fase conserva
la especificación histórica del protocolo `unified-1`.

## Estado y alcance

Implementación local del juego nuevo. Publicación pendiente de la migración
`20261101000100_unified_batting_game.sql`. No se aplica una migración remota,
no se integra en main y no se despliega una combinación incompatible.

La auditoría comenzó con árbol limpio en `feat/phase04-experience-polish`,
HEAD `7fbcaf4`. Main local y origin/main estaban en `1bc8d73`. Los commits
`df05498` y `7fbcaf4` de Fase 4 **no estaban integrados**. Se creó
`feat/unified-batting-game` desde esa rama para conservar entrada al presionar,
ventanas de contacto, recuperación, limpieza de RAF y mejoras de navegación.

## Producto, flujo y mecánica

El selector de modalidades, tutorial, tarjetas de instrucciones, récords y
menús internos anteriores se sustituyen por **portada → partida → resultado**.
Iniciar lanza directamente el único reto nuevo, `unified`.

Cada partida resuelve exactamente diez lanzamientos. Cinco hits dan victoria;
con cero a cuatro se pierde. Nunca termina anticipadamente. Un lanzamiento sin
swing cuenta como fallo, sólo se acepta un swing por pelota, los fallos rompen
la racha actual y la máxima se conserva. Se mantienen timing normal/perfecto y
las cuatro poses. El score técnico sigue disponible en auditoría, separado del
saldo, y deja de competir visualmente con los hits en el HUD.

## Economía

La función privada SQL `unified_game_reward` calcula:

- Menos de cinco hits: cero puntos.
- Victoria: 30 de base, más 5 por cada hit por encima de cinco.
- Máxima racha de tres o cuatro: un bonus de 5.
- Máxima racha de cinco o más: un bonus de 10 que sustituye al de 5.

| Hits | Racha máxima | Premio nominal |
| --- | --- | --- |
| 3 | 2 | 0 |
| 5 | 2 | 30 |
| 6 | 2 | 35 |
| 7 | 3 | 45 |
| 8 | 5 | **55** |
| 10 | 10 | 65 |

El ejemplo de 8 hits/racha 5 del brief decía 60, pero la fórmula da
30 + 15 + 10 = **55**. Se aplica la fórmula, sin un escalón adicional inventado.
El máximo diario pasa de 180 a 195 (+8,33 %), con el mismo cupo de tres partidas
positivas por cuenta y día de Ciudad de México. Se comparte el cupo con las
sesiones beta históricas. Las derrotas nuevas ya no conceden los 10 puntos de
participación de la beta. No cambian trivia, precios, compras ni inventario.

El premio nominal se guarda separado del crédito efectivo. Agotar el cupo
permite seguir jugando: se indica práctica sin puntos, se cierra con crédito
cero y se conserva el nominal para auditoría. El saldo y los puntos ganados
sólo aparecen después del cierre confirmado del servidor. Invitados ven «—»
y «Práctica · sin puntos de cuenta».

## Backend, persistencia y seguridad

Se extiende el contrato existente `/api/v1/games/beta` con `mode: unified` y
versión de sesión `unified-1`. Se conservan las rutas start/current/read/probe,
pitches/swing, transitions y complete; no hay otra vía de reclamar premios.
`BetaRead` acepta también sesiones `beta-1`. La respuesta añade desglose opcional
`base_points`, `extra_hit_bonus`, `streak_bonus`, `nominal_points` y estado `lost`.

PostgreSQL resuelve los diez tiros y calcula victoria/racha/premio. FastAPI
obtiene identidad del JWT, inyecta reglas propias y rechaza score, hits, tiempo,
usuario o premio libres del navegador. Se conservan revisión, nonce, UUID de
lanzamiento, límites de comandos/latencia/TTL y claves idempotentes.

Se reutilizan `activity_attempts`, `reward_events`, `profiles.points_balance`,
la transacción `complete_activity_attempt`, el bloqueo de perfil y los índices
únicos. Cierre concurrente, compras y límites diarios siguen serializados.
Se mantiene RLS y la RPC continúa sólo para `service_role`; el helper económico
nuevo tampoco se concede a anon/authenticated.

La migración nueva reemplaza funciones y amplía el CHECK sin editar migraciones
antiguas ni actualizar filas históricas. Clásica y Racha conservan sus reglas y
premios en sesiones antiguas. Una sesión histórica aún activa se puede recuperar;
una histórica terminada no sustituye el reto nuevo. No hay selector para crear
esas modalidades desde la UI nueva.

Pausa oficial detiene la emisión del siguiente lanzamiento; el actual sigue
su plazo en el servidor. Ocultar pestaña, perder foco o abrir el menú pausa.
Desmontar la SPA cancela trabajo local; conserva el journal para recuperar la
sesión oficial. Una respuesta perdida conserva la clave y consulta el cierre
persistido. Los errores de red no anuncian crédito ni muestran dos paneles de
pausa superpuestos.

## Diseño y recursos

Se usa el PNG suministrado como estadio completo con proporción 9:16, sin
reconstrucción CSS ni deformación. Las cuatro imágenes WebP del bateador ya
existentes son idénticas byte a byte a los nuevos adjuntos. Se conservan alfa,
escala uniforme y anclajes por pose. El bateador se coloca delante del plato,
con sombra y trayectoria coherente con el montículo.

La portada lleva fondo oscurecido/desenfocado, título grande «Juego», etiqueta
y botón Iniciar. Partida: HUD pequeño de hits/meta, tiros resueltos/10, racha
y diez segmentos; toda la tarjeta admite bateo al presionar, Espacio/Enter y
activación accesible. «Presiona para batear» es un aviso de texto.
Resultado: estadio desenfocado, tarjeta turquesa, números grandes para premio
y saldo, resultado/hits/bonus y Mi colección, como la referencia.
El diamante superior conduce a Colección; menú y navegación inferior usan la
SPA existente. Urbanist, turquesa/naranja, esquinas redondeadas y pausas breves.

**Arte pendiente:** lanzador definitivo con preparación/lanzamiento/seguimiento,
pelota transparente y, opcionalmente, efectos de contacto y audio. El lanzador
geométrico y pelota con costuras son provisionales funcionales. No se generaron
imágenes que sustituyan los dibujos originales.

## Revisión visual y responsive

Capturas reales del navegador integrado en `docs/evidencias/juego-unificado/`.
Primera revisión: se aumentó el título para ocupar la portada, se desplazó el
bateador a la izquierda para revelar el lanzador y se ajustó el apoyo cerca del
plato. Segunda revisión: estadio completo y escalas, botón visible, tarjeta
de resultado y HUD comprobados; HUD compacto en horizontal para conservar
el estadio vertical. Se corrigió una superposición en el estado de reconexión.

Tamaños requeridos: 360×740, 390×844, 768×1024, 844×390 y 1440×900.
Se respetan safe areas, controles de al menos 44 px y movimiento reducido.
Las métricas DOM y capturas documentan overflow, posición del control/HUD y
navegación. No equivalen a ensayos de FPS ni pruebas en teléfonos físicos.

## Pruebas y evidencias

Comandos de reproducción desde la carpeta indicada:

```powershell
cd D:\projects\zona-diamante\frontend
npm test
npm run build
node checks/phase04-preview.cjs
# Navegador: http://127.0.0.1:4191/__unified-review

cd D:\projects\zona-diamante\backend
.\venv\Scripts\python.exe -m pytest -q
cd D:\projects\zona-diamante
.\backend\venv\Scripts\python.exe backend/checks/phase05_database.py
```

Las pruebas Node cubren casos nuevos 0/4/5/6/10 hits, diez tiros exactos,
racha/fallos, doble activación, premio confirmado, práctica/cupo y recuperación
histórica; conservan suites previas de red, pérdida de respuestas, 401,
generaciones, RAF, pausa y entradas. Pytest valida DTO, identidad, rechazos de
campos manipulados y compatibilidad de respuestas.

`phase05_database.py` usa dos proyectos Supabase **locales desechables no
enlazados**, uno limpio y otro actualizado desde 18 migraciones históricas.
Ejecuta pgTAP/economía/legacy/AR, rollback, concurrencia, HTTP con Auth real,
casos nuevos de premios y el recorrido oficial de diez hits con reloj real.
Las fixtures SQL que desplazan deadlines sólo operan dentro de esos contenedores;
los recorridos HTTP y oficiales del navegador usan el reloj real.

Para navegador oficial, `phase04_live.py --evidence docs/evidencias/juego-unificado`
crea otro stack local propio y cuenta sintética; `phase05-official-preview.cjs`
lo sirve en 4211. El botón QA pulsa los controles reales; no modifica estadísticas
ni reloj oficial. Manifest y credenciales quedan sólo en `.tmp` ignorado.

Resultados definitivos:

| Validación | Resultado |
| --- | --- |
| `npm test` | 147 aprobadas, cero fallos/skips; incluye pruebas heredadas locales de `frontend/tests` ignoradas en Git |
| `pytest -q` desde backend | 150 aprobadas; una advertencia heredada Starlette/httpx |
| `npm run build` | Reglas, Tailwind, Supabase y configuración generados correctamente |
| PostgreSQL limpio + upgrade | 406 aserciones pgTAP previas, 76 checks beta, **834 checks nuevos unificados**, todos aprobados |
| Concurrencia real | 52 escenarios en total en ambos entornos, incluidos cierres, arranques, compras y AR |
| HTTP real | Suites previas con Auth/FastAPI/PostgREST y dos recorridos nuevos de diez hits reales con +65 y lectura en Colección |
| Navegador determinista | Diez comprobaciones aprobadas, repetidas tras las correcciones |
| Responsive | Cinco tamaños pedidos, sin overflow y control visible sobre navegación |
| Navegador oficial local | 8 hits/+55, 5 hits/+30, 10 hits/+65, cuarta partida/+0 por cupo; recuperación y compra persistentes |

La cuenta sintética del navegador recibió 190 de fondos de prueba y 150 de
premios, compró una carta por 250 y terminó con saldo **90**, una carta y un
ledger conciliado. Hubo cuatro eventos de juego, incluidos el cierre sin premio.
Dos respuestas de cierre se perdieron intencionalmente después del commit: la
pantalla retuvo el estado de reconexión y sólo mostró el premio tras recuperar
el resultado. Recargar tampoco duplicó puntos. Se comprobaron además 401 y
desconexión **simulados en el servidor QA local**, sin invalidar tokens reales.
El teclado, pausa por menú y navegación SPA Juego→Colección→Juego funcionaron.

Los tres stacks desechables propios se cerraron; se preservó el Supabase local
preexistente. Sólo queda disponible el preview invitado de 4190/4191.

Evidencia principal dentro de `docs/evidencias/juego-unificado/`:

- `portada-390x844.jpg`, `partida-390x844.jpg`, `hud-mitad-390x844.jpg`.
- `victoria-base-oficial-390x844.jpg`, `bonus-oficial-390x844.jpg`,
  `recuperacion-premio-65.jpg`, `derrota-390x844.jpg`, `cupo-agotado.jpg`.
- `partida-360x740.jpg`, `tableta-768x1024.jpg`, `horizontal-844x390.jpg`,
  `escritorio-1440x900.jpg`, `resultado-360x740.jpg`, `resultado-horizontal.jpg`.
- `reconexion-corregida.jpg`, `sesion-vencida.jpg` y snapshots DOM de estados.
- `database.txt`, `frontend-tests.txt`, `backend-tests.txt`, `build.txt`,
  `navegador-suite.txt`, `responsive.json`, `partidas-oficiales-db.json`,
  `browser-db-final.json`, `assets-sha256.json` y `referencia.png`.

Consola preservada sin filtros en `consola-oficial.json` y
`consola-completa.json`: aparecen dos errores con la firma histórica
`MutationObserver.observe: parameter 1 is not of type Node`. No se obtiene una
pila que pruebe su origen; no se declara reparado ni se atribuye con certeza a
la herramienta. El juego no crea MutationObservers y sus recorridos terminaron,
pero el diagnóstico externo de esa firma sigue pendiente, como en Fase 4.

## Archivos y Git

- Backend: reglas, DTO, pruebas unitarias y `checks/phase05_database.py`.
- DB: únicamente `20261101000100_unified_batting_game.sql` nueva.
- UI: HTML/CSS del juego, game-page/view/state/media/official, versiones de
  entrada en main/navegación, generador de reglas y PNG real.
- QA: pruebas unificadas/históricas, revisión determinista y servidor oficial.
- Entrega: este documento y `docs/evidencias/juego-unificado/`.

Commit de implementación: `c669133` (`feat(game): rebuild unified ten-pitch
batting experience with authoritative rewards`). El commit de documentación
y evidencia se consulta en el historial de la misma rama.

Rama `feat/unified-batting-game`, basada en Fase 4 pendiente. No hay merge,
push ni despliegue en esta fase mientras falte la migración remota. Para integrar,
revisar/aprobar el cambio económico y aplicar **esa migración** mediante el
procedimiento de producción autorizado; después publicar backend y frontend
compatibles y repetir el smoke de Render/Netlify. No se ejecuta `supabase db push`
contra producción. Commits definitivos se registran en el cierre de evidencias.

## Pendientes

Migración/release remoto, arte definitivo de lanzador/pelota, contraste en
dispositivos físicos y comprobación autenticada en producción tras un despliegue
autorizado, y diagnóstico externo del MutationObserver histórico. Ninguna
recompensa local de este informe se atribuye a producción.

**Reporte final: PARCIAL para la entrega publicada; implementación y validación
locales completas.** Render y Netlify no se modificaron ni se declara un
despliegue nuevo verificado. Main remoto seguía en `1bc8d73` tras el fetch final.

## Ajuste posterior — tamaño de tarjeta y toque completo

Se aplicaron las nuevas referencias del usuario: tarjeta a casi todo el ancho
útil, marco exterior hasta los bordes y fondo prolongado hasta la navegación
inferior. La anchura deja de depender de la altura del dispositivo: en la vista
compacta de 365×570 ahora mide 341 px, frente a unos 219 px del diseño anterior.
En escritorio se limita al ancho de la carcasa; en horizontal conserva el campo
completo al centro de la tarjeta amplia. El arte sigue en un plano 9:16, sin
deformación; en vistas cortas se recorta cielo para conservar el plato.

El aviso inferior es un párrafo, sin forma de botón. Una superficie de botón
transparente y accesible cubre toda la tarjeta durante la partida, incluso HUD
y aviso. Pausa, reanudar, mensajes de red y resultados quedan por encima y
conservan sus acciones. Se reutilizan las guardas de un swing por tiro y los
eventos al presionar; no cambia backend, economía ni migración.

Comprobaciones reales de toque en marcador, centro y aviso: un tiro resuelto
por cada activación; segundo toque durante feedback sin duplicados. Pausa
conservó 0/10 sin registrar bateo. Espacio también resolvió un único tiro.
Medidas verificadas en 360×740, 365×570, 390×844, 768×1024, 844×390 y 1440×900,
sin overflow horizontal, con superficie que cubre toda la tarjeta. El recorrido
determinista de diez comprobaciones volvió a pasar tras el ajuste.

Capturas, métricas y resultados actualizados en
`docs/evidencias/juego-unificado/ajuste-tarjeta/`.

## Ajuste posterior — cierre y tipografía

El resultado incorpora la X SVG proporcionada, con área táctil de 44×44 px.
Clic o Escape cierran el resultado, vuelven a la portada y restauran el foco
en «Juego»; Iniciar abre una partida nueva con contadores a cero. Cerrar no
modifica el premio ni el saldo confirmado.

Los títulos de portada, resultado, victoria/derrota y pausa usan el archivo
local `Monument.otf` como Monument Extended. Botones, marcador, cifras y textos
informativos mantienen Urbanist. Se comprobó la composición en la vista normal,
365×570 y 844×390, sin recortes ni superposición con la navegación. Las 147
pruebas frontend siguen pasando. Evidencia: `portada-monument.jpg`,
`resultado-monument-cerrar.jpg` y variantes por tamaño en la carpeta de evidencias.

## Ajuste posterior — curva naranja original

Se reemplazó la franja poligonal por el SVG proporcionado, conservando el path,
viewBox 402×275 y color `#DF6A16` en `assets/img/juego/curva-naranja.svg`.
Se ubica en la parte inferior, a partir del 68 % de la altura de pantalla,
entre el marco y el campo para que resulte visible en los laterales como en la
referencia. Es decorativa y no intercepta toques. Revisión visual en la vista
normal, 365×570 y 844×390, sin desbordamiento; captura `curva-naranja.jpg`.
