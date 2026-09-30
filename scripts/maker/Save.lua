-- R7: bounded integer batches, 200-level progress and two-slot commit.
-- Legacy R6 fields remain untouched. Failed reads never create a new save.
local Game = require('Game')
local C = require('SaveCodec')

---@class ToyhouseSave
---@field ready boolean
---@field busy boolean
---@field dirty boolean
---@field error string|nil
---@field profile table|nil
---@field age number
---@field generation integer
---@field mode string
---@field waitingIdentity boolean
---@field cloudUserId string|nil
---@field detail string|nil
---@field diagnosticCode string|nil
local S = {
    ready = false,
    busy = false,
    dirty = false,
    error = nil,
    profile = nil,
    age = 0,
    generation = 0,
    mode = 'loading',
    waitingIdentity = false,
    cloudUserId = nil,
    detail = nil,
    diagnosticCode = nil,
}

S.version = C.version
local IDENTITY_WAIT = 12
local REQUEST_DEADLINE = 25
local onLoaded = function(_) end

local function asUserId(v)
    if v == nil then return nil end
    if type(v) == 'number' then
        if v <= 0 or v ~= v or v == math.huge then return nil end
        return tostring(math.floor(v))
    end
    local s = tostring(v)
    if s:match('^%d+$') and s:find('[1-9]') then return s end
    return nil
end

local function identity()
    local ok, id = pcall(function()
        return clientCloud and clientCloud.userId
    end)
    if not ok then return nil end
    return asUserId(id)
end

local function safeCode(code)
    local text = tostring(code)
    if #text > 32 or not text:match('^[%w_%-]+$') then return 'unknown' end
    return text
end

local function diagnostic(stage, code, reason)
    S.detail = stage .. ' code=' .. tostring(code) .. ' reason=' .. tostring(reason)
    S.diagnosticCode = (S.ready and 'SAVE/' or 'LOAD/') .. safeCode(code)
    print('TOYHOUSE ' .. S.detail)
end

local function logMap()
    pcall(function()
        print('TOYHOUSE cloud_map=' .. tostring(clientCloud and clientCloud.mapName))
    end)
end

function S.startTemporary()
    if S.ready then return false end
    S.generation = S.generation + 1
    S.mode = 'temporary'
    S.cloudUserId = nil
    S.waitingIdentity = false
    S.busy = false
    S.dirty = false
    S.error = nil
    S.age = 0
    S.profile = Game.newProfile()
    S.ready = true
    print('TOYHOUSE temporary_session ready; cloud reads/writes disabled')
    onLoaded(S.profile)
    return true
end

local function acceptProfile(p, userId, created)
    S.generation = S.generation + 1
    S.profile = p
    S.ready = true
    S.busy = false
    S.error = nil
    S.mode = 'cloud'
    S.cloudUserId = userId
    if created then S.dirty = true end
    print('TOYHOUSE cloud_load ready created=' .. tostring(created) .. ' coins=' .. tostring(p.coins))
    onLoaded(p)
end

