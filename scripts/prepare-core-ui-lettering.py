"""Package the approved ImageGen CLI lettering as independent transparent assets."""
from pathlib import Path
import hashlib
import json
import shutil
import numpy as np
from PIL import Image, ImageFilter

root = Path(__file__).resolve().parents[1]
source = root / 'output/imagegen/core-ui-v5'
out = root / 'art/core-ui-v5'
(out / 'generated').mkdir(parents=True, exist_ok=True)
records = []
for name, word in [('remove','消除'), ('shuffle','洗牌'), ('flip','翻转')]:
    path = source / f'{name}-lettering.png'
    im = Image.open(path).convert('RGBA')
    a = np.array(im)
    if name == 'remove':
        # The generated pink word has a broad translucent halo. Retain its
        # actual colored silhouette and nearby cream outline, excluding glow.
        ink = ((a[:,:,0].astype(int)-a[:,:,1].astype(int)) > 18) & (a[:,:,3] > 150)
        mask = Image.fromarray((ink*255).astype('uint8')).filter(ImageFilter.MaxFilter(43)).filter(ImageFilter.GaussianBlur(.7))
        a[:,:,3] = np.minimum(a[:,:,3], np.asarray(mask))
    a[:,:,3][a[:,:,3]<12] = 0
    im = Image.fromarray(a)
    im = im.crop(im.getchannel('A').getbbox())
    im.save(out / f'{name}-label.png')
    shutil.copyfile(path, out / 'generated' / path.name)
    prompt = (source / f'{name}-prompt.txt').read_text(encoding='utf-8')
    records.append(dict(id=f'{name}_label', text=word, method='ImageGen CLI/API', model='gpt-image-2',
                        prompt=prompt, generated_file='generated/'+path.name,
                        generated_sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                        asset=f'{name}-label.png', alpha=True))
(out/'provenance.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
print('Packaged three independent lettering PNGs with generation provenance.')
