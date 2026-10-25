# Fase 2B — Investigación final de MutationObserver

Revisión local: 25 de octubre de 2026. Rama `feat/collection-cards`, HEAD `7e21760`. Se conservó el trabajo de Fase 2B que ya estaba modificado/sin seguimiento. No se cambió de rama ni se hizo commit.

## Resultado y alcance de la conclusión

**Investigación reproducida y acotada; atribución interna del navegador pendiente.** El mismo TypeError se reproduce en el navegador integrado con un iframe cuyo HTML llega en dos partes, sin ningún script en el padre ni en el hijo. Las respuestas HTTP guardadas confirman cero etiquetas `script`; tampoco se inyecta el diagnóstico en esos dos documentos.

Esto demuestra que Zona Diamante, A-Frame y MindAR no son necesarios para producir **esa reproducción**. Apunta al entorno de inspección/instrumentación del navegador integrado durante la carga del iframe. No se obtuvo la pila del contexto externo que llama a `observe`, por lo que no se identifica un módulo concreto de ese entorno ni se afirma que todos los eventos históricos tengan necesariamente el mismo origen.

No se aplicó un arreglo especulativo al producto ni a las dependencias. La consola del navegador integrado **sigue mostrando el error** en algunos recorridos, incluso en el caso mínimo. No se filtró, silenció ni consumió ninguna excepción para hacerla parecer limpia.

**Recomendación:** continuar la integración local de Fase 2B y su revisión de código. Mantener pendiente la aprobación de producción hasta contrastar la consola en Chrome/Safari externo y ejecutar las validaciones físicas que ya estaban pendientes. La habilitación pública de recompensas sigue bloqueada por su verificador, independientemente de este incidente.

## Registro original e inventario

Se revisó y conservó `evidencias/fase02b/consola-observacion.json`. Contiene siete entradas: seis apariciones del TypeError y un error antiguo de carga 3D. No contiene una pila atribuible para el TypeError. SHA256 del archivo preservado: `aa0e6516a582a4db5576130aed6dbd278d67350edfdba5d8ce9da7c4673a5922`.

Inventario de llamadas, comprobado en fuentes locales y guardado con línea, columna y contexto en `revision-observer/observe-sites.json`:

| Archivo / posición | Llamada y contexto |
| --- | --- |
| `frontend/public/js/features/ar/ar-marco.js:8` | `observador.observe(dialogo, ...)`, por cada elemento devuelto por `querySelectorAll('dialog')`. Módulo del documento AR. |
| `frontend/public/js/features/ar/foto-ar.js:84` | Observa `foto-preview` y `foto-confirmar-descarte` si se proporciona `alCambiarVista`. La aplicación lo inicializa desde `DOMContentLoaded` en `camara.js`. |
| `frontend/public/vendor/aframe.min.js:25:938` | `O.observe(e,de)` en el polyfill de custom elements v0. |
| `frontend/public/vendor/aframe.min.js:25:5134` | `O.observe(r,{childList:true,subtree:true})` en ese polyfill. |
| `frontend/public/vendor/aframe.min.js:45106:2957` | Raycaster: `this.observer.observe(this.el.sceneEl,OBSERVER_CONFIG)`. |

No se encontraron llamadas adicionales a MutationObserver en los módulos propios ni en MindAR. Los `observe` de revelado editorial corresponden a IntersectionObserver, no a este error. A-Frame informa versión 1.3.0 en consola; no se actualizó ni se editó el bundle. La mera presencia de una llamada en una dependencia no demuestra que sea responsable.

## Método de atribución

Se añadió instrumentación **opcional y exclusivamente local**, antes de los scripts del producto/dependencias. Se envuelve `MutationObserver.prototype.observe`, no sólo su constructor. Se registra URL, estado del documento, condición de iframe, hora UTC, tipo/id/nodeType/conexión del destino y pila de llamada. Se llama a la implementación nativa con el mismo receptor y argumentos; si lanza una excepción, se registra y se vuelve a lanzar el mismo objeto.

