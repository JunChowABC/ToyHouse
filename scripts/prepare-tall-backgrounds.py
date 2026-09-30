"""Prepare centered reference canvases for ImageGen outpainting; no fabricated art."""
from pathlib import Path
from PIL import Image
import json

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'tmp/imagegen/tall'
OUT.mkdir(parents=True, exist_ok=True)
sources = {
    'home': 'assets/runtime-ui/home-static_0-1919c6712faa.webp',
    'play': 'assets/toyhouse-ui-v3/art_bedroom_bg_01.png',
    'loading': 'assets/loading-v1/background-f2df99b41453.webp',
}
for name, source in sources.items():
    original = Image.open(ROOT / source).convert('RGBA')
    resized = original.resize((1024, round(original.height * 1024 / original.width)), Image.Resampling.LANCZOS)
    top = (2816 - resized.height) // 2
    canvas = Image.new('RGBA', (1024, 2816), (0, 0, 0, 0))
    canvas.paste(resized, (0, top))
    canvas.save(OUT / f'{name}-reference.png')
    mask = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    mask.paste((255, 255, 255, 255), (0, top + 32, 1024, top + resized.height - 32))
    mask.save(OUT / f'{name}-mask.png')
    prompt = f'''Use case: precise-object-edit
Asset type: tall mobile game {name} room background, 1024x2816.
Input image: edit target, original room centered on a taller transparent canvas.
Primary request: OUTPAINT ONLY the transparent top and bottom bands, naturally continuing this exact pastel bedtime toy room. Top: continue the existing curtains, window/wall or ceiling. Bottom: continue the existing floor and foreground perspective. Match the existing soft warm lighting, pink cream lavender colors, hand-painted detail and perspective seamlessly.
Constraints: Keep the central original image in exactly the same position, size, composition and colors. Do not zoom, stretch, move, redesign, duplicate or replace any original objects. Do not add toys, characters, logos, UI controls, text, borders, frames, plain bars or blurred bands. The entire output must be an opaque continuous illustration. No transparency remains. Preserve the central play mat exactly if present. Only extend the room beyond the top and bottom edges.'''
    (OUT / f'{name}-prompt.txt').write_text(prompt, encoding='utf-8')
(OUT / 'sources.json').write_text(json.dumps(sources, ensure_ascii=False, indent=2), encoding='utf-8')
print(OUT)
