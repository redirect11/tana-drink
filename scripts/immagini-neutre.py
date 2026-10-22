# -*- coding: utf-8 -*-
# =====================================================================
#  LE IMMAGINI NEUTRE DI UN CLIENTE (REQ-VENUE-001): logo, icone, foto.
#
#    python scripts/immagini-neutre.py clienti/demo/public
#    python scripts/immagini-neutre.py clienti/bar-mario/public --colore "#2a6f97"
#
#  I file di public/ (logo.png, icone, apple-touch-icon.png, favicon.svg,
#  cocktail-hero.jpg) sono della Tana. Un cliente che non ha ancora i suoi
#  parte da questi: un bicchiere da cocktail bianco su fondo scuro, e una
#  foto di copertina a gradiente. Li sostituira' dalla sua cartella quando
#  avra' i suoi. Serve Pillow.
# =====================================================================
import sys
from pathlib import Path
from PIL import Image, ImageDraw

argv = sys.argv[1:]
if not argv:
    print('Uso: python scripts/immagini-neutre.py <cartella> [--colore "#rrggbb"]')
    sys.exit(1)
cartella = Path(argv[0])
colore = argv[argv.index('--colore') + 1] if '--colore' in argv else '#0e0e15'
cartella.mkdir(parents=True, exist_ok=True)


def bicchiere(draw, cx, cy, s, fill='white'):
    # Una coppa da cocktail: triangolo, stelo, base, e un'oliva.
    draw.polygon([(cx - s * 0.42, cy - s * 0.38), (cx + s * 0.42, cy - s * 0.38), (cx, cy + s * 0.06)], fill=fill)
    draw.rectangle([cx - s * 0.03, cy + 0.02 * s, cx + s * 0.03, cy + s * 0.36], fill=fill)
    draw.rectangle([cx - s * 0.22, cy + s * 0.34, cx + s * 0.22, cy + s * 0.40], fill=fill)
    draw.ellipse([cx - s * 0.1, cy - s * 0.3, cx + s * 0.1, cy - s * 0.1], fill=colore)


def tondo(dim, margine=0.0, trasparente=True):
    img = Image.new('RGBA', (dim, dim), (0, 0, 0, 0) if trasparente else colore)
    d = ImageDraw.Draw(img)
    m = dim * margine
    d.ellipse([m, m, dim - m, dim - m], fill=colore, outline='white', width=max(2, dim // 64))
    bicchiere(d, dim / 2, dim / 2, dim * (1 - 2 * margine))
    return img


tondo(512).save(cartella / 'logo.png')
tondo(192).save(cartella / 'icon-192.png')
tondo(512).save(cartella / 'icon-512.png')
# Maskable: il disegno sta nel cerchio sicuro, con margine.
tondo(512, margine=0.1, trasparente=False).convert('RGB').save(cartella / 'icon-maskable-512.png')
# iPhone/iPad la vogliono opaca, 180x180.
tondo(180, trasparente=False).convert('RGB').save(cartella / 'apple-touch-icon.png')

(cartella / 'favicon.svg').write_text(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">'
    f'<circle cx="32" cy="32" r="31" fill="{colore}" stroke="white" stroke-width="2"/>'
    '<path d="M12 18h40L32 40z M30 38h4v16h-4z M18 54h28v4H18z" fill="white"/></svg>\n',
    encoding='utf-8',
)

# La copertina: un gradiente scuro con qualche cerchio chiaro, niente foto.
w, h = 1600, 600
hero = Image.new('RGB', (w, h), colore)
d = ImageDraw.Draw(hero)
base = Image.new('RGB', (1, 1), colore).getpixel((0, 0))
for y in range(h):
    k = y / h
    d.line([(0, y), (w, y)], fill=tuple(int(c * (1 - 0.5 * k) + 40 * k) for c in base))
for i, (x, r) in enumerate([(300, 220), (900, 160), (1350, 260)]):
    d.ellipse([x - r, h // 2 - r, x + r, h // 2 + r], outline=(255, 255, 255), width=3)
bicchiere(d, w // 2, h // 2, 360, fill=(255, 255, 255))
hero.save(cartella / 'cocktail-hero.jpg', quality=85)
print(f'[immagini] ✓ {cartella}: logo, icone, favicon e copertina neutri ({colore})')
