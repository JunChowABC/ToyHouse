"""Feather the existing Imagegen banner without redrawing its artwork."""
from pathlib import Path
from PIL import Image
import json, hashlib

root = Path(__file__).resolve().parents[1]
source = root / 'assets/tool-dialog-v1/ui_deadlock_banner_v2.png'
im = Image.open(source).convert('RGBA')
w, h = im.size
alpha = im.getchannel('A')
peak = max(1, alpha.getextrema()[1])
# A subtle blush tint keeps the panel visible over the cream playmat.
tint = Image.new('RGBA', im.size, (233, 183, 208, 255))
im = Image.blend(im, tint, .35)
def smooth(t):
    t = max(0, min(1, t))
    return t * t * (3 - 2 * t)
for y in range(h):
    for x in range(w):
        side = smooth(min(x, w - 1 - x) / (w * .16))
        edge = smooth(min(y, h - 1 - y) / 8)
        alpha.putpixel((x, y), round(alpha.getpixel((x, y)) / peak * 209 * side * edge))
im.putalpha(alpha)
asset = root / 'assets/tool-dialog-v1/ui_deadlock_banner_v4.png'
im.save(asset)
im.save(root / 'assets/runtime-ui/ui_deadlock_banner_v4.webp', lossless=True, exact=True)
(root / 'art/deadlock-banner-fade-provenance.json').write_text(json.dumps({
    'source': str(source.relative_to(root)),
    'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'asset': str(asset.relative_to(root)),
    'processing': 'Existing Imagegen artwork: center opacity 82%, 16% width fade at each end, 8px vertical feather, subtle blush tint for contrast on cream background.',
}, indent=2), encoding='utf-8')
print('Saved v4 with fully transparent outer edges and preserved center')
