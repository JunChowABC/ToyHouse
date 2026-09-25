from pathlib import Path
import json, shutil, hashlib
import numpy as np
from psd_tools import PSDImage

project=Path(__file__).resolve().parent.parent
delivery=project/'outputs/flip-popup2-layered-v1'
dest=project/'art/icon-semantics'
dest.mkdir(parents=True,exist_ok=True)
source=Path('C:/Users/ADMINI~1/AppData/Local/Temp/codex-clipboard-f5855e1c-dbac-41bf-9050-b3a861cc5b1f.png')
target=dest/'ui_tool_shuffle.png'
shutil.copy2(source,target)
parts=['orbit_effect','arrow_right_purple','arrow_left_pink','icon_star_left','icon_star_top_right','icon_star_bottom_left','icon_star_bottom_right']
record=dict(resource_id='ui_tool_shuffle',display_name='洗牌图标',meaning='洗牌',user_confirmed_on='2026-09-25',file='ui_tool_shuffle.png',appearance='紫色向右箭头与粉色向左箭头，周围有环形轨迹及星星',rule='此图标按用户定义代表洗牌；不要因相向箭头、原始弹窗标题或历史目录名而解释为翻转、反转方向。只更正命名和说明，不修改图形、弹窗文案或玩法。',layered_source='../../outputs/flip-popup2-layered-v1/flip-popup2-layered-v1.psd',layer_group='03_SHUFFLE_ICON',component_layer_ids=parts,sha256=hashlib.sha256(target.read_bytes()).hexdigest())
(dest/'ui_tool_shuffle.json').write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf8')
(dest/'README.md').write_text('# 图标语义登记\n\n- `ui_tool_shuffle.png`：用户指定的**洗牌图标**，外观保持原样。\n- `ui_tool_shuffle.json`：规范资源名、语义、来源和分层组件映射。\n- 此图标虽然来自历史名为 `flip-popup2-layered-v1` 的交付，其用途已由用户明确改为洗牌。历史弹窗标题和玩法文案不在本次修改范围。\n',encoding='utf8')
for name in ['psd-manifest.json','pixel-base-manifest.json']:
    f=delivery/name;m=json.loads(f.read_text('utf8'))
    m['icon_semantics']={'resource_id':'ui_tool_shuffle','meaning':'洗牌','group':'03_SHUFFLE_ICON','components':parts,'note':record['rule']}
    for g in m['groups']:
        if g['name']=='03_ICON':g['name']='03_SHUFFLE_ICON'
        for s in g['layers']:
            if s['name'] in parts:
                s['region']='03_SHUFFLE_ICON';s['semantic_parent']='ui_tool_shuffle';s['semantic_role']='洗牌图标组件'
                s['display_name']=s['display_name'].replace('反转','洗牌')
                s['usage']='洗牌图标组件：'+s['display_name']
    f.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf8')
f=delivery/'preparation-plan.json';p=json.loads(f.read_text('utf8'))
p['icon_semantics']=record['rule']
for a in p['assets']:
    if a['id'] in parts:
        a['group']='03_SHUFFLE_ICON';a['description']=a['description'].replace('反转','洗牌');a['semantic_parent']='ui_tool_shuffle'
f.write_text(json.dumps(p,ensure_ascii=False,indent=2),encoding='utf8')
f=delivery/'imagegen-provenance.json';p=json.loads(f.read_text('utf8'))
for a in p:
    if a['id'] in parts:a['semantic_parent']='ui_tool_shuffle';a['current_meaning']='洗牌'
f.write_text(json.dumps(p,ensure_ascii=False,indent=2),encoding='utf8')
for name in ['assemble.py','package_delivery.py','交付说明.md']:
    f=delivery/name;s=f.read_text('utf8').replace('03_ICON','03_SHUFFLE_ICON').replace('中央反转图标','中央洗牌图标（按用户最新定义）')
    f.write_text(s,encoding='utf8')
results=[]
for name in ['flip-popup2-layered-v1.psd','authoring/pixel-base.psd']:
    f=delivery/name;p=PSDImage.open(f);before=np.asarray(p.composite(force=True)).copy()
    for layer in p.descendants():
        if layer.name=='03_ICON':layer.name='03_SHUFFLE_ICON'
    p.save(f)
    after=np.asarray(PSDImage.open(f).composite(force=True))
    assert np.array_equal(before,after)
    results.append({'file':name,'composite_unchanged':True})
assert source.read_bytes()==target.read_bytes()
(delivery/'qa/icon-semantics-update.json').write_text(json.dumps({'meaning':'洗牌','canonical_resource':'art/icon-semantics/ui_tool_shuffle.png','source_pixels_unchanged':True,'psd_checks':results,'scope':'名称与语义说明；图形、文字和玩法未改动'},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'resource':str(target),'meaning':'洗牌','pixels_unchanged':True,'psd_checks':results},ensure_ascii=False))
