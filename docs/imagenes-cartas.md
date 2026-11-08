# Imágenes del catálogo de cartas

Las 20 cartas del catálogo tienen imágenes propias en el bucket público
`card-images` de Supabase Storage. `cards.image_path` contiene la URL pública
completa, compatible con la colección existente y con los distintos dominios
del frontend. Los archivos no se cargan desde los sitios de los equipos.

Las copias publicadas y su manifiesto están en
`supabase/assets/card-images/`. El manifiesto registra carta, ruta de Storage,
fuente, crédito, tamaño y SHA-256. Los nombres incluyen el hash del contenido
para poder conservar caché sin mostrar una versión anterior al actualizar.

## Selección

- Los 11 retratos contemporáneos proceden de las fichas oficiales MLB/MiLB.
  Los IDs y fechas de nacimiento se contrastaron con el catálogo. Algunos
  retratos muestran el uniforme de otro club de la trayectoria del jugador.
- El retrato histórico de Ángel Bravo procede de su ficha en el Museo de
  Béisbol de Venezuela y Salón de la Fama. Se conserva su marco original.
- Perro Sultán, Pancho Pistolas y Pollo Algodonero reutilizan las fotografías
  existentes en el proyecto. Sus personajes se contrastaron con la guía oficial
  de la LMB 2024 (páginas PDF 78, 60 y 48, respectivamente). La guía identifica
  juntos a Pancho Pistolas y Doroteo Arango Jr.; la imagen elegida es el personaje
  con sombrero y bigote de la izquierda.
- Straiky usa la fotografía de su peluche de la tienda oficial de Charros,
  acreditada como tal en el manifiesto. La foto anterior de la ficha del equipo
  mostraba a Charrogallo y no corresponde a esta carta.
- Las cuatro cartas de equipos utilizan sus logos oficiales de MLBstatic,
  ya disponibles en el calendario del proyecto. Se conserva el vector original
  y se añade margen y fondo claro para que los trazos oscuros sean legibles sobre
  los colores de las cartas. Las primeras versiones se conservan en Storage.

## Publicación y recuperación

1. Aplicar `20261108000200_card_images_bucket.sql`.
2. Subir las imágenes revisadas:

   ```powershell
   backend/venv/Scripts/python.exe backend/checks/publish_card_images.py --upload
   ```

3. El script comprueba cada descarga pública y su hash antes de terminar.
4. Aplicar `20261108000300_assign_card_images.sql` para asociarlas al catálogo.
5. Aplicar `20261108000400_card_logo_contrast.sql` para activar las versiones de
   logos con fondo claro que aparecen en el manifiesto actual.

El script sin `--upload` sólo verifica las imágenes publicadas. Lee las
credenciales de servidor desde `backend/.env` y no las imprime. Los objetos
existentes no se sobrescriben. Para cambiar una imagen, preparar un archivo y
hash nuevos, actualizar el manifiesto, subirlo y añadir una migración que
actualice únicamente la carta correspondiente.

El bucket admite WebP, PNG, JPEG y SVG hasta 2 MiB. Su lectura es pública y no
se conceden permisos de escritura al navegador. Las políticas de avatares
siguen limitadas a su bucket. Estas migraciones sólo agregan el bucket y
actualizan `image_path`; no modifican precios, puntos ni cartas adquiridas.
