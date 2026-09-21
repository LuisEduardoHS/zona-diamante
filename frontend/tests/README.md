# Validación local

- `npm test`: captura, calidad de cámara y caché compartida de equipos.
- `npm run build`: genera y minifica el CSS común.
- `npm run preview:navegacion`: abrir `http://127.0.0.1:4173/__navigation-tests` y pulsar **Ejecutar pruebas de navegación**. Comprueba identidad del documento/header/nav, rutas anidadas, historial, clics rápidos, estilos, caché, entrada/salida de AR y vista previa de foto. Usa un fondo de cámara simulado: no solicita permisos ni prueba el seguimiento real de logos.
- `npm run preview:foto`: sirve las páginas con cámara real; `/__foto-review` conserva la vista de captura simulada.
- `python tests/optimizar-imagenes.py` (Pillow): regenera los WebP desde los PNG originales, que se conservan.

La navegación mantiene el documento y cambia el contenido y la hoja de estilos de cada sección. Los HTML y los datos de equipos se reutilizan durante esa visita; recargar permite obtener los cambios del servidor. La cámara vive en `ar-vista.html`, dentro de un iframe del mismo origen: retirar ese iframe al navegar libera su contexto WebGL, cámara y workers sin alterar la navegación compartida. Las librerías AR se solicitan solamente al entrar a Cámara AR.

En producción, servir `public` por HTTPS y permitir cámara y Web Share para el propio origen. El servidor de pruebas usa `no-store` deliberadamente; el alojamiento de producción puede añadir compresión HTTP y caché con revalidación para los recursos estáticos (no usar caché inmutable con estos nombres sin versión).

## Comprobación de foto AR en un celular

La vista `/__foto-review` usa el modelo de Algodoneros y un video generado localmente, con WebGL real. Permite revisar formatos móvil, horizontal y escritorio sin pedir cámara. El servidor sólo escucha en localhost y las páginas de prueba no forman parte del sitio público.

Desde el sitio con HTTPS:

- Escanear un logo, abrir Ver 3D, mover/girar/escalar el modelo y tomar una foto.
- Comprobar que la vista previa conserva el encuadre, sin menús ni botones.
- Guardar y abrir el JPG desde las descargas del navegador.
- Compartir el archivo con una app elegida, cancelar el menú y volver a abrirlo.
- Pulsar la X, cancelar el aviso y comprobar que la foto permanece; después confirmar el descarte y capturar de nuevo. Repetir en orientación horizontal.
- Abrir el menú de compartir y regresar a la página, comprobando que la foto sigue disponible y la cámara se recupera después de cerrar la vista previa.
- Salir de AR a Inicio y confirmar que se apaga el indicador de cámara del teléfono. Volver a entrar y comprobar el escaneo.

Guardar usa una descarga del navegador, no escribe directamente en la galería. Compartir requiere que el navegador permita enviar archivos con Web Share. Cuando no lo permite, la vista previa ofrece la descarga como alternativa.
