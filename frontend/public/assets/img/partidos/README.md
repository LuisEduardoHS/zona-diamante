# Logos de partidos

Versiones a color descargadas del CDN MLBstatic para identificar a los equipos
de LMB y LMP. Los archivos `logo-bg` existentes se conservan para los fondos
del carrusel; son versiones blancas y no se leen sobre las tarjetas de partidos.

El manifiesto `frontend/public/data/match-logos.json` registra el equipo, su ID
de MLB Stats API, la URL de origen y la ruta local de cada SVG. No se solicitan
imágenes remotas mientras el visitante consulta los partidos. Si aparece un
equipo nuevo o histórico sin logo guardado, se muestran sus iniciales.

Para volver a descargar los logos de los equipos de la temporada 2026:

```powershell
python frontend/scripts/download-match-logos.py
```

Las marcas pertenecen a sus respectivos equipos y ligas.
