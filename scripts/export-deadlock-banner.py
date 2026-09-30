"""Export Imagegen banner; preserve alpha and rounded end geometry."""
from pathlib import Path
from PIL import Image
import hashlib, json

root = Path(__file__).resolve().parents[1]
source = root / 'output/imagegen/deadlock-banner-v1.png'
im = Image.open(source).convert('RGBA')
assert im.getchannel('A').getextrema()[0] == 0, 'Expected generated transparent background'
im = im.crop(im.getbbox())
width, height = 884, 104
im = im.resize((round(im.width * height / im.height), height), Image.Resampling.LANCZOS)
cap = min(height, im.width // 3)
result = Image.new('RGBA', (width, height))
result.alpha_composite(im.crop((0, 0, cap, height)), (0, 0))
middle = im.crop((cap, 0, im.width - cap, height)).resize((width - 2 * cap, height), Image.Resampling.LANCZOS)
result.alpha_composite(middle, (cap, 0))
result.alpha_composite(im.crop((im.width - cap, 0, im.width, height)), (width - cap, 0))
asset = root / 'assets/tool-dialog-v1/ui_deadlock_banner_v1.png'
result.save(asset)
result.save(root / 'assets/runtime-ui/ui_deadlock_banner_v1.webp', lossless=True, exact=True)
(root / 'art/deadlock-banner-provenance.json').write_text(json.dumps({
    'method': 'official Imagegen CLI edit; reference for style only',
    'model': 'gpt-image-2', 'quality': 'high',
    'prompt': 'art/deadlock-banner-prompt.txt',
    'source': str(source.relative_to(root)),
    'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
    'asset': str(asset.relative_to(root)),
    'processing': 'Preserved generated alpha; cropped margins; scaled rounded ends uniformly; resized center only to 884x104.',
}, indent=2), encoding='utf-8')
print('Exported transparent 884x104 banner')
