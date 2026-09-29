"""Keep source pixels in the original composition; use ImageGen only for extensions."""
from pathlib import Path
from PIL import Image
import base64, hashlib, io, json, re

ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / 'tmp/imagegen/tall'
sources = json.loads((TMP / 'sources.json').read_text('utf-8'))
records = []
for name, source in sources.items():
    generated = ROOT / f'output/imagegen/tall-{name}-v1.png'
    final = Image.open(generated).convert('RGB')
    generated_size = list(final.size)
    assert abs(final.width / final.height - 1024 / 2816) < .002, final.size
    final = final.resize((1024, 2816), Image.Resampling.LANCZOS)
    reference = Image.open(TMP / f'{name}-reference.png').convert('RGBA')
    box = reference.getbbox()
    mask = reference.getchannel('A')
    # Small seam blend; the entire central scene remains source-aligned.
    for y in range(box[1], box[3]):
        alpha = min(1, (y - box[1]) / 32, (box[3] - 1 - y) / 32)
        if alpha < 1:
            mask.paste(round(255 * max(0, alpha)), (0, y, 1024, y + 1))
    final.paste(reference.convert('RGB'), (0, 0), mask)
    target = ROOT / f'assets/runtime-ui/tall-{name}-v1.webp'
    final.save(target, quality=93, method=6)
    if name == 'loading':
        thumbnail = final.resize((128, 352), Image.Resampling.LANCZOS)
        encoded = io.BytesIO(); thumbnail.save(encoded, format='WEBP', quality=55)
        manifest = ROOT / 'src/loading-art-manifest.js'
        data_url = 'data:image/webp;base64,' + base64.b64encode(encoded.getvalue()).decode('ascii')
        text, count = re.subn(r'"fallbackBackground":\s*"[^"]*"', '"fallbackBackground": ' + json.dumps(data_url), manifest.read_text('utf-8'))
        assert count == 1
        manifest.write_text(text, encoding='utf-8', newline='\n')
    records.append(dict(name=name, source=source, generated=str(generated.relative_to(ROOT)),
        output=str(target.relative_to(ROOT)), size=list(final.size), generated_size=generated_size, original_box=list(box),
        tool='official imagegen CLI', model='gpt-image-2', quality='high',
        prompt=(TMP / f'{name}-prompt.txt').read_text('utf-8'),
        sha256=hashlib.sha256(target.read_bytes()).hexdigest()))
(ROOT / 'art/tall-backgrounds-provenance.json').write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding='utf-8')
sheet=Image.new('RGB',(900,825))
for i,name in enumerate(sources):
    im=Image.open(ROOT / f'assets/runtime-ui/tall-{name}-v1.webp');im.thumbnail((300,825));sheet.paste(im,(i*300,0))
sheet.save(TMP / 'final-contact.png')
print('Exported 3 source-preserving tall backgrounds')
