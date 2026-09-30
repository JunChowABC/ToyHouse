"""Run real Maker layout/View Lua and replayable NanoVG traces across tall screens."""
import json, pathlib, runpy, shutil, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
STAGE=ROOT/'output/tall-screen-maker'
MAKER=pathlib.Path(r'D:\AI游戏\晚安，玩具屋-Maker')
for relative in ['scripts/Main.lua','scripts/View.lua','scripts/ScreenLayout.lua'] + [f'assets/toyhouse-ui-v2/tall/{name}-v1.png' for name in ('home','play','loading')]:
    target=STAGE/relative
    target.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(MAKER/relative,target)
sys.argv=['verify-maker-ui.py',str(STAGE)]
base=runpy.run_path(str(ROOT/'tests/verify-maker-ui.py'))
lua,calls,convert=base['lua'],base['calls'],base['convert']
for name in ('ScreenLayout',):
    lua.globals().package.preload[name]=lua.eval('function(s,n) return assert(load(s,n)) end')((STAGE/'scripts'/f'{name}.lua').read_text('utf-8'),name)
lua.execute('''
sdk={GetNativeExitMenuRect=function() return capsule end}
graphics={GetDPR=function() return testDpr end,GetWidth=function() return testW*testDpr end,GetHeight=function() return testH*testDpr end}
for _,name in ipairs({'Save','RewardedAds','AdPreview','Loading'}) do package.loaded[name]={} end
''')
lua.execute((STAGE/'scripts/Main.lua').read_text('utf-8'))
lua.execute('''
local function find(fn,key,visited)
    visited=visited or {};if visited[fn] then return nil end;visited[fn]=true
    for i=1,100 do
        local name,value=debug.getupvalue(fn,i);if not name then break end
        if name==key then return value end
        if type(value)=='function' then local result=find(value,key,visited);if result then return result end end
    end
end
resizeActual=find(HandleRender,'resize')
pointActual=find(HandleTouchBegin,'point')
getLayout=function() return find(resizeActual,'layout') end
assert(resizeActual and pointActual)
''')
scenes={};layouts={};checks=[]
setups={
 'home':"g=G.new()", 'settings':"g=G.new();g.pause=true",
 'play':"g=G.new();g:start(1)", 'pause':"g=G.new();g:start(1);g.pause=true",
 'remove':"g=G.new();g:start(1);g.modal='remove'", 'shuffle':"g=G.new();g:start(1);g.modal='shuffle'",
 'flip':"g=G.new();g:start(1);g.modal='flip'", 'complete':"g=G.new();g:start(1);g.mode='level-complete'",
 'target':"g=G.new();g:start(1);g.tool='flip'", 'finale':"g=G.new();g.mode='finale'",
}
for w,h,dpr,cap in [(540,960,1,0),(393,852,3,.12),(360,800,2,.1),(360,960,3,.12),(844,390,2,0),(393,852,3,.12)]:
    lua.execute(f'testW={w};testH={h};testDpr={dpr};capsule={{bottom={cap}}};for i=1,14 do resizeActual() end')
    layout=convert(lua.globals().getLayout());prefix=f'{w}x{h}'
    for name,setup in setups.items():
        lua.execute("require('UiMotion').sync(nil);V.pressed=nil;"+setup)
        calls.clear()
        lua.execute('local l=getLayout();nvgScale(V.vg,l.scale,l.scale);nvgTranslate(V.vg,l.x,l.y);V.draw(g)')
        lua.execute('''
        local l=getLayout()
        for _,c in ipairs(V.controls(g)) do
            local b=c.bounds;local x,y=(b[1]+b[3]/2+l.x)*l.scale*l.dpr,(b[2]+b[4]/2+l.y)*l.scale*l.dpr
            local dx,dy=pointActual(x,y)
            assert(V.hit(g,dx,dy)==c.id,c.id..' input mismatch')
            assert((b[2]+l.y)*l.scale>=-0.01 and (b[2]+b[4]+l.y)*l.scale<=l.h+.01,c.id..' clipped')
        end
        ''')
        # The first image is the room: its transformed bounds must cover all screen edges.
        image=next(a[0] for op,a in calls if op=='nvgFillPaint')
        x,y,bw,bh=image['bounds'];s=layout['scale']
        assert (x+layout['x'])*s<=.01 and (x+bw+layout['x'])*s>=w-.01
        assert (y+layout['y'])*s<=.01 and (y+bh+layout['y'])*s>=h-.01
        key=f'{prefix}-{name}';scenes[key]=list(calls);layouts[key]={'width':w,'height':h}
    calls.clear();lua.execute('local l=getLayout();nvgScale(V.vg,l.scale,l.scale);nvgTranslate(V.vg,l.x,l.y);V.loading(.6,false)')
    key=f'{prefix}-loading';scenes[key]=list(calls);layouts[key]={'width':w,'height':h}
    checks.append({'width':w,'height':h,'dpr':dpr,'capsuleBottom':cap,'status':'PASS'})
(STAGE/'tall-traces.json').write_text(json.dumps({'files':base['files'],'scenes':scenes,'layouts':layouts},ensure_ascii=False),encoding='utf-8')
(STAGE/'tall-validation.json').write_text(json.dumps(checks,indent=2),encoding='utf-8')
print(f'PASS: {len(checks)} real Main resize/input scenarios, {len(scenes)} UI traces; full background coverage and hit mapping')
