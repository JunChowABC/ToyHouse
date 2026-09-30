-- R7: 30-bit integer blocks remain exact in Lua, WebAssembly and cloud scores.
local Data = require('Data')
local Game = require('Game')
local C = {head = 'th2h', batchSize = 20, version = 'R7'}
local count = #Data.levels.levels
local scalar = {'sc','ir','is','if','rs','sm','sa','svb'}
local function integer(v, maximum)
    return type(v)=='number' and v==v and v>=0 and v%1==0 and v<=(maximum or 2147483647)
end
local function number(scores,key,default,maximum)
    local value=scores[key]
    if value==nil and default~=nil then return default end
    assert(integer(value,maximum),'invalid integer: '..key)
    return value
end
function C.slot(head)
    assert(head==nil or head==0 or head==1 or head==2,'unsupported save header')
    return head or 0
end
function C.keys(prefix)
    local keys={prefix..'v'}
    for _,key in ipairs(scalar) do keys[#keys+1]=prefix..key end
    for i=1,math.ceil(count/30) do keys[#keys+1]=prefix..'c'..i end
    for i=1,math.ceil(count/5) do keys[#keys+1]=prefix..'u'..i end
    return keys
end
function C.legacyKeys()
    local keys={'sv','lc'}
    for _,key in ipairs(scalar) do keys[#keys+1]=key end
    for i=1,count do keys[#keys+1]='u'..i end
    return keys
end
local function base(scores,prefix,legacy)
    local p=Game.newProfile()
    local function value(key,default,maximum)
        return number(scores,prefix..key,legacy and default or nil,maximum)
    end
    p.coins=value('sc',0);p.runSerial=value('rs',0)
    p.inventory={remove=value('ir',0),shuffle=value('is',0),flip=value('if',0)}
    p.settings={musicEnabled=value('sm',1,1)==1,audioEnabled=value('sa',1,1)==1,vibrationEnabled=value('svb',0,1)==1}
    return p
end
function C.decodeLegacy(scores)
    assert(type(scores)=='table','missing integer response')
    local version=number(scores,'sv',0)
    assert(version<=1,'unsupported legacy save version')
    local p=base(scores,'',true)
    local mask=number(scores,'lc',0,1073741823)
    for i,level in ipairs(Data.levels.levels) do
        if i<=30 and math.floor(mask/2^(i-1))%2==1 then p.completedLevels[level.level_id]=true end
        local packed=number(scores,'u'..i,0,4095)
        if packed>0 then p.levelUses[level.level_id]={remove=math.min(3,packed%16),shuffle=math.min(3,math.floor(packed/16)%16),flip=math.min(3,math.floor(packed/256)%16)} end
    end
    return p
end
function C.encode(p,prefix)
    assert(Game.validateProfile(p),'invalid profile')
    local s={[prefix..'v']=2,[prefix..'sc']=p.coins,[prefix..'rs']=p.runSerial,
        [prefix..'ir']=p.inventory.remove,[prefix..'is']=p.inventory.shuffle,[prefix..'if']=p.inventory.flip,
        [prefix..'sm']=p.settings.musicEnabled==false and 0 or 1,
        [prefix..'sa']=p.settings.audioEnabled==false and 0 or 1,[prefix..'svb']=p.settings.vibrationEnabled and 1 or 0}
    for i=1,math.ceil(count/30) do s[prefix..'c'..i]=0 end
    for i=1,math.ceil(count/5) do s[prefix..'u'..i]=0 end
    for i,level in ipairs(Data.levels.levels) do
        local c=prefix..'c'..math.ceil(i/30)
        if p.completedLevels[level.level_id] then s[c]=s[c]+2^((i-1)%30) end
        local uses=p.levelUses[level.level_id] or {};local packed=0
        for shift,key in ipairs({'remove','shuffle','flip'}) do
            local n=uses[key] or 0;assert(integer(n),'invalid tool usage')
            packed=packed+math.min(n,3)*4^(shift-1)
        end
        local u=prefix..'u'..math.ceil(i/5);s[u]=s[u]+packed*64^((i-1)%5)
    end
    for _,key in ipairs(C.keys(prefix)) do assert(integer(s[key]),'invalid score: '..key) end
    return s
end
function C.decode(scores,prefix)
    assert(number(scores,prefix..'v',nil)==2,'unsupported snapshot version')
    local p=base(scores,prefix,false)
    for _,key in ipairs(C.keys(prefix)) do number(scores,key,nil) end
    for i,level in ipairs(Data.levels.levels) do
        local mask=number(scores,prefix..'c'..math.ceil(i/30),nil,1073741823)
        if math.floor(mask/2^((i-1)%30))%2==1 then p.completedLevels[level.level_id]=true end
        local block=number(scores,prefix..'u'..math.ceil(i/5),nil,1073741823)
        local packed=math.floor(block/64^((i-1)%5))%64
        if packed>0 then p.levelUses[level.level_id]={remove=packed%4,shuffle=math.floor(packed/4)%4,flip=math.floor(packed/16)%4} end
    end
    return p
end
return C
