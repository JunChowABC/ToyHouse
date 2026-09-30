"""Export Imagegen banner; preserve alpha and rounded end geometry."""
from pathlib import Path
from PIL import Image
import hashlib, json

root = Path(__file__).resolve().parents[1]
source = root / 'output/imagegen/deadlock-banner-flat-v2.png'
im = Image.open(source).convert('RGBA')
assert im.getchannel('A').getextrema()[0] == 0, 'Expected generated transparent background'
# Remove isolated generated fringe pixels outside the dense panel body.
a = im.getchannel('A')
ys = [y for y in range(im.height) if sum(v > 200 for v in a.crop((0,y,im.width,y+1)).getdata()) > im.width * .7]
assert ys, 'Panel body not found'
y0,y1=min(ys),max(ys)+1
xs = [x for x in range(im.width) if sum(v > 200 for v in a.crop((x,y0,x+1,y1)).getdata()) > (y1-y0)*.7]
im = im.crop((max(0,min(xs)-1),max(0,y0-1),min(im.width,max(xs)+2),min(im.height,y1+1)))
width, height = 884, 104
im = im.resize((round(im.width * height / im.height), height), Image.Resampling.LANCZOS)
cap = min(height, im.width // 3)
result = Image.new('RGBA', (width, height))
result.alpha_composite(im.crop((0, 0, cap, height)), (0, 0))
middle = im.crop((cap, 0, im.width - cap, height)).resize((width - 2 * cap, height), Image.Resampling.LANCZOS)
result.alpha_composite(middle, (cap, 0))
result.alpha_composite(im.crop((im.width - cap, 0, im.width, height)), (width - cap, 0))
# Keep the generated silhouette, cap panel opacity at 45 percent.
alpha = result.getchannel('A'); peak = alpha.getextrema()[1]
result.putalpha(alpha.point(lambda a: round(a * 115 / max(1, peak))))
asset = root / 'assets/tool-dialog-v1/ui_deadlock_banner_v2.png'
result.save(asset)
result.save(root / 'assets/runtime-ui/ui_deadlock_banner_v2.webp', lossless=True, exact=True)
(root / 'art/deadlock-banner-flat-provenance.json').write_text(json.dumps({
    'method': 'official Imagegen CLI generate',
    'model': 'gpt-image-2', 'quality': 'high',
    'prompt': 'art/deadlock-banner-flat-prompt.txt',
    'source': str(source.relative_to(root)),
    'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'asset': str(asset.relative_to(root)),
    'processing': 'Preserved generated silhouette; cropped margins; scaled end geometry uniformly and resized center; normalized maximum alpha to 115/255 for a translucent overlay.',
}, indent=2), encoding='utf-8')
print('Exported transparent 884x104 banner')