También se registran `error` y `unhandledrejection` sin `preventDefault`. Los errores de transporte se muestran como advertencias. Cuatro pruebas unitarias verifican el retorno nativo, la identidad de la excepción y que los eventos no se consuman. Esto observa el contexto JavaScript de la página; **no garantiza interceptar mundos aislados/instrumentación externa**.

Se usó un servidor propio en `127.0.0.1:4176`, con `--observer-trace`, y como control la revisión original del puerto 4174, sin ese flag. Las fixtures de AR simulan cámara/detección y respuestas de cuenta; Canvas, JPEG y GLB son reales. Se probó además la página AR real con MindAR, salida y reentrada por la navegación SPA. No se utilizaron cuentas ni escrituras económicas reales.

Los dos archivos JSONL conservan **225 llamadas nativas aceptadas**, 212 a nodos de tipo 1 y 13 a documentos de tipo 9; 18 instalaciones de diagnóstico. **Cero `observe-error`, `window-error` o `unhandled-rejection`** en esas trazas. Los destinos propios observados son diálogos conectados y las llamadas se ejecutan con DOM interactivo. Estas cifras describen los recorridos registrados; no prueban que cualquier ejecución futura sea válida.

La consola externa al diagnóstico sí registró el TypeError. Por ejemplo, el shell real lo muestra a las `19:20:27.904Z`, antes de los mensajes de A-Frame a las `19:20:28.074Z`; la traza de la página no registra ese fallo. Esta diferencia apoya la hipótesis de otro contexto, pero por sí sola no bastaría: el control sin JavaScript aporta el aislamiento decisivo.

## Reproducciones y controles ejecutados

| Caso en navegador integrado | Resultado observado |
| --- | --- |
| Revisión original `/__review`, sin diagnóstico | 35 comprobaciones aprobadas; un TypeError en consola. |
| Primera revisión instrumentada | 35 aprobadas; sin errores de consola en esa primera observación; 20 observaciones nativas válidas. |
| Revisión instrumentada tras recarga, ciclos y editor | 14 comprobaciones de ciclos y 35 del editor aprobadas; consola acumulada conserva un TypeError. |
| HTML vacío directo, cero scripts | Sin errores en una carga. |
| HTML vacío dentro de iframe, cero scripts | Sin errores en una carga. |
| Iframe vacío con cuerpo HTML retrasado un segundo, cero scripts | Mismo TypeError en la carga inicial y en una de dos recargas adicionales: dos eventos conservados en total. |
| A-Frame solo, directo | Mensajes de versión normales; sin errores en una carga. |
| A-Frame solo, iframe | Mismo TypeError; las llamadas interceptadas de la dependencia son válidas. |
| Shell real `/pages/experiencias/camara.html` | TypeError, inicialización de MindAR y timeout de cámara; no se acreditó acceso físico. |
| Shell real → Inicio → AR → Inicio mediante SPA | Salida y reentrada visibles; se conserva la consola acumulada con el evento de la primera carga. No se demuestra que SPA sea causa necesaria: el caso mínimo no usa SPA. |

La evidencia DOM del caso mínimo no pudo leer el documento hijo a través de la vista DOM limitada de la herramienta (`contentDocument` no expuesto); no se usa ese valor como prueba de que falte realmente el cuerpo. Los archivos HTTP completos `minimo-parent.html`, `minimo-child.html` y su comprobación de cero scripts son la prueba independiente del contenido servido. El servidor escribe el `head` inmediatamente y el `body` un segundo después. El caso mínimo puede verse en `minimo-sin-js.png`.

## Cambios de esta revisión

Se modificaron exclusivamente herramientas de comprobación y documentación; se regeneraron las salidas ignoradas del build habitual.

