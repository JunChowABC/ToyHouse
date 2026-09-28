-- Maker engine-docs/recipes/sdk.md: only result.success == true earns a reward.
---@class ToyhouseRewardedAds
---@field game table
---@field show fun(done: fun(result: table)): boolean
---@field pending table|nil
---@field stopped boolean
local A={}
---@return ToyhouseRewardedAds
function A.new(game,show)
    return setmetatable({game=game,show=show,pending=nil,stopped=false},{__index=A}) --[[@as ToyhouseRewardedAds]]
end
function A:watch()
    local g=self.game
    if self.stopped or self.pending or g.adPending or g.mode~='play' or not g.modal then return false end
    local id=g.modal
    if id~='remove' and id~='shuffle' and id~='flip' then return false end
    local request={done=false,age=0}
    self.pending=request;g.adPending=true;g.adMessage='广告加载中，请稍候…'
    local function finish(result)
        if request.done or self.stopped or self.pending~=request then return end
        request.done=true;self.pending=nil;g.adPending=false
        if type(result)=='table' and result.success==true then
            local count=g.profile.inventory[id]
            if count>=2147483647 then g.adMessage='道具库存已满';return end
            g.profile.inventory[id]=count+1
            g.save()
            g.adMessage='已获得 1 个道具'
        elseif type(result)=='table' and result.msg=='embed manual close' then
            g.adMessage='完整观看广告后才可获得道具'
        else
            g.adMessage='广告暂不可用，请稍后重试'
        end
    end
    request.finish=finish
    -- A false return can have already fired its callback synchronously.
    local ok,accepted=pcall(self.show,finish)
    if not ok or accepted~=true then finish({success=false}) end
    return true
end
function A:update(dt)
    local request=self.pending
    if not request then return end
    request.age=request.age+math.max(0,tonumber(dt) or 0)
    if request.age>=180 then request.finish({success=false}) end
end
function A:stop()
    self.stopped=true
    if self.pending then self.pending.done=true end
    self.pending=nil;self.game.adPending=false
end
return A
