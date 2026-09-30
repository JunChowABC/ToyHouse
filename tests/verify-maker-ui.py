"""Execute real Maker Lua UI with a recording NanoVG surface; verify assets and controls."""
import hashlib, json, pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
STAGE=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'output/maker-ui-sync'
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
for name in ('Levels','Mechanics','MechanicGame','MechanicAssets','MechanicView','Data','Game','UiData','UiMotion','View'):
    file=STAGE/'scripts'/f'{name}.lua'
    if not file.exists():file=MAKER/'scripts'/f'{name}.lua'
    if not file.exists():continue
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
for name in ('CreateImage','TextBounds','RGBA','ImagePattern','BeginPath','MoveTo','LineTo','ClosePath','Rect','RoundedRect','FillColor','FillPaint','Fill','Save','Restore','Translate','Scale','Rotate','FontFace','FontSize','TextAlign','Text','Ellipse','Circle','IntersectScissor','GlobalAlpha','StrokeColor','StrokeWidth','Stroke'):
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
draw('home-compact',"g=G.new();V.pressed=nil")
lua.execute("assert(#V.controls(g)==2);for _,c in ipairs(V.controls(g)) do assert(c.id=='home.start' or c.id=='home.settings');if c.id=='home.settings' then assert(c.bounds[2]<200,'settings must occupy first slot') end end")
assert not any(str(args[2]) in ('任务','活动','邮箱','七日签到','图鉴','装扮','+') for op,args in calls if op=='nvgText')
for fraction in (0,.6,1):
    calls.clear();lua.execute(f'V.loading({fraction},false)');scenes[f'loading-{fraction}']=list(calls)
calls.clear();lua.execute('V.images={};V.loading(.6,true)');scenes['loading-fallback']=list(calls)
lua.execute('V.loadImages()')
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
if len(sys.argv)>1:
    draw('ad-pending',"g=G.new();g:start(1);g.modal='remove';g.adPending=true;g.adMessage='广告加载中，请稍候…'")
    lua.execute('assert(#V.controls(g)==0)')
    draw('ad-reward',"g.adPending=false;g.profile.inventory.remove=1;g.adMessage='已获得 1 个道具'")
draw('select-flip',"g=G.new();g:start(1);g.tool='flip';g.profile.inventory.flip=1")
lua.execute('assert(#V.controls(g)==0)')
draw('select-remove-first',"g.tool='remove';g.selected={};g.profile.inventory.remove=1")
lua.execute('assert(#V.controls(g)==0)')
draw('select-remove-second',"g.selected={g.toys[1].id}")
lua.execute('assert(#V.controls(g)==0)')
if hasattr(lua.globals().G,'updateDeadlock') and lua.globals().G.updateDeadlock:
    draw('deadlock-hint',"g=G.new();g:start(1);g.toys={{id='a',archetypeId='ORDINARY',state='IDLE',direction='RIGHT',x=4,y=5,length=2,cells={{x=4,y=5},{x=5,y=5}}},{id='b',archetypeId='ORDINARY',state='IDLE',direction='LEFT',x=6,y=5,length=2,cells={{x=6,y=5},{x=7,y=5}}}};for _,t in ipairs(g.toys) do t.blockedAt=-9999;t.impactDx=0;t.impactDy=0;t.numericId=1 end;g:update(.1);g:update(.7)")
    lua.execute("assert(g:deadlockHint().tool=='shuffle');g.uses.shuffle=3;assert(g:deadlockHint().tool=='remove');g.uses.remove=3;g.uses.flip=3;assert(g:deadlockHint().tool==nil);g.modal='flip';assert(g:deadlockHint()==nil);g.modal=nil;g.tool='flip';assert(g:deadlockHint()==nil);g.tool=nil;g.toys[1].direction='LEFT';g:update(.4);assert(g:deadlockHint()==nil)")
draw('complete',"g=G.new();g:start(1);g.mode='level-complete'")
draw('complete-next-pressed',"V.pressed='complete.next'")
draw('last-complete',"V.pressed=nil;g.levelIndex=20")
if lua.eval("#require('Data').levels.levels")>=200:
    for level in (29,46,76,139,151,192,198,200):
        draw(f'mechanics-{level}',f"g=G.new();g:start({level});V.pressed=nil")
    draw('last-complete-200',"g.mode='level-complete';g.levelIndex=200")
draw('finale',"g.mode='finale'")
# Rendering cannot modify the persisted profile or gameplay state.
lua.execute("g=G.new();g:start(1);g.profile.coins=777")
before=convert(lua.globals().g.profile);lua.execute('V.draw(g)');assert before==convert(lua.globals().g.profile)
# All exported pixels must still match their source provenance.
for entry in json.loads((STAGE/'asset-provenance.json').read_text('utf-8')) if (STAGE/'asset-provenance.json').exists() else []:
    assert hashlib.sha256((STAGE/'assets'/entry['output']).read_bytes()).hexdigest()==entry['sha256']
(STAGE/'draw-traces.json').write_text(json.dumps({'files':files,'scenes':scenes},ensure_ascii=False),encoding='utf-8')
(STAGE/'validation.json').write_text(json.dumps({'passed':checks,'imageCount':len(files),'profileUnchanged':True},indent=2),encoding='utf-8')
print(f'PASS: {len(checks)} Lua UI scenes; {len(files)} images; asset hashes, control hits, disabled buttons, transform stack, profile preserved')
