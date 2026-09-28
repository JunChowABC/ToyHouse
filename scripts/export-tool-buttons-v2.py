"""Fit generated button art by trimming its neutral center, never squashing corners."""
from pathlib import Path
import json
import sys
from PIL import Image, ImageChops, ImageDraw

root = Path(__file__).resolve().parents[1]
version = sys.argv[1] if len(sys.argv) > 1 else 'v2'
assert version in ('v2', 'v3')
source = root / f'output/imagegen/tool-buttons-{version}.png'
sheet = Image.open(source).convert('RGBA')
report = {'source': str(source.relative_to(root)), 'method': 'center trim then uniform resize', 'buttons': []}
for index, name in enumerate([f'ui_tool_buy_yellow_{version}', f'ui_tool_ad_pink_{version}']):
    im = sheet.crop((0, index*sheet.height//2, sheet.width, (index+1)*sheet.height//2))
    # Retain the main connected silhouette; remove detached generation specks.
    alpha = im.getchannel('A')
    mask = alpha.point(lambda a: 255 if a > 16 else 0)
    ImageDraw.floodfill(mask, (im.width//2, im.height//2), 128)
    mask = mask.point(lambda p: 255 if p == 128 else 0)
    im.putalpha(ImageChops.multiply(alpha, mask))
    im = im.crop(im.getbbox())
    original = im.size
    target_width = round(im.height * 254 / 143)
    assert im.width >= target_width, 'Generated silhouette must be at least the target aspect ratio'
    left = target_width//2
    fitted = Image.new('RGBA', (target_width, im.height))
    fitted.paste(im.crop((0, 0, left, im.height)), (0, 0))
    fitted.paste(im.crop((im.width-(target_width-left), 0, im.width, im.height)), (left, 0))
    # Rounding is less than one source pixel; runtime and export share the exact 254:143 canvas.
    fitted = fitted.resize((508, 286), Image.Resampling.LANCZOS)
    dest = root / 'assets/tool-dialog-v1' / f'{name}.png'
    fitted.save(dest)
    report['buttons'].append({'file': str(dest.relative_to(root)), 'sourceSize': original,
                              'trimmedCenterWidth': original[0]-target_width, 'size': fitted.size})
(root/f'art/tool-buttons-{version}.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
