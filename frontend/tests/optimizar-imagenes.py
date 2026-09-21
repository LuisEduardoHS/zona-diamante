"""Genera versiones WebP sin alterar los originales. Requiere Pillow."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'public'
total_antes = total_despues = 0
for source in (root / 'assets/img').rglob('*.png'):
    image = Image.open(source)
    # collect es un icono de 35px; el resto conserva resolución para pantallas retina.
    limite = 128 if source.name == 'collect.png' else 1600
    image.thumbnail((limite, limite), Image.Resampling.LANCZOS)
    target = source.with_suffix('.webp')
    image.save(target, 'WEBP', quality=86, method=6)
    total_antes += source.stat().st_size
    total_despues += target.stat().st_size
print(f'PNG originales: {total_antes:,} bytes; WebP: {total_despues:,} bytes; reducción: {100 * (1-total_despues/total_antes):.1f}%')