-- Each request consumes its callback once. A timeout/retry/account change
-- invalidates the entire operation; no partial read is accepted as a new save.
local function operation(stage)
    S.busy=true;S.age=0;S.error=nil;S.generation=S.generation+1
    local gen,userId=S.generation,S.cloudUserId
    local function failure(code,reason)
        if gen~=S.generation or not S.busy then return end
        S.generation=S.generation+1;S.busy=false
        S.error=S.ready and '保存进度失败，点击重试' or '读取进度失败，点击重试'
        if S.ready then S.dirty=true end
        diagnostic(stage,code,reason)
    end
    local function request(write,keys,scores,done)
        if gen~=S.generation or not S.busy then return end
        if identity()~=userId then failure('identity_changed','account changed');return end
        S.age=0
        local consumed=false
        local function take()
            if consumed or gen~=S.generation or not S.busy then return false end
            consumed=true
            if identity()~=userId then failure('identity_changed','account changed');return false end
            return true
        end
        local events={
            ok=function(_,values)
                if not take() then return end
                local ok,err=pcall(function()
                    if not write then assert(type(values)=='table','missing integer response') end
                    done(values)
                end)
                if not ok then failure('invalid_profile',err) end
            end,
            error=function(code,reason) if take() then failure(code,tostring(reason)..' keys='..#keys) end end,
            timeout=function() if take() then failure('timeout','request timed out') end end,
        }
        local ok,err=pcall(function()
            if write then
                local batch=clientCloud:BatchSet()
                for _,key in ipairs(keys) do batch:SetInt(key,scores[key]) end
                batch:Save('保存进度',events)
            else
                local batch=clientCloud:BatchGet()
                for _,key in ipairs(keys) do batch:Key(key) end
                batch:Fetch(events)
            end
        end)
        if not ok then failure('exception',err) end
    end
    local function chunks(write,keys,scores,done)
        local pos,merged=1,{}
        local nextChunk
        nextChunk=function()
            if pos>#keys then done(merged);return end
            local subset={}
            for i=pos,math.min(#keys,pos+C.batchSize-1) do subset[#subset+1]=keys[i] end
            pos=pos+#subset
            request(write,subset,scores,function(values)
                if not write then for _,key in ipairs(subset) do merged[key]=values[key] end end
                nextChunk()
            end)
        end
        nextChunk()
    end
    return request,chunks,failure
end

local function readCloud(userId)
    S.waitingIdentity=false;S.cloudUserId=userId;S.mode='loading'
    local request,chunks=operation('cloud_load_failed')
    logMap()
    print('TOYHOUSE cloud_load begin '..C.version..' batch='..C.batchSize)
    request(false,{C.head},nil,function(header)
        local slot=C.slot(header[C.head])
        if slot==0 then
            chunks(false,C.legacyKeys(),nil,function(scores)
                acceptProfile(C.decodeLegacy(scores),userId,true)
            end)
        else
            local prefix='th2'..slot..'_'
            chunks(false,C.keys(prefix),nil,function(scores)
                acceptProfile(C.decode(scores,prefix),userId,false)
            end)
        end
    end)
end

function S.load(done)
    if S.ready or S.busy then return end
    onLoaded = done or onLoaded
    S.error = nil
    S.detail = nil
    S.diagnosticCode = nil
    S.age = 0
    local userId = identity()
    if userId then
        readCloud(userId)
    else
        S.mode = 'waiting_identity'
        S.waitingIdentity = true
        S.busy = true
        print('TOYHOUSE waiting_for_host_identity')
    end
end

function S.mark()
    if S.mode == 'temporary' then return end
    S.dirty = true
end

function S.flush()
    if S.mode == 'temporary' then S.dirty = false; return end
    if not S.ready or S.busy or not S.dirty then return end
    if not S.cloudUserId or identity() ~= S.cloudUserId then
        S.error = '账号连接已变化，请恢复连接后重试'
        diagnostic('cloud_save_blocked', 'identity_changed', 'account unavailable or changed')
        return
    end
    if type(S.profile) ~= 'table' then
        S.error = '进度编码失败，请保留当前页面'
        diagnostic('cloud_save_failed', 'encode', 'profile missing')
        return
    end
    -- Re-read the commit pointer on every retry: a timed-out commit may have
    -- succeeded remotely. Always write the inactive slot, never the active one.
    local snapshot=Game.copy(S.profile)
    S.dirty=false
    local request,chunks=operation('cloud_save_failed')
    request(false,{C.head},nil,function(header)
        local active=C.slot(header[C.head])
        local target=active==1 and 2 or 1
        local prefix='th2'..target..'_'
        local scores=C.encode(snapshot,prefix)
        chunks(true,C.keys(prefix),scores,function()
            request(true,{C.head},{[C.head]=target},function()
                S.generation=S.generation+1;S.busy=false;S.error=nil
                S.detail=nil;S.diagnosticCode=nil
                print('TOYHOUSE cloud_save ok '..C.version..' slot='..target)
            end)
        end)
    end)
end

function S.update(dt)
    if S.waitingIdentity then
        S.age = S.age + dt
        local userId = identity()
        if userId then
            readCloud(userId)
        elseif S.age >= IDENTITY_WAIT then
            S.waitingIdentity = false
            S.busy = false
            S.error = '账号未就绪，点击重试'
            diagnostic('cloud_load_failed', 'no_identity', 'host user id unavailable')
        end
    elseif S.busy then
        S.age = S.age + dt
        if S.age > REQUEST_DEADLINE then
            S.generation = S.generation + 1
            S.busy = false
            S.error = S.ready and '保存进度超时，点击重试' or '读取进度超时，点击重试'
            if S.ready then S.dirty = true end
            diagnostic(S.ready and 'cloud_save_failed' or 'cloud_load_failed', 'timeout', 'request deadline reached')
        end
    elseif S.dirty and not S.error then
        S.flush()
    end
end

function S.blocked()
    return not S.ready or S.busy or S.dirty or S.error ~= nil
end

return S
