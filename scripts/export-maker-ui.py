"""Materialize exactly the web runtime pixels and Lua metadata; no generated art."""
import hashlib, json, pathlib, posixpath
from PIL import Image, ImageOps, ImageDraw, ImageChops

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/maker-ui-sync'
data = json.loads((OUT / 'web-ui.json').read_text('utf-8'))
aliases, atlas = data.pop('aliases'), data.pop('atlas')
loading=data.pop('loading')
provenance = []
for group, manifest in data.items():
    manifest['order'] = list(manifest['assets'])
    for key, spec in manifest['assets'].items():
        source = posixpath.normpath(spec.get('directory', manifest['directory']) + '/' + spec['file'])
        canonical = aliases.get(source, source)
        sprite = atlas.get(canonical)
        runtime_source = sprite['file'] if sprite else canonical
        with Image.open(ROOT / runtime_source) as original:
            im = original.convert('RGBA')
        if sprite:
            x, y, w, h = sprite['rect']
            im = im.crop((x, y, x+w, y+h))
        target = f'toyhouse-ui-v2/{group}/{key}.png'
        dest = OUT / 'assets' / target
        dest.parent.mkdir(parents=True, exist_ok=True)
        im.save(dest, optimize=True)
        spec.update(file=target, size=list(im.size))
        provenance.append(dict(source=source, runtimeSource=runtime_source,
                               rect=sprite['rect'] if sprite else None, output=target,
                               sha256=hashlib.sha256(dest.read_bytes()).hexdigest()))
    if group == 'tool':
        manifest['disabled'] = {}
        for key in manifest['purchase'] + ['use_base']:
            spec = manifest['assets'][key]
            with Image.open(OUT / 'assets' / spec['file']) as original:
                gray = ImageOps.grayscale(original).convert('RGBA')
                gray.putalpha(original.getchannel('A'))
            target = f'toyhouse-ui-v2/tool/{key}_disabled.png'
            gray.save(OUT / 'assets' / target)
            manifest['disabled'][key] = dict(spec, file=target)

# Assemble the settings frame once at integer boundaries, before screen scaling.
panel = data['pause']['assets']['panel_base']
with Image.open(OUT / 'assets' / panel['file']) as original:
    width, height = original.size
    compact = Image.new('RGBA', (width, 610))
    compact.paste(original.crop((0, 0, width, 160)), (0, 0))
    compact.paste(original.crop((0, 160, width, height-150)).resize((width, 300), Image.Resampling.BILINEAR), (0, 160))
    compact.paste(original.crop((0, height-150, width, height)), (0, 460))
target='toyhouse-ui-v2/pause/home_settings_frame.png'
compact.save(OUT / 'assets' / target)
x,y,w,h=panel['bounds']
data['pause']['assets']['home_settings_frame']=dict(file=target,size=[width,610],bounds=[x,y+180,w,610])

# Decode the published lossless loading atlas into native Maker images.
for key,spec in loading['assets'].items():
    source=loading['directory']+'/'+(loading['background'] if key=='art_loading_background' else loading['atlas'])
    im=Image.open(ROOT/source).convert('RGBA')
    if 'rect' in spec:
        x,y,w,h=spec['rect'];im=im.crop((x,y,x+w,y+h))
    target=f'toyhouse-ui-v2/loading/{key}.png'
    dest=OUT/'assets'/target;dest.parent.mkdir(parents=True,exist_ok=True);im.save(dest)
    spec.update(file=target,size=list(im.size))
    provenance.append(dict(source=source,output=target,sha256=hashlib.sha256(dest.read_bytes()).hexdigest()))
# Fit/tile the slanted fill once, and pre-mask its rounded ends before fraction clipping.
track=loading['assets']['ui_progress_track']['bounds']
fill=loading['assets']['ui_progress_fill']
original=Image.open(OUT/'assets'/fill['file']).convert('RGBA');sw,sh=original.size
width,height=track[2]-4,track[3]-4
strip=Image.new('RGBA',(width,height))
strip.paste(original.crop((2,2,sw-2,sh-2)).resize((sw-4,height)),(0,0))
tile=original.crop((34,2,sw-2,sh-2)).resize((sw-36,height))
for x in range(sw-4,width,sw-36):strip.paste(tile,(x,0))
mask=Image.new('L',strip.size);ImageDraw.Draw(mask).rounded_rectangle((0,0,width-1,height-1),radius=height/2,fill=255)
strip.putalpha(ImageChops.multiply(strip.getchannel('A'),mask))
target='toyhouse-ui-v2/loading/progress_fitted.png';strip.save(OUT/'assets'/target)
loading['assets']['progress_fitted']=dict(file=target,size=[width,height],bounds=[track[0]+2,track[1]+2,width,height])
data['loading']=loading

def lua(value):
    if value is None: return 'nil'
    if isinstance(value, bool): return 'true' if value else 'false'
    if isinstance(value, (int, float)): return str(value)
    if isinstance(value, str): return json.dumps(value, ensure_ascii=False)
    if isinstance(value, list): return '{' + ','.join(map(lua, value)) + '}'
    return '{' + ','.join('['+lua(k)+']='+lua(v) for k,v in value.items()) + '}'

(OUT / 'scripts').mkdir(exist_ok=True)
(OUT / 'scripts/UiData.lua').write_text('-- Generated from published Web UI; do not hand-edit.\nreturn '+lua(data)+'\n', encoding='utf-8')
(OUT / 'asset-provenance.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Exported {len(provenance)} exact web UI assets plus disabled button variants')
