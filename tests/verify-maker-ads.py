"""Exercise actual Maker reward controller and game with adversarial SDK callbacks."""
import pathlib, sys, json
ROOT=pathlib.Path(__file__).resolve().parents[1]
MAKER=pathlib.Path('D:/AI游戏/晚安，玩具屋-Maker')
OUT=ROOT/'output/maker-ad-autouse'
STAGE=MAKER if '--installed' in sys.argv else OUT
sys.path.insert(0,str(ROOT/'output/maker-port/test-deps'))
from lupa.lua54 import LuaRuntime
lua=LuaRuntime(unpack_returned_tuples=True)
for name in ('Data','UiData','UiMotion','Save','Game','View','RewardedAds','AdPreview'):
    file=(STAGE if name in ('View','RewardedAds') else MAKER)/'scripts'/f'{name}.lua'
    lua.globals().package.preload[name]=lua.eval('function(s,n) return assert(load(s,n)) end')(file.read_text('utf-8-sig'),name)
lua.execute('''
local G=require('Game');local A=require('RewardedAds')
local saved;local saves=0
local function fixture(id,show)
    local g=G.new(nil,function() saves=saves+1 end)
    g:start(1);g.modal=id;g.profile.coins=100;g.uses[id]=0
    return g,A.new(g,show)
end
for _,id in ipairs({'remove','shuffle','flip'}) do
    local callback;local calls=0
    local g,a=fixture(id,function(done) calls=calls+1;callback=done;return true end)
    local before=saves
    assert(a:watch());assert(g.adPending);assert(not a:watch());assert(calls==1)
    g:confirmTool();assert(g.modal==id and g.profile.coins==100)
    assert(g.profile.inventory[id]==0)
    local dirs={};for _,t in ipairs(g.toys) do dirs[t.id]=t.direction end
    a:setFocused(false)
    callback({success=true});callback({success=true});callback({success=false})
    a:update(.1);assert(g.adPending and g.modal==id and g.uses[id]==0)
    a:setFocused(true);a:update(.1)
    assert(not g.adPending and g.modal==nil and g.profile.coins==100)
    if id=='shuffle' then
        local changed=0;for _,t in ipairs(g.toys) do if dirs[t.id]~=t.direction then changed=changed+1 end end
        assert(changed==5 and g.uses[id]==1 and g.profile.inventory[id]==0)
    else assert(g.tool==id and g.profile.inventory[id]==1 and g.uses[id]==0);g:cancelTool() end
    local stock=g.profile.inventory[id]
    g.modal=id;g.uses[id]=3;assert(not a:watch());assert(g.profile.inventory[id]==stock)
    g.uses[id]=0
    assert(a:watch());callback({success=false,msg='embed manual close'});assert(g.profile.inventory[id]==stock)
    assert(g.adMessage=='完整观看广告后才可获得道具')
    assert(a:watch());callback({success='true'});assert(g.profile.inventory[id]==stock)
    assert(a:watch());local late=callback;a:update(180);assert(not g.adPending)
    assert(a:watch());late({success=true});assert(g.profile.inventory[id]==stock and g.adPending)
    callback({success=false})
    assert(a:watch());a:stop();callback({success=true});assert(g.profile.inventory[id]==stock and not g.adPending)
end
for _,show in ipairs({
    function() return false end,
    function(done) done({success=false});return false end,
    function(done) done({success=false});done({success=true});return true end,
    function() error('SDK unavailable') end,
    function() return nil end,
}) do
    local g,a=fixture('remove',show);a:watch();assert(not g.adPending and g.profile.inventory.remove==0)
end
local g,a=fixture('remove',function(done) done({success=true});done({success=true});return true end)
a:watch();a:update(.1);assert(g.profile.inventory.remove==1 and not g.adPending and g.tool=='remove')
print('PASS: all tools; synchronous/asynchronous success; return false with/without callback; exception; duplicate; cancel; invalid success; caps; timeout; stale callback; stop; save mark')
''')
# Actual Save.lua integer serialization round-trip with a fake cloud transport.
lua.execute('''
local disk={sv=1,sc=100,ir=0,is=0,['if']=0};local writeCount=0;local fail=false
clientCloud={userId=123,mapName='test'}
function clientCloud:BatchGet()
    return {Key=function(self) return self end,Fetch=function(_,events) events.ok({},disk) end}
end
function clientCloud:BatchSet()
    local pending={}
    return {SetInt=function(_,key,value) pending[key]=value end,Save=function(_,_,events)
        writeCount=writeCount+1
        if fail then events.error('test','unavailable') else disk=pending;events.ok() end
    end}
end
local G=require('Game');local A=require('RewardedAds');local S=require('Save');local g
S.load(function(profile) g=G.new(profile,S.mark) end)
g:start(1);g.modal='remove';S.flush();local before=writeCount
local callback;local a=A.new(g,function(done) callback=done;return true end)
a:watch();callback({success=true});assert(S.dirty and S.blocked())
fail=true;S.flush();assert(S.error and S.dirty and g.profile.inventory.remove==1)
callback({success=true});assert(g.profile.inventory.remove==1)
fail=false;S.flush();assert(not S.blocked() and disk.ir==1 and disk.sc==100 and writeCount==before+2)
package.loaded.Save=nil;local restored=require('Save');local loaded
restored.load(function(profile) loaded=profile end)
assert(loaded.inventory.remove==1 and loaded.coins==100)
a:update(.1);g:cancelTool();g.modal='shuffle';local shuffle=A.new(g,function(done) done({success=true});return true end)
shuffle:watch();shuffle:update(.1);S.flush()
assert(g.uses.shuffle==1 and disk['is']==0)
package.loaded.Save=nil;require('Save').load(function(profile) loaded=profile end)
assert(loaded.inventory.shuffle==0 and loaded.levelUses.L001.shuffle==1 and loaded.coins==100)
print('PASS: real Save.lua reward serialization, failed-save retry, duplicate callback, auto-use and usage-count load round-trip')
''')
# Full main.lua input/focus integration: real controller, game and View.controls.
lua.execute('''
NVG_ALIGN_CENTER=1;NVG_ALIGN_MIDDLE=2;MOUSEB_LEFT=1;MM_ABSOLUTE=0
KEY_RETURN=13;KEY_SPACE=32;KEY_ESCAPE=27;KEY_P=80;KEY_1=49;KEY_2=50;KEY_3=51
graphics={GetDPR=function() return 1 end,GetWidth=function() return 540 end,GetHeight=function() return 960 end}
input={GetMousePosition=function() return {x=mx,y=my} end}
sdk={GetNativeExitMenuRect=function() return nil end,VibrateShort=function() end,
 ShowRewardVideoAd=function(_,done) sdkCallback=done;return true end}
function Scene() return {CreateChild=function() return {CreateComponent=function() return {Play=function() end} end} end} end
cache={GetResource=function() return nil end}
function SubscribeToEvent() end;function UnsubscribeFromAllEvents() end
function nvgCreate() return 1 end;function nvgCreateFont() return 1 end;function nvgDelete() end
local V=require('View');V.init=function() end;V.draw=function(g) activeGame=g end
V.loadImages=function() end
V.box=function() end;V.text=function() end
package.loaded.Save={ready=true,mark=function() end,update=function() end,blocked=function() return false end,
 load=function(done) done(require('Game').newProfile()) end}
package.loaded.Loading={new=function() return {ready={complete=true},loadDecorations=function() end,
 request=function(_,_,done) done() end,update=function() end} end}
for _,key in ipairs({'BeginFrame','EndFrame','Scale','Translate','Scissor'}) do _G['nvg'..key]=function() end end
''')
lua.execute((STAGE/'scripts/main.lua').read_text('utf-8'))
lua.execute('''
Start()
local function key(n) HandleKeyDown(nil,{GetInt=function() return n end}) end
key(KEY_RETURN);key(KEY_1);HandleRender();assert(activeGame.modal=='remove')
for i=1,4 do HandleUpdate(nil,{GetFloat=function() return .1 end}) end
local function clickAd()
    for _,c in ipairs(require('View').controls(activeGame)) do if c.id=='tool.ad' then
        mx=c.bounds[1]+c.bounds[3]/2;my=c.bounds[2]+c.bounds[4]/2
    end end
    local event={GetInt=function() return MOUSEB_LEFT end}
    HandleMouseDown(nil,event);HandleMouseUp(nil,event)
end
clickAd();assert(activeGame.adPending)
HandleFocus(nil,{GetBool=function() return false end});key(KEY_ESCAPE);key(KEY_2)
assert(activeGame.modal=='remove' and not activeGame.pause and #require('View').controls(activeGame)==0)
sdkCallback({success=true});assert(activeGame.profile.inventory.remove==1 and activeGame.adPending)
HandleUpdate(nil,{GetFloat=function() return .1 end});assert(activeGame.modal=='remove')
HandleFocus(nil,{GetBool=function() return true end})
for i=1,4 do HandleUpdate(nil,{GetFloat=function() return .1 end}) end
assert(not activeGame.adPending and activeGame.modal==nil and activeGame.tool=='remove')
local targets={};for _,t in ipairs(activeGame.toys) do if t.state=='IDLE' then targets[#targets+1]=t end end
local function choose(t)
    mx=60+(t.cells[1].x+.5)*35;my=199+(t.cells[1].y+.5)*35
    local e={GetInt=function() return MOUSEB_LEFT end};HandleMouseDown(nil,e);HandleMouseUp(nil,e)
end
choose(targets[1]);assert(#activeGame.selected==1)
for _,k in ipairs({KEY_ESCAPE,KEY_P,KEY_1,KEY_2,KEY_3}) do key(k) end
HandleFocus(nil,{GetBool=function() return false end});HandleFocus(nil,{GetBool=function() return true end})
assert(activeGame.tool=='remove' and #activeGame.selected==1 and not activeGame.pause and activeGame.modal==nil)
assert(#require('View').controls(activeGame)==0)
choose(targets[2]);assert(activeGame.tool==nil and activeGame.uses.remove==1 and activeGame.profile.inventory.remove==0)
for i=1,8 do HandleUpdate(nil,{GetFloat=function() return .1 end}) end
key(KEY_2);HandleRender()
for i=1,4 do HandleUpdate(nil,{GetFloat=function() return .1 end}) end
local dirs={};for _,t in ipairs(activeGame.toys) do dirs[t.id]=t.direction end
clickAd();sdkCallback({success=true})
for i=1,4 do HandleUpdate(nil,{GetFloat=function() return .1 end}) end
local changed=0;for _,t in ipairs(activeGame.toys) do if dirs[t.id]~=t.direction then changed=changed+1 end end
assert(changed==5 and activeGame.uses.shuffle==1 and activeGame.profile.inventory.shuffle==0)
sdkCallback({success=true});assert(activeGame.uses.shuffle==1)
key(KEY_1);HandleRender()
for i=1,4 do HandleUpdate(nil,{GetFloat=function() return .1 end}) end
clickAd();Stop();sdkCallback({success=true});assert(activeGame.profile.inventory.remove==0)
print('PASS: main.lua click -> SDK -> reward; focus loss, Escape, tool hotkeys locked during ad; Stop ignores late callback')
local M=require('UiMotion');local changes=0;M.sync(nil)
M.sync('tool.remove');assert(M.busy());M.update(.3);assert(not M.busy())
M.close(function() changes=changes+1 end);M.close(function() changes=changes+100 end)
M.update(.17);assert(changes==0);M.update(.02);assert(changes==1 and not M.busy())
M.update(1);assert(changes==1)
local G=require('Game');local g=G.new();g:start(1);g.mode='level-complete'
local coins=g.profile.coins
M.nextLevel(g);assert(M.busy());M.update(.29);assert(g.levelIndex==1)
M.update(.02);assert(g.levelIndex==2 and g.profile.coins==coins)
M.update(.46);assert(not M.busy() and g.levelIndex==2)
g.levelIndex=20;g.mode='level-complete';M.nextLevel(g);M.update(.31)
assert(g.mode=='finale');M.update(.46);assert(not M.busy())
print('PASS: Maker modal input lock, one-shot delayed close, next-level cover timing, no duplicate rewards and final level')
''')
(OUT/'ad-test-report.json').write_text(json.dumps({'status':'PASS','installed':STAGE==MAKER,'scope':'Lua callback and real main input/focus integration; no real-device ad playback'},indent=2),encoding='utf-8')
