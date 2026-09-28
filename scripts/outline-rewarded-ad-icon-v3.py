"""Add a readable pastel-purple outline to the approved simple Imagegen icon."""
from pathlib import Path
from PIL import Image, ImageFilter

root = Path(__file__).resolve().parents[1]
im = Image.open(root/'assets/tool-dialog-v1/ui_rewarded_ad_v2.png').convert('RGBA')
alpha = im.getchannel('A')
# Nine pixels at 256px becomes about 1.45px in the 540px game canvas.
outline = alpha.filter(ImageFilter.MaxFilter(19)).filter(ImageFilter.GaussianBlur(.45))
result = Image.new('RGBA', im.size, '#BE8BCD')
result.putalpha(outline)
result.alpha_composite(im)
result.save(root/'assets/tool-dialog-v1/ui_rewarded_ad_v3.png')
