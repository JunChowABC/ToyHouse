"""Execute real Maker Lua UI with a recording NanoVG surface; verify assets and controls."""
import hashlib, json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
STAGE=ROOT/'output/maker-ui-sync'
MAKER=pathlib.Path(r'D:\AI游戏\晚安，玩具屋-Maker')
sys.path.insert(0,str(ROOT/'output/maker-port/test-deps'))
from lupa.lua54 import LuaRuntime
lua=LuaRuntime(unpack_returned_tuples=True)
def convert(v):
    if hasattr(v,'items'):
        keys=list(v.keys())
        if keys==list(range(1,len(keys)+1)):return [convert(v[i]) for i in keys]
        return {str(k):convert(x) for k,x in v.items()}
    return v
for name in ('Data','Game','UiData','View'):
    file=(STAGE if name in ('UiData','View') else MAKER)/'scripts'/f'{name}.lua'
    lua.globals().package.preload[name]=lua.eval('function(s,n) return assert(load(s,n)) end')(file.read_text('utf-8-sig'),name)
calls=[];files={}
def record(name,*args):
    args=[convert(a) for a in args]
    if name=='nvgCreateImage':
        file=args[1];path=STAGE/'assets'/file
        if not path.exists():path=MAKER/'assets'/file
        assert path.is_file(),file
        key=len(files)+1;files[key]=str(path);return key
    if name=='nvgTextBounds':return len(str(args[3]))*14
    if name=='nvgRGBA':return list(args)
    if name=='nvgImagePattern':return {'image':args[6],'bounds':args[1:5],'alpha':args[7]}
    calls.append([name,args[1:]])
for name in ('CreateImage','TextBounds','RGBA','ImagePattern','BeginPath','Rect','RoundedRect','FillColor','FillPaint','Fill','Save','Restore','Translate','Scale','Rotate','FontFace','FontSize','TextAlign','Text','Ellipse','Circle','IntersectScissor','GlobalAlpha','StrokeColor','StrokeWidth','Stroke'):
    lua.globals()['nvg'+name]=lambda *args,n='nvg'+name:record(n,*args)
lua.execute('NVG_ALIGN_CENTER=1;NVG_ALIGN_MIDDLE=2; V=require("View");G=require("Game");N=require("UiData"); V.init(1);V.loadImages();g=G.new()')
scenes={};checks=[]
def draw(name,setup):
    lua.execute(setup)
    calls.clear();lua.execute('V.draw(g)')
    balance=0
    for op,_ in calls:
        balance+=(1 if op=='nvgSave' else -1 if op=='nvgRestore' else 0)
        assert balance>=0,name
    assert balance==0,name
    scenes[name]=list(calls)
    lua.execute('''for _,c in ipairs(V.controls(g)) do
      local b=c.bounds
      assert(b[3]>0 and b[4]>0 and b[1]>=0 and b[2]>=0 and b[1]+b[3]<=541 and b[2]+b[4]<=961,c.id)
      assert(V.hit(g,b[1]+b[3]/2,b[2]+b[4]/2)==c.id,c.id..' hit mismatch')
    end''')
    checks.append(name)
draw('home',"g=G.new();g.profile.coins=1234")
draw('home-settings',"g.pause=true")
draw('home-settings-pressed',"V.pressed='settings.music'")
draw('home-settings-toggled',"V.pressed=nil;g.profile.settings={musicEnabled=false,audioEnabled=false,vibrationEnabled=true}")
main=(STAGE/'scripts/main.lua').read_text('utf-8-sig')
action=main[main.index('local function action(id)'):main.index('local function pointerDown')]
lua.execute('View=V;Save={mark=function() end};elapsed=0;navUntil=0;'+action.replace('local function action(id)','function action(id)',1))
for key in ('task','event','mail','signin','album','dress'):
    draw('home-'+key, "g=G.new();game=g;V.pressed='home."+key+"';action('home."+key+"')")
    texts=[args[2] for op,args in calls if op=='nvgText']
    assert any('功能敬请期待' in str(t) for t in texts),key
lua.execute('V.updateNotice(2.3);V.pressed=nil')
draw('home-notice-expired',"g=G.new()")
assert not any('功能敬请期待' in str(args[2]) for op,args in calls if op=='nvgText')
draw('home-all-complete',"g=G.new();for _,l in ipairs(require('Data').levels.levels) do g.profile.completedLevels[l.level_id]=true end")
lua.execute("for _,c in ipairs(V.controls(g)) do assert(c.id~='home.start') end")
draw('game-combo12',"g=G.new();g:start(1);g.combo=12;g.comboUntil=4000;g.profile.coins=1234;g.profile.inventory={remove=2,shuffle=3,flip=4}")
draw('game-pressed',"V.pressed='play.shuffle'")
draw('pause',"V.pressed=nil;g.pause=true")
draw('pause-pressed',"V.pressed='pause.resume'")
draw('pause-toggled',"V.pressed=nil;g.profile.settings={musicEnabled=false,audioEnabled=false,vibrationEnabled=true}")
for tool in ('remove','shuffle','flip'):
    for state in ('buy','use','disabled'):
        draw(f'{tool}-{state}',f"g=G.new();g:start(1);g.modal='{tool}';g.profile.coins={1000 if state=='buy' else 0};g.profile.inventory.{tool}={1 if state=='use' else 0}")
        lua.execute("local enabled=false;for _,c in ipairs(V.controls(g)) do if c.id=='tool.action' then enabled=true end end;assert(enabled=="+('false' if state=='disabled' else 'true')+")")
draw('complete',"g=G.new();g:start(1);g.mode='level-complete'")
draw('complete-next-pressed',"V.pressed='complete.next'")
draw('last-complete',"V.pressed=nil;g.levelIndex=20")
draw('finale',"g.mode='finale'")
# Rendering cannot modify the persisted profile or gameplay state.
lua.execute("g=G.new();g:start(1);g.profile.coins=777")
before=convert(lua.globals().g.profile);lua.execute('V.draw(g)');assert before==convert(lua.globals().g.profile)
# All exported pixels must still match their source provenance.
for entry in json.loads((STAGE/'asset-provenance.json').read_text('utf-8')):
    assert hashlib.sha256((STAGE/'assets'/entry['output']).read_bytes()).hexdigest()==entry['sha256']
(STAGE/'draw-traces.json').write_text(json.dumps({'files':files,'scenes':scenes},ensure_ascii=False),encoding='utf-8')
(STAGE/'validation.json').write_text(json.dumps({'passed':checks,'imageCount':len(files),'profileUnchanged':True},indent=2),encoding='utf-8')
print(f'PASS: {len(checks)} Lua UI scenes; {len(files)} images; asset hashes, control hits, disabled buttons, transform stack, profile preserved')
