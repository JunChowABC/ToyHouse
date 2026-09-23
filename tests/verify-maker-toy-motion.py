"""Compare real Lua poses to browser samples and exercise arrival timing."""
import json, pathlib, sys
root=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/'output/maker-port/test-deps'))
from lupa.lua54 import LuaRuntime
lua=LuaRuntime(unpack_returned_tuples=True)
maker=pathlib.Path(r'D:\AI游戏\晚安，玩具屋-Maker/scripts')
for name in ('Data','Game','View'):
    lua.globals().package.preload[name]=lua.eval('function(s,n) return assert(load(s,n)) end')((maker/f'{name}.lua').read_text(encoding='utf-8-sig'),name)
pose=lua.eval("require('View').toyPose")
samples=json.loads((root/'test-output/toy-motion/pose-samples.json').read_text())
for s in samples:
    actual=pose(lua.table_from(s['toy']),s['time'],s['exit'])
    for k,v in s['pose'].items():
        assert actual[k]==v if isinstance(v,str) else abs(actual[k]-v)<1e-10,(k,actual[k],v)
lua.execute('''
local G=require('Game');local g=G.new();local slid,blocked=false,false
for level=1,20 do
 g:start(level)
 for _,t in ipairs(g.toys) do
  if t.archetypeId~='AUTO_EXIT' then
   local steps,exit=G.scan(t,g.toys)
   if not exit and steps>0 and not slid then
    g:activate(t);assert(t.blockedAt<0,'early collision');assert(#g.moving>0)
    g:update(0.6);assert(t.blockedAt==g.time,'missing arrival collision');slid=true;break
   end
  end
 end
 g:start(level)
 for _,t in ipairs(g.toys) do
  local steps,exit=G.scan(t,g.toys)
  if t.archetypeId~='AUTO_EXIT' and not exit and steps==0 and not blocked then
   g:activate(t);assert(t.blockedAt==g.time);blocked=true;break
  end
 end
end
assert(slid and blocked)
g.pause=true;local time=g.time;g:update(1);assert(g.time==time)
g.pause=false;g:start(1)
for _,t in ipairs(g.toys) do local _,exit=G.scan(t,g.toys);if exit and t.archetypeId~='AUTO_EXIT' then g:activate(t);assert(#g.exiting>0);g:update(2);assert(#g.exiting==0);break end end
''')
print(f'PASS: {len(samples)} JS/Lua pose samples, slide/immediate impact timing, pause, exit completion')