- `frontend/checks/phase02b-preview.cjs`: puerto configurable; diagnóstico activado sólo con `--observer-trace`; recepción local de trazas; cinco casos de aislamiento, incluido HTML retrasado sin JavaScript. El servidor sigue ligado a loopback. No es un servidor para producción.
- `frontend/checks/phase02b-browser.js`: control local adicional para cinco recargas de iframe, tres cancelaciones tempranas (0/20/80 ms) y reentrada. Son 14 comprobaciones, incluidos diálogos conectados, pistas anteriores terminadas y ausencia de modal residual. Una cancelación antes de crear video puede tener cero pistas; no equivale a validar getUserMedia físico tardío.
- Nuevos `frontend/checks/observer-diagnostic.js` y `observer-diagnostic.test.mjs`: registro opcional y cuatro pruebas de transparencia.
- Documento principal actualizado, este informe y archivos de evidencia bajo `docs/evidencias/fase02b/revision-observer/`.

Los hashes de `ar-marco.js`, `foto-ar.js` y `ar-vista.html` coinciden con el inicio de esta revisión. No hubo cambios adicionales en código de producto, backend, SQL, colección, HTML/CSS visual, diseño aprobado ni librerías vendorizadas. El trabajo previo de Fase 2B conserva sus modificaciones. No se instalaron ni actualizaron dependencias.

## Pruebas repetidas en esta revisión

| Comando / recorrido | Resultado |
| --- | --- |
| Desde `frontend`: `npm test` | **68 aprobadas**, cero fallidas/skips: 64 existentes más cuatro del diagnóstico. |
| Desde `backend`: `.\venv\Scripts\python.exe -m pytest -q -p no:cacheprovider` | **111 aprobadas**, una advertencia ya existente de deprecación Starlette/TestClient/HTTPX. |
| Desde `frontend`: `npm run build` | Aprobado: CSS, bundle Supabase y configuración pública. |
| `git diff --check` | Sin errores. |
| Recorrido editor/exportación de revisión | Conjunto de **35 comprobaciones** repetido tres veces en esta revisión, a 390×844: control original, instrumentado inicial y después de ciclos. No son 105 casos distintos. |
| Recorrido nuevo de ciclos | **14 comprobaciones aprobadas**. |
| Comprobar salida y recursos | Aprobado: una pista de video de fixture terminó al navegar fuera. |
| Shell real y casos de aislamiento | Resultados y errores en tabla anterior; cámara real bloqueada por timeout. |

Las 35 comprobaciones cubren panel/ficha del carrusel, inspector, captura, filtros, ajustes, confirmación/cancelación/restauración, píxeles y dimensiones del JPEG, guardar, share controlado, descarte y captura posterior. No se afirma haber probado en esta revisión gestos físicos de zoom/rotación, cámara real concedida o la hoja de compartir del sistema.

No se repitió el runner SQL/concurrencia: no se cambió backend, esquema ni contratos económicos en esta revisión. Los 406 checks SQL/38 carreras del informe principal son resultados de la implementación anterior, no una nueva ejecución aquí. No se repitió toda la matriz visual de cinco resoluciones al no cambiar el diseño; conserva la evidencia anterior.

## Evidencia conservada

Directorio: `docs/evidencias/fase02b/revision-observer/`.

- `review-original-{pruebas.txt,consola.json}`, `review-trazado-{pruebas.txt,consola.json}` y `review-despues-ciclos-pruebas.txt`.
- `ciclos-{pruebas.txt,consola.json}`, `salida-pruebas.txt`, `review-final-consola.json`, `review-final.png`.
- `minimo-sin-js-consola.json`, `minimo-sin-js-consola-repetida.json`, `minimo-sin-js-dom.json`, `minimo-sin-js.png`, `minimo-parent.html`, `minimo-child.html`, `minimo-http-verificacion.json`.
- Controles `empty-{direct,frame}-consola.json` y `aframe-{direct,frame}-consola.json`.
- `shell-real-timeout.txt`, `shell-real-consola.json`, `shell-real-consola-final.json`, `shell-real-spa-{reentrada,salida}.txt`.
- `observe-sites.json`, `trace-primera.jsonl`, `trace-ciclos-aislamiento-shell.jsonl` y `resumen-tecnico.json`.

Los JSON de consola se obtuvieron sin filtro de niveles ni mensajes (límite 1000, no alcanzado). No se borró la consola entre cargas; los archivos finales son acumulados. Las horas de logs y trazas son UTC. La primera consola instrumentada sin errores no debe confundirse con la consola final, que sí contiene uno.

