"""Remove only connected near-white backdrop from the generated icon."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1]
im = Image.open(root/'output/imagegen/rewarded-ad-icon-v2.png').convert('RGBA')
mask = Image.new('L', im.size)
mask.putdata([255 if min(r,g,b) >= 244 and max(r,g,b)-min(r,g,b) <= 12 else 0
              for r,g,b,a in im.getdata()])
ImageDraw.floodfill(mask, (0,0), 128)
im.putalpha(mask.point(lambda value: 0 if value == 128 else 255))
# The interior white play symbol is enclosed and is therefore retained.
im = im.crop(im.getbbox())
im.thumbnail((220,220), Image.Resampling.LANCZOS)
canvas = Image.new('RGBA',(256,256))
canvas.alpha_composite(im,((256-im.width)//2,(256-im.height)//2))
canvas.save(root/'assets/tool-dialog-v1/ui_rewarded_ad_v2.png')
