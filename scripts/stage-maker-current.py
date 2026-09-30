"""Stage the existing Maker renderer plus all current production gameplay changes."""
import json, pathlib, shutil, sys
from PIL import Image
ROOT=pathlib.Path(__file__).resolve().parents[1]
MAKER=pathlib.Path('D:/AI游戏/晚安，玩具屋-Maker')
OUT=ROOT/'output/maker-current-release'
sys.path.insert(0,str(ROOT/'output/maker-port/test-deps'))
from lupa.lua54 import LuaRuntime
OUT.joinpath('scripts').mkdir(parents=True,exist_ok=True)
def lua(v):
    if v is None:return 'nil'
    if isinstance(v,bool):return 'true' if v else 'false'
    if isinstance(v,(int,float)):return str(v)
    if isinstance(v,str):return json.dumps(v,ensure_ascii=False)
    if isinstance(v,list):return '{'+','.join(lua(x) for x in v)+'}'
    return '{'+','.join('['+lua(k)+']='+lua(x) for k,x in v.items())+'}'
levels=json.loads((ROOT/'src/level-config.js').read_text('utf-8').split('export default ',1)[1].rstrip().removesuffix(';'))
(OUT/'scripts/Levels.lua').write_text('return '+lua(levels)+'\n',encoding='utf-8')
for name in ['Mechanics','MechanicGame','MechanicView','Save','SaveCodec']:
    shutil.copy2(ROOT/f'scripts/maker/{name}.lua',OUT/f'scripts/{name}.lua')
data=(MAKER/'scripts/Data.lua').read_text('utf-8-sig')
data=data.replace('return {','local data={',1)+'\ndata.levels=require("Levels")\nreturn data\n'
(OUT/'scripts/Data.lua').write_text(data,encoding='utf-8')
game=(MAKER/'scripts/Game.lua').read_text('utf-8-sig')
game=game.replace("local Data = require('Data')","local Data = require('Data')\nlocal M=require('Mechanics')")
game=game.replace("and t.archetypeId~='AUTO_EXIT' and not self:isMoving(t)","and t.archetypeId~='AUTO_EXIT' and not self:isMoving(t) and (not self.board or M.enabled(t))")
game=game.replace("or #self.moving>0 or #self.exiting>0 then return end","or #self.moving>0 or #self.exiting>0 or self.time<(self.busyUntil or 0) then return end")
game=game.replace('return G',"require('MechanicGame')(G,Data)\nreturn G")
(OUT/'scripts/Game.lua').write_text(game,encoding='utf-8')
art={};atlas=Image.open(ROOT/'assets/mechanics-v1/mechanics.webp').convert('RGBA')
rects=json.loads((ROOT/'src/mechanic-art.js').read_text('utf-8').split('export default ',1)[1].strip().removesuffix(';'))
for name,rect in rects.items():
    x,y,w,h=rect;im=atlas.crop((x,y,x+w,y+h));file=f'toyhouse-ui-v2/mechanics/{name}.png';dest=OUT/'assets'/file;dest.parent.mkdir(parents=True,exist_ok=True);im.save(dest);art[name]={'file':file,'size':list(im.size)}
for name in ['rabbit','whale']:
    im=Image.open(ROOT/f'assets/mechanics-v1/{name}-sleep.webp').convert('RGBA');file=f'toyhouse-ui-v2/mechanics/{name}-sleep.png';im.save(OUT/'assets'/file);art[name+'-sleep']={'file':file,'size':list(im.size)}
(OUT/'scripts/MechanicAssets.lua').write_text('return '+lua(art)+'\n',encoding='utf-8')
view=(MAKER/'scripts/View.lua').read_text('utf-8-sig')
view=view.replace("local uiData=require('UiData')","local uiData=require('UiData')\nlocal mechanicArt=require('MechanicAssets')")
view=view.replace('play={playAssets,{tall.play}}','play={playAssets,{tall.play},mechanicArt}')
view=view.replace('uiData.loading.assets,tall}','uiData.loading.assets,tall,mechanicArt}')
view=view.replace("or duck and 0 or", "or duck and (t.direction=='UP' and math.pi/2 or t.direction=='DOWN' and -math.pi/2 or 0) or")
view=view.replace('local a=D.core.assets[id];local rotated=',"local a=t.sleeping and mechanicArt[rabbit and 'rabbit-sleep' or 'whale-sleep'] or D.core.assets[id];local rotated=")
view=view.replace("if not rabbit and not duck and t.direction=='RIGHT' then", "if not rabbit and t.direction=='RIGHT' then")
view=view.replace('if pose.blink>=.5 then drawBlink','if not t.sleeping and pose.blink>=.5 then drawBlink')
view=view.replace('function V.background()',"require('MechanicView')(V,img,toy,color)\nfunction V.background()")
view=view.replace('local v=V.vg;V.background()', 'local v=V.vg;V.background();V.mechanicEntities(g)')
view=view.replace("for _,t in ipairs(g.toys) do if t.state=='IDLE' then\n        local x,y=0,0;", "for _,t in ipairs(g.toys) do if t.state=='IDLE' then\n        local flying=false for _,f in ipairs(g.flights or {}) do if f.toy.id==t.id then flying=true end end\n        local x,y=0,0;")
view=view.replace('        toy(g,t,x,y,1)\n    end end', '        if not flying then toy(g,t,x,y,1);V.mechanicOverlay(g,t) end\n    end end\n    V.mechanicFlights(g)')
view=view.replace('local f=p-i+1;local c,b=a.path[i],a.path[i+1]', 'local f=p-i+1;local c,b=a.path[i],a.path[i+1]')
view=view.replace('            toy(g,a.toy,(c.x+', "            if b.portal then f=f>=.5 and 1 or 0 end\n            local dx,dy=b.x-c.x,b.y-c.y;a.toy.direction=math.abs(dx)>math.abs(dy) and (dx>0 and 'RIGHT' or 'LEFT') or (dy>0 and 'DOWN' or 'UP')\n            toy(g,a.toy,(c.x+")
view=view.replace("'20 关全部完成'", "tostring(#D.levels.levels)..' 关全部完成'")
(OUT/'scripts/View.lua').write_text(view,encoding='utf-8')
print('Staged Maker: 200 levels, production mechanisms, sleeping/ice/hug/key/portal/spring art and motion')
