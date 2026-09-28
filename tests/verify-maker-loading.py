"""Exercise real Lua loader callbacks in adversarial order, independent of network speed."""
import pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'output/maker-port/test-deps'))
from lupa.lua54 import LuaRuntime
lua=LuaRuntime(unpack_returned_tuples=True)
loader=(ROOT/'scripts/maker/Loading.lua').read_text('utf-8')
lua.globals().package.preload['Loading']=lua.eval('function(s) return assert(load(s)) end')(loader)
lua.execute('''
local L=require('Loading');local now=0;local queue={};local imageFailure=false
local view={files=function(group) return {group..'.png'} end,loadImages=function() if imageFailure then error('decode') end end}
local cache={DownloadResources=function(_,files,done,progress) queue[#queue+1]={files=files,done=done,progress=progress} end}
local l=L.new(view,cache,function() return now end);local entered=0
l:loadDecorations();imageFailure=true;queue[1].done(false);imageFailure=false
l:request('home',function() entered=entered+1 end,true)
queue[2].progress(2,5);assert(l.pending.progress==.4)
assert(not l:cancel());now=.1;queue[2].done(true)
now=.3;l:update();assert(entered==0);now=.66;l:update();assert(entered==1 and not l.pending)
local play,settings=0,0
l:request('play',function() play=play+1 end);local old=queue[#queue]
assert(l:cancel());l:request('settings',function() settings=settings+1 end);local active=queue[#queue]
old.done(true);now=1;l:update();assert(play==0 and settings==0 and l.pending.group=='settings')
active.done(false);assert(l.pending.error);l:retry();local retry=queue[#queue]
imageFailure=true;retry.done(true);assert(l.pending.error);imageFailure=false;l:retry()
now=2;queue[#queue].done(true);now=2.1;l:update();assert(settings==0)
now=2.2;l:update();assert(settings==1 and play==0)
l:request('play',function() play=play+1 end);assert(play==1 and not l.pending)
l:request('complete',function() error('cancelled completion must not run') end);local complete=queue[#queue]
assert(l:cancel());complete.done(true);now=3;l:update();assert(not l.pending)
print('PASS: real progress, initial/min/full delay, optional-art failure, stale completion, cancel/reentry, download/decode retry, cached entry')
''')