## Pasos exactos pendientes en navegador externo

1. Desde la raíz ejecutar `node frontend/checks/phase02b-preview.cjs --port 4176` **sin** diagnóstico. Si ese puerto está ocupado, elegir otro libre con `--port`; no detener servicios ajenos. El servidor propio de esta investigación ya está detenido.
2. Abrir Chrome externo en `http://127.0.0.1:4176/__observer-lab`. Abrir DevTools antes de pulsar `delayed-frame`; habilitar Preserve log, todos los niveles y Pause on exceptions, incluyendo excepciones capturadas. No ocultar el TypeError ni deshabilitar JavaScript para la comparación AR.
3. Cargar `empty-direct`, `empty-frame` y `delayed-frame` en pestañas separadas. Repetir cada carga al menos cinco veces. Anotar navegador/versión, extensiones activas, si DevTools estaba conectado, número de cargas/eventos y hora. Conservar los logs completos.
4. Comparar `aframe-direct` y `aframe-frame`; después `/__review` y `/pages/experiencias/camara.html`. En revisión ejecutar editor/exportación, ciclos y limpieza; en shell salir a Inicio y reentrar por Cámara AR. Si se necesita una comparación sin extensiones, usar un perfil de prueba autorizado y documentarlo.
5. Si el depurador pausa, copiar pila completa, archivo/URL, línea, contexto/frame seleccionado, argumento de `observe`, constructor/nodeType, `document.readyState`, `document.body` y presencia del iframe. Usar el selector de contexto para distinguir página, hijo y scripts de extensión. No pegar tokens, cookies o credenciales en el reporte.
6. Repetir en otro puerto con `node frontend/checks/phase02b-preview.cjs --port 4177 --observer-trace`. La traza local se guarda bajo `.tmp/observer-investigation/`. Comparar el fallo de DevTools con `observe-error` y `window-error`; no asumir que el wrapper alcanza contextos aislados. Adjuntar ambos resultados, incluidos errores de transporte si existen.
7. Para aislar el entorno integrado, compartir con el equipo que mantiene ese navegador el caso HTML mínimo y el servidor que demora el cuerpo, junto con los dos timestamps y la falta de pila. Si sólo falla allí, registrarlo como incidencia de ese entorno; no parchear A-Frame por suposición.
8. En dispositivo objetivo verificar cámara/permisos, seguimiento, inspector/gestos, captura, editor, archivo descargado, hoja real de share y apagado del indicador de cámara al salir. Esta investigación no sustituye esa aceptación.

No se completó la comparación externa en esta revisión. Un intento previo de automatización de Chrome nativo se detuvo por el control de seguridad al no poder confirmar la URL activa; no acredita una prueba en Chrome. Los pasos anteriores quedan listos para ejecución manual con DevTools.

## Aceptación y límites finales

- [x] Error reproducido en revisión y shell real; registros preservados.
- [x] Reproducción independiente sin código AR ni dependencias.
- [x] Inventario de llamadas y trazas de argumentos/pilas de página.
- [x] Recargas, cancelación, reentrada, editor/exportación y limpieza de fixture comprobados.
- [x] Frontend/backend/build aprobados; sin cambios especulativos de producto.
- [x] Servidor propio 4176 detenido y nueve pestañas propias cerradas; servicios previos 4174/5500 y pestaña previa del usuario conservados.
- [ ] Pila del contexto externo responsable y comparación Chrome/Safari externo.
- [ ] Cámara y share físicos; verificador y concesión pública de recompensas.
- [x] Sin commit/push/merge/despliegue, SQL remoto, migraciones históricas modificadas ni pruebas destructivas con datos reales.

No hay una regresión funcional nueva confirmada por las suites ejecutadas. La consola integrada no está limpia y la atribución del registro histórico sigue limitada por la ausencia de pila. La investigación aporta un caso reproducible para continuar esa atribución sin alterar el diseño aprobado.
