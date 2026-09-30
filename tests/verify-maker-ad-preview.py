"""Reproduce the actual UI.Init inspector branch reached by the engine FakeAd adapter."""
import pathlib, sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
MAKER=pathlib.Path('D:/AI游戏/晚安，玩具屋-Maker')
sys.path.insert(0,str(ROOT/'output/maker-port/test-deps'))
from lupa.lua54 import LuaRuntime
lua=LuaRuntime(unpack_returned_tuples=True)
ui=(MAKER/'urhox-libs/UI/Core/UI.lua').read_text('utf-8')
start=ui.index('    local defaultUseInspector =')
end=ui.index('\n    return UI',start)
branch=ui[start:end]
fake=(MAKER/'urhox-libs/FakeAd/init.lua').read_text('utf-8')
assert 'local UI = require("urhox-libs/UI/Core/UI")' in fake
assert 'UI.Init({ scale = function() return graphics:GetDPR() end })' in fake
source=(MAKER/'scripts/AdPreview.lua').read_text('utf-8')
assert source==(ROOT/'scripts/maker/AdPreview.lua').read_text('utf-8')
lua.globals().package.preload['AdPreview']=lua.eval('function(s) return assert(load(s)) end')(source)
lua.execute('''
errors={};initCount=0;loadCount=0;env='preview';LOG_ERROR=1;KEY_F9=120
GetTapMakerEnvString=function() return env end
log={Write=function(_,_,text) errors[#errors+1]=text end}
UI={};package.loaded['urhox-libs/UI/Core/UI']=UI
inspector={Init=function(ui) assert(ui==UI);initCount=initCount+1 end}
package.preload['urhox-libs/UI/Core/UIInspector']=function() loadCount=loadCount+1;return inspector end
''')
lua.execute('function initialize(options)\n'+branch+'\nend')
lua.execute('''
initialize({});assert(#errors==1 and errors[1]=='UI Inspector requested but failed to load')
errors={};local P=require('AdPreview');P.prepare();initialize({})
assert(#errors==0 and initCount==1 and UI.Inspector==inspector)
P.prepare();assert(loadCount==1)
local existing={Init=function() end};UI.Inspector=existing;P.prepare();assert(UI.Inspector==existing)
UI.Inspector=nil;env='production';P.prepare();assert(UI.Inspector==nil and loadCount==1)
GetTapMakerEnvString=nil;P.prepare();assert(UI.Inspector==nil)
GetTapMakerEnvString=function() return 'preview' end
package.loaded['urhox-libs/UI/Core/UIInspector']=nil
package.preload['urhox-libs/UI/Core/UIInspector']=function() error('real dependency failure') end
assert(not pcall(P.prepare));assert(UI.Inspector==nil)
print('PASS: original SDK branch reproduces error; repaired registration gives zero errors; cached/existing Inspector preserved; production untouched; dependency failures not hidden')
''')
# Compile the real inspector sources too; this does not substitute for engine execution.
files=list((MAKER/'urhox-libs/UI/Core/UIInspector').glob('*.lua'))
for file in files:
    target=MAKER/'scripts/compat/InspectorPanel.lua' if file.name=='Panel.lua' else file
    lua.eval('function(s,n) return assert(load(s,n)) end')(target.read_text('utf-8'),file.name)
original=(MAKER/'urhox-libs/UI/Core/UIInspector/Panel.lua').read_text('utf-8')
fixed=(MAKER/'scripts/compat/InspectorPanel.lua').read_text('utf-8')
for word in ('stretch','center','normal'):original=original.replace('“'+word+'”','"'+word+'"')
assert original==fixed, 'Compatibility module must contain only literal quote repairs'
print(f'PASS: {len(files)} real Inspector modules compile; remote engine playback still requires a signed-in preview')
