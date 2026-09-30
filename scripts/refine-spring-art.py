"""Rebalance the generated spring's head, coil, and base for a one-cell sprite."""
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1]
source = root / 'output/imagegen/mechanics-v2/spring-toy-1x1-style-v2.png'
target = root / 'output/imagegen/mechanics-v2/spring-toy-1x1-style-v2-remaster.png'
image = Image.open(source).convert('RGBA')
canvas = Image.new('RGBA', (1024, 1024))


def place(source_rows, box):
    top, bottom = source_rows
    section = image.crop((0, top, image.width, bottom))
    bounds = section.getchannel('A').point(lambda alpha: 255 if alpha > 20 else 0).getbbox()
    section = section.crop(bounds)
    x, y, width, height = box
    section = section.resize((width, height), Image.Resampling.LANCZOS)
    canvas.alpha_composite(section, (x, y))


place((0, 630), (172, 20, 680, 330))
place((630, 930), (137, 325, 750, 455))
place((930, image.height), (102, 745, 820, 245))
canvas.save(target)
print(target.relative_to(root))
