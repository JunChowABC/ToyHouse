"""Export the approved PSD title type layers for consistent mobile lettering."""
from pathlib import Path
import hashlib
import json
from psd_tools import PSDImage
from PIL import Image

root = Path(__file__).resolve().parent.parent
source = root / 'outputs/level-complete-popup2-layered-v1'
manifest = json.loads((source / 'psd-manifest.json').read_text('utf-8'))
assert json.loads((source / 'qa/validation-report.json').read_text('utf-8'))['valid']
psd = PSDImage.open(source / manifest['output'])
layers = {layer.name: layer for layer in psd.descendants()}
output = root / 'art/level-complete-popup2'
output.mkdir(parents=True, exist_ok=True)
assets = {}
png_hashes = {}
for group in manifest['groups']:
    for spec in group['layers']:
        layer = layers[spec['name']]
        image = Image.open(source / spec['file']).convert('RGBA')
        actual = layer.topil().convert('RGBA')
        assert image.size == actual.size
        # Fully transparent RGB is unspecified in PSD; compare visible pixels and alpha.
        assert image.getchannel('A').tobytes() == actual.getchannel('A').tobytes()
        for pixel, other in zip(image.getdata(), actual.getdata()):
            assert pixel[3] == 0 or pixel == other, spec['name']
        assert list(layer.bbox) == [spec['left'], spec['top'], spec['left'] + image.width, spec['top'] + image.height]
        png_hashes[spec['name']] = hashlib.sha256((source / spec['file']).read_bytes()).hexdigest()
for name, asset_id in [('txt_level_complete', 'arttext_level_complete'), ('txt_rewards', 'arttext_rewards')]:
    layer = layers[name]
    assert layer.kind == 'type'
    image = layer.composite(force=True).convert('RGBA')
    file = output / f'{asset_id}.png'
    image.save(file)
    assets[asset_id] = dict(file=file.name, bounds=[layer.left, layer.top, image.width, image.height],
                            sha256=hashlib.sha256(file.read_bytes()).hexdigest(),
                            source_layer=name, text=layer.text,
                            method='runtime export of approved PSD type layer; authoring PSD remains editable')
(output / 'lettering-manifest.json').write_text(json.dumps(dict(source=f'outputs/level-complete-popup2-layered-v1/{manifest["output"]}', source_png_sha256=png_hashes, assets=assets), ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Exported 2 approved PSD title layers; editable PSD unchanged.')
