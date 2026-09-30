"""Pack approved mechanism art and generated sleeping variants; preserve sources."""
from pathlib import Path
from PIL import Image, ImageDraw
import json, hashlib
root = Path(__file__).resolve().parents[1]
sources = {name: '原画资源/' + filename for name, filename in {'box': '箱子.png', 'spring': '弹簧玩具2.png', 'portal': '传送门2.png', 'key': '钥匙.png', 'lock': '锁盒.png', 'ice': '冰块.png'}.items()}
sources['spring'] = 'output/imagegen/mechanics-v2/spring-toy-1x1-overhead-horizontal.png'
sources['heart'] = 'output/imagegen/mechanics-v2/hug-heart-tag.png'
sources['sleep-count'] = 'output/imagegen/mechanics-v2/sleep-count-plate-flat.png'
out = root / 'assets' / 'mechanics-v1'
out.mkdir(parents=True, exist_ok=True)
atlas = Image.new('RGBA', (128 * len(sources), 128))
preview = Image.new('RGB', (128 * len(sources), 420), '#f6edf3')
manifest = {}
for i, (name, filename) in enumerate(sources.items()):
    path = root / filename
    image = Image.open(path).convert('RGBA')
    bounds = image.getchannel('A').point(lambda value: 255 if value > 2 else 0).getbbox()
    crop = image.crop(bounds)
    crop.thumbnail((120, 120), Image.Resampling.LANCZOS)
    x, y = i * 128 + (128 - crop.width) // 2, (128 - crop.height) // 2
    atlas.alpha_composite(crop, (x, y))
    preview.paste(crop, (x, y), crop)
    ImageDraw.Draw(preview).text((i * 128 + 12, 138), name, fill='#655267')
    manifest[name] = {'rect': [x, y, crop.width, crop.height], 'source': filename, 'sourceBounds': bounds, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
for name, base in [('rabbit', 'toy_rabbit_white_a'), ('whale', 'toy_whale_blue_a')]:
    path = root / f'output/imagegen/mechanics-v2/{name}-sleep.png'
    image = Image.open(path).convert('RGBA')
    bounds = image.getchannel('A').point(lambda value: 255 if value > 2 else 0).getbbox()
    image = image.crop(bounds)
    original = Image.open(root / f'assets/toyhouse-ui-v3/{base}.png')
    # Restore the existing sprite's aspect so waking cannot change its fitted size.
    scale = min(1, 768 / max(original.size))
    image = image.resize((round(original.width * scale), round(original.height * scale)), Image.Resampling.LANCZOS)
    image.save(out / f'{name}-sleep.webp', lossless=True)
    manifest[f'{name}-sleep'] = {'source': path.relative_to(root).as_posix(), 'sourceBounds': bounds, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'runtimeSize': list(image.size), 'reference': f'assets/toyhouse-ui-v3/{base}.png'}
    image.thumbnail((450 if name == 'whale' else 180, 230), Image.Resampling.LANCZOS)
    preview.paste(image, (260 if name == 'whale' else 35, 175), image)
atlas.save(out / 'mechanics.webp', lossless=True)
preview.save(out / 'preview.png')
(out / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
(root / 'src' / 'mechanic-art.js').write_text('export default ' + json.dumps({name: data['rect'] for name, data in manifest.items() if 'rect' in data}) + ';\n', encoding='utf-8')
print('Exported source-aligned mechanics atlas')
