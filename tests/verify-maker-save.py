"""Real Lua save state machine with a bounded, asynchronous cloud transport."""
from pathlib import Path
import sys
ROOT=Path(__file__).resolve().parents[1]
MAKER=Path('D:/AI游戏/晚安，玩具屋-Maker')
sys.path.insert(0,str(ROOT/'output/maker-port/test-deps'))
from lupa.lua54 import LuaRuntime
lua=LuaRuntime(unpack_returned_tuples=True)
for name in ('Levels','Data','Mechanics','MechanicGame','Game','SaveCodec','Save'):
    path=(MAKER/'scripts' if '--installed' in sys.argv or name not in ('Save','SaveCodec') else ROOT/'scripts/maker')/f'{name}.lua'
    lua.globals().package.preload[name]=lua.eval('function(s,n) return assert(load(s,n)) end')(path.read_text('utf-8-sig'),name)
lua.execute(r'''
local G=require('Game');local C=require('SaveCodec');local results=0
local disk,queue,reads,writes,maxKeys,loaded,failWrite,failRead,duplicate
local function reset(data)
    disk=G.copy(data or {});queue={};reads=0;writes=0;maxKeys=0;loaded=0;failWrite=nil;failRead=nil;duplicate=false
    clientCloud={userId='123',mapName='isolated-test'}
    function clientCloud:BatchGet()
        local keys={};return {Key=function(_,k) keys[#keys+1]=k end,Fetch=function(_,cb)
            assert(#keys<=20,'read batch too large');maxKeys=math.max(maxKeys,#keys);reads=reads+1
            queue[#queue+1]=function()
                if reads==failRead then cb.error(4,'simulated read rejection');return end
                local values={};for _,k in ipairs(keys) do values[k]=disk[k] end
                cb.ok({},values);if duplicate then cb.ok({},values);cb.error(500,'late') end
            end
        end}
    end
    function clientCloud:BatchSet()
        local values={};local n=0
        return {SetInt=function(_,k,v) values[k]=v;n=n+1 end,Save=function(_,_,cb)
            assert(n<=20,'write batch too large');maxKeys=math.max(maxKeys,n);writes=writes+1
            queue[#queue+1]=function()
                if writes==failWrite then cb.error(503,'simulated write failure');return end
                for k,v in pairs(values) do disk[k]=v end
                cb.ok();if duplicate then cb.ok();cb.error(500,'late') end
            end
        end}
    end
end
local function step() local fn=table.remove(queue,1);assert(fn,'missing request');fn() end
local function drain() local limit=0;while #queue>0 do limit=limit+1;assert(limit<100);step() end end
local function load()
    package.loaded.Save=nil;local S=require('Save');S.load(function() loaded=loaded+1 end);drain();return S
end
local function check(name,fn) fn();results=results+1;print('PASS '..name) end
check('R6 migration retains wallet, settings, sparse progress and tool caps',function()
    reset({sv=1,sc=210,ir=2,is=3,['if']=1,lc=2^29+127,rs=8,sm=0,sa=1,svb=1,u1=801,u200=546})
    local S=load();assert(S.ready and S.profile.coins==210 and S.profile.completedLevels.L030 and not S.profile.completedLevels.L008)
    assert(S.profile.levelUses.L001.remove==1 and S.profile.levelUses.L001.shuffle==2 and S.profile.levelUses.L001.flip==3)
    assert(S.profile.levelUses.L200.flip==2 and not S.profile.settings.musicEnabled and S.profile.settings.vibrationEnabled)
    S.flush();drain();assert(not S.blocked() and disk.th2h==1 and disk.sc==210 and disk.lc==2^29+127)
end)
check('all 200 completion bits and usage counts round-trip',function()
    reset();local S=load()
    for i=1,200 do local id=string.format('L%03d',i);S.profile.completedLevels[id]=true;S.profile.levelUses[id]={remove=i%4,shuffle=(i+1)%4,flip=(i+2)%4} end
    S.profile.coins=6000;S.mark();S.flush();drain();local T=load()
    for i=1,200 do local id=string.format('L%03d',i);assert(T.profile.completedLevels[id]);local u=T.profile.levelUses[id];assert(u.remove==i%4 and u.shuffle==(i+1)%4 and u.flip==(i+2)%4) end
    assert(T.profile.coins==6000 and not T.dirty and maxKeys==20)
end)
check('failed reads never create or overwrite a profile; retry succeeds',function()
    reset({sv=1,sc=210});failRead=3;local S=load();assert(not S.ready and S.error and writes==0)
    failRead=nil;S.load();drain();assert(S.ready and S.profile.coins==210 and writes==0)
end)
check('each snapshot write failure retains committed profile on restart',function()
    reset();local S=load();S.profile.coins=100;S.flush();drain();local baseline=G.copy(disk)
    for failure=1,4 do
        reset(baseline);S=load();S.profile.coins=200;S.profile.completedLevels.L200=true;S.mark();failWrite=failure;S.flush();drain()
        assert(S.error and S.dirty and disk.th2h==1)
        local T=load();assert(T.profile.coins==100 and not T.profile.completedLevels.L200)
        failWrite=nil;S.flush();drain();T=load();assert(T.profile.coins==200 and T.profile.completedLevels.L200)
    end
end)
check('commit succeeds remotely but callback times out; retry uses other slot',function()
    reset();local S=load();S.profile.coins=100;S.flush();drain()
    S.profile.coins=200;S.mark();S.flush();step();step();step();step()
    local commit=table.remove(queue,1);assert(commit);S.update(26);commit()
    assert(S.error and disk.th2h==2)
    S.profile.coins=300;S.flush();step();assert(#queue==1);step()
    assert(disk.th2h==2 and C.decode(disk,'th22_').coins==200)
    drain();assert(disk.th2h==1 and load().profile.coins==300)
end)
check('duplicate and late callbacks cannot advance operation twice',function()
    reset();duplicate=true;local S=load();assert(loaded==1);S.flush();drain();assert(not S.blocked() and writes==4)
end)
check('malformed and incomplete snapshots fail closed',function()
    for _,bad in ipairs({{th2h=1},{th2h=3},{sv=9},{sc='bad'}}) do reset(bad);local S=load();assert(not S.ready and S.error and writes==0) end
end)
check('account switch during read and before write cannot cross-save',function()
    reset({sv=1,sc=210});package.loaded.Save=nil;local S=require('Save');S.load();clientCloud.userId='456';drain();assert(not S.ready and S.error and writes==0)
    reset();S=load();S.profile.coins=30;S.mark();clientCloud.userId='456';S.flush();assert(S.error and writes==0)
end)
check('temporary opt-in and timed-out reads ignore stale responses',function()
    reset();package.loaded.Save=nil;local S=require('Save');S.load();assert(S.startTemporary());drain();S.mark();S.flush();assert(S.mode=='temporary' and writes==0)
    reset();package.loaded.Save=nil;S=require('Save');S.load(function() loaded=loaded+1 end);local stale=table.remove(queue,1);S.update(26);S.load();stale();drain();assert(S.ready and loaded==1)
end)
check('changes during write remain dirty and persist in following snapshot',function()
    reset();local S=load();S.profile.coins=30;S.flush();S.profile.coins=60;S.mark();drain();assert(S.dirty)
    S.flush();drain();assert(not S.blocked() and load().profile.coins==60)
end)
check('missing identity makes no requests and can recover',function()
    reset();clientCloud.userId=nil;package.loaded.Save=nil;local S=require('Save');S.load();S.update(13);assert(S.error and reads==0 and writes==0)
    clientCloud.userId='123';S.load();drain();assert(S.ready)
end)
print('Save regression PASS '..results..' scenarios; actual 200-level configuration; no remote writes')
''')
