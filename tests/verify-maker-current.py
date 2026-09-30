import json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
STAGE=ROOT/'output/maker-current-release'
sys.path.insert(0,str(ROOT/'output/maker-port/test-deps'))
from lupa.lua54 import LuaRuntime
lua=LuaRuntime(unpack_returned_tuples=True)
MAKER=pathlib.Path('D:/AI游戏/晚安，玩具屋-Maker')
for file in (STAGE/'scripts').glob('*.lua'):
    lua.globals().package.preload[file.stem]=lua.eval('function(s,n) return assert(load(s,n)) end')(file.read_text('utf-8-sig'),file.stem)
def table(v):
    if isinstance(v,list):return lua.table_from([table(x) for x in v])
    if isinstance(v,dict):return lua.table_from({k:table(x) for k,x in v.items() if x is not None})
    return v
def convert(v):
    if hasattr(v,'items'):
        keys=list(v.keys())
        if keys==list(range(1,len(keys)+1)):return [convert(v[i]) for i in keys]
        return {str(k):convert(x) for k,x in v.items()}
    return v
lua.execute('''M=require('Mechanics');G=require('Game');D=require('Data');G.validateLevels()
function normalized(b)
 local out={randomState=b.randomState,entities={}};local all={}
 for _,t in ipairs(b.toys) do all[#all+1]=t end for _,t in ipairs(b.entities) do all[#all+1]=t end
 for _,t in ipairs(all) do local c={} for _,v in ipairs(t.cells) do c[#c+1]={v.x,v.y} end
 out.entities[#out.entities+1]={id=t.id,state=t.state,x=t.x,y=t.y,direction=t.direction or 'NULL',cells=c,
 sleeping=t.sleeping or false,sleepRemaining=t.sleepRemaining or 0,hugLocked=t.hugLocked or false,pairId=t.pairId or 'NULL',ice=t.ice or 0,hp=t.hp or 'NULL',exitCounted=t.exitCounted or false}
 end return out
end
''')
def normalize_expected(v):
    if isinstance(v,list):return [normalize_expected(x) for x in v]
    if isinstance(v,dict):return {k:normalize_expected(x) for k,x in v.items()}
    return 'NULL' if v is None else v
steps=0
for case in json.loads((STAGE/'parity.json').read_text('utf-8')):
    b=lua.globals().M.fromConfig(table(case['config']))
    g=lua.globals().G.new();g.start(g,case['config']['level_no'])
    assert convert(lua.globals().normalized(b))==normalize_expected(case['initial']),case['config']['level_id']
    for step in case['steps']:
        lua.globals().M.click(b,lua.globals().M.find(b,step['id']))
        actual=convert(lua.globals().normalized(b));expected=normalize_expected(step['expected'])
        if actual!=expected:
            for a,e in zip(actual['entities'],expected['entities']):
                if a!=e:print('DIFF',case['config']['level_id'],step['id'],a,e);break
            assert actual==expected,(case['config']['level_id'],step['id'],actual['randomState'],expected['randomState'])
        lua.globals().M.validate(b);steps+=1
        g.activate(g,lua.globals().M.find(g.board,step['id']))
        assert convert(lua.globals().normalized(g.board))==expected,('Game integration',case['config']['level_id'],step['id'])
        g.update(g,3)
lua.execute('''
assert(#D.levels.levels==200)
for i=1,200 do local g=G.new();g:start(i);local l=D.levels.levels[i]
 assert(#g.toys==#l.toy_list);assert(g.combo==0 and #g.exiting==0,'Initial exit '..i)
 for _,t in ipairs(g.toys) do assert(t.state=='IDLE');if t.archetypeId=='AUTO_EXIT' then assert(not G.duckPath(t,g.toys)) end end
 g:update(3);assert(g.combo==0 and #g.exiting==0,'Idle exit '..i)
end
''')
(STAGE/'rules-validation.json').write_text(json.dumps({'levels':200,'importedParity':197,'transitions':steps,'initialDuckBlockage':'PASS','idle3Seconds':'PASS'}),encoding='utf-8')
print('PASS: 200 Lua starts/idle; 197 configurations and',steps,'state transitions exactly match Web')
