# Pruebas de foto AR

Desde `frontend`, ejecutar `npm test` para comprobar recorte, composición,
exportación, descarga, descarte y compatibilidad de compartir con APIs simuladas.

Para revisar el diseño y la captura con WebGL real, ejecutar `npm run preview:foto`
y abrir `http://127.0.0.1:4173/__foto-review`. Esta página de prueba usa el modelo
de Algodoneros y un video generado localmente; no solicita acceso a la cámara.
Permite revisar los formatos móvil, horizontal y escritorio. El servidor sólo
escucha en localhost y las páginas de prueba no forman parte del sitio público.

En un celular, completar la comprobación desde el sitio con HTTPS:

- Escanear un logo, abrir Ver 3D, mover/girar/escalar el modelo y tomar una foto.
- Comprobar que la vista previa conserva el encuadre, sin menús ni botones.
- Guardar y abrir el JPG desde las descargas del navegador.
- Compartir el archivo con una app elegida, cancelar el menú y volver a abrirlo.
- Pulsar la X, cancelar el aviso y comprobar que la foto permanece; después
  confirmar el descarte y capturar de nuevo. Repetir en orientación horizontal.
- Abrir el menú de compartir y regresar a la página, comprobando que la foto
  sigue disponible y la cámara se recupera después de cerrar la vista previa.

Guardar usa una descarga del navegador, no escribe directamente en la galería.
Compartir requiere que el navegador permita enviar archivos con Web Share.
Cuando no lo permite, la vista previa ofrece la descarga como alternativa.
