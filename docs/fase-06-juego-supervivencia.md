# Juego: meta de 10 y tres fallos

Esta fase sustituye la partida nueva de diez lanzamientos descrita en la fase 05.
Las partidas históricas conservan sus reglas para poder recuperarse y terminar.

## Comportamiento

- Meta de 10 hits. No hay límite de tiros ni final automático al alcanzar la meta.
- Tres fallos acumulados terminan la partida. Un tiro sin batear también cuenta.
- Con menos de 10 hits el resultado es derrota; con 10 o más, meta lograda.
- Desde el hit 11 aparece «Extras ×11», «Extras ×12», etc. Cuenta los hits
  totales y conserva el valor tras un fallo. La racha consecutiva sigue siendo
  una estadística distinta y se reinicia al fallar.
- Cada tiro, acertado o fallado, aumenta la velocidad del siguiente.
  El factor temporal es `0.4 + 0.6 / (1 + 0.055 * (índice - 1))`.
  Vuelo, contacto y ventanas se reducen juntos; nunca llegan a cero.
- Toda la tarjeta continúa aceptando toque, Espacio o Enter. Pausa y cierre
  conservan los SVG proporcionados; títulos en Monument Extended, resto Urbanist.

Al terminar como invitado se muestra «Inicia sesión o crea una cuenta para jugar
por puntos. Esta práctica no acreditó puntos», con ambas acciones y retorno al
juego. Los puntos y el saldo no se inventan ni se acreditan retroactivamente.
En pantallas pequeñas se omiten las cifras vacías del invitado para que todas
las acciones permanezcan visibles.

## Servidor y puntos

Protocolo `survival-1`, modo `survival`, migración nueva
`20261101000200_survival_batting_game.sql`. No se reescriben migraciones previas.
El servidor determina tiros, tiempos, fallos, resultado y premio; el navegador
no puede enviar hits ni puntos libres.

Se conserva el máximo de 65 puntos por partida y tres premios positivos por día:
30 de base al alcanzar la meta, 5 por hit extra hasta cinco extras y el bonus
consecutivo existente (5 desde tres, 10 desde cinco). Ejemplos con racha máxima
igual al total: 9 hits → 0, 10 → 40, 11 → 45, 12 → 50, 15 o más → 65.
El máximo diario continúa en 195 puntos, compartido con partidas anteriores.

Para permitir partidas largas, el historial guarda los últimos 32 tiros y la
ventana de reintentos las últimas 128 operaciones; los totales son acumulativos.
Las revisiones y UUID de tiro rechazan reintentos antiguos expulsados de esa
ventana. La finalización conserva la idempotencia por recurso y el ledger único.
Un tiro o bateo válido renueva el tiempo de inactividad de ocho minutos, sin
poner un límite total a la partida activa. Las guardas de latencia, autorización,
pausa, secuencia y transacciones siguen vigentes.

## Validación local

- Build completo y 160 pruebas frontend; 156 pruebas backend.
- Motor: meta 10, extras 11/12/25/200, fallos intercalados, tres tiros pasivos,
  pausa y velocidad estrictamente creciente durante 10 000 tiros.
- Recorrido en navegador: 14 comprobaciones con el motor real y reloj de QA.
  No termina al llegar a 10; doble toque no duplica; el tercer fallo termina;
  aviso de acceso, enlaces de login/registro y cierre funcionan.
- Vista revisada en 390×844, 320×568 y 844×390.
- Navegador con Auth/API/PostgreSQL reales locales: 12 hits y tres fallos,
  premio de 50 puntos, un solo evento en ledger y saldo persistente de 240
  (190 de financiación sintética + 50 del juego). Colección confirma ese saldo.
- `backend/checks/phase06_database.py` valida PostgreSQL/Auth/API en proyectos
  locales desechables y repite las regresiones históricas. Incluye 72
  comprobaciones SQL de supervivencia por instalación, una partida de 200 hits,
  límites de memoria, concurrencia, cupo diario y una partida HTTP en tiempo
  real de 11 hits y 3 fallos con premio único de 45 puntos.

Evidencias y resultados completos en `docs/evidencias/juego-supervivencia/`.
Los servidores de QA de `frontend/checks/` no se incluyen en el sitio público.

## Publicación pendiente

La rama se entrega en GitHub y se integra con `main` por solicitud del usuario.
Antes de publicar el frontend oficial deben aplicarse,
en orden, las migraciones `20261101000100` y `20261101000200` junto con el backend
compatible. No se aplicaron cambios a Supabase remoto ni se ejecutó un deploy manual.
