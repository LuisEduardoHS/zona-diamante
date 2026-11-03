# Info, encabezado del juego y Tailwind compartido

Info adopta los colores turquesa/naranja, títulos Monument Extended, texto
Urbanist y tarjetas redondeadas del sitio. La portada ilustrada anterior se
retiró de la sección. Se reutilizan dos fotografías reales del catálogo local
de Sultanes y Charros, con crédito a la LMB; sus fuentes originales están en
`frontend/public/assets/img/equipos/galerias/fuentes.json`.

La cronología conserva el contenido y tiene filtros con `aria-pressed`, estado
anunciado y activación por teclado. Las entradas respetan movimiento reducido
y el observador se desconecta al salir de la sección.

El juego utiliza el encabezado compartido: perfil/avatar al tener sesión y
acceso al login como invitado. Se eliminó el diamante y la regla que ocultaba
la cuenta. El espacio transparente del encabezado deja pasar los toques; los
botones siguen siendo interactivos, incluso con el juego horizontal.

## Organización de Tailwind

- Las 15 páginas HTML con contenido cargan únicamente `css/output.css`.
- `src/css/input.css` define las fuentes y los tokens de marca e importa los
  componentes Tailwind de `src/css/components/`.
- Los componentes usan `@apply` para los estados y selectores compartidos;
  las vistas nuevas usan utilidades directamente en el HTML. Los keyframes,
  variables de equipo y valores calculados durante el juego/AR se conservan.
- Se retiraron las seis hojas públicas independientes de Inicio, equipos,
  colección, trivia, juego y foto AR, además del bloque de estilos del HTML AR.
- Formularios, perfil, ayuda, navegación y cámara se compilan en la misma
  entrada. Los estilos de Inicio se limitan a esa ruta para evitar cruces.
- El carrusel, confeti y video de cámara usan clases Tailwind para sus estilos
  estáticos. Colores de equipos y geometría aleatoria usan variables dinámicas.
- La navegación SPA ya no solicita ni activa hojas de estilo por sección.

`npm run build` ejecuta `check:styles`: falla si una página introduce otra
hoja, estilos HTML independientes o un recurso CSS local que no existe.
Para una sección nueva, usar las utilidades o un componente Tailwind importado
por la entrada común; no crear una hoja pública por ruta.

## Validación

- Build completo, 167 pruebas frontend y 164 backend correctas.
- Auditoría de 15 páginas y cuatro recursos locales del CSS compilado.
- 53 comprobaciones del recorrido real de la aplicación en cada tamaño:
  320×568, 390×844, 844×390 y 1440×900. Incluye carrusel, navegación SPA,
  filtros de Info, cuenta/perfil, formularios, catálogo y detalle, ayuda,
  partida/pausa, trivia y vista previa AR. Sin errores JavaScript del sitio.
- El recorrido usa una cuenta/API sintéticas locales y la vista AR sin cámara;
  no escribe en producción ni prueba seguimiento físico de marcadores.
- Las 14 comprobaciones de mecánica y 12 de movimiento del juego siguen pasando.
- Comparación de estilos computados de seis secciones: coinciden los valores
  estáticos medidos antes/después. La diferencia registrada es un fotograma
  de entrada animada en una tarjeta de equipo.
- Revisión visual de Info en móvil/escritorio, filtro por teclado, perfil del
  juego y foto AR. El menú abre y cierra correctamente al navegar.

Evidencia: `docs/evidencias/diseno-tailwind/`.
Repetir el recorrido con `npm run preview:site` y abrir
`http://127.0.0.1:4195/__review`. Las herramientas de revisión quedan fuera
de `public` y no se publican con la aplicación.

La entrega incluye también el cambio de trivia a doce horas y las transiciones
del juego que ya estaban preparados. Su migración de trivia ya se verificó en
Supabase remoto; esta migración visual no requiere cambios nuevos en la base.
