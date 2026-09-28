-- Actual download progress, staged entry, retries and stale-request cancellation.
---@class ToyhouseLoadRequest
---@field group string
---@field action function
---@field initial boolean?
---@field progress number
---@field started number
---@field error boolean
---@field doneAt number?
local L={}
L.__index=L
function L.new(view,resources,clock)
    local self=setmetatable({},L)
    self:init(view,resources,clock)
    return self
end
function L:init(view,resources,clock)
    self.view=view;self.resources=resources;self.clock=clock
    self.ready={}
    ---@type ToyhouseLoadRequest?
    self.pending=nil
end
function L:loadDecorations()
    self.resources:DownloadResources(self.view.files('loading'),function()
        -- Decorative failures must never block a usable room.
        pcall(self.view.loadImages,'loading',true)
    end)
end
function L:request(group,action,initial)
    if self.ready[group] and not initial then action();return end
    ---@type ToyhouseLoadRequest
    local request={group=group,action=action,initial=initial,progress=0,started=self.clock(),error=false}
    self.pending=request
    local function completed(success)
        if not success then request.error=true;return end
        local ok=pcall(self.view.loadImages,group)
        if not ok then request.error=true;return end
        self.ready[group]=true;request.progress=1;request.doneAt=self.clock()
    end
    if self.ready[group] then completed(true);return end
    local files=self.view.files(group)
    if group=='play' then for _,name in ipairs({'click','hit','clear'}) do files[#files+1]='toyhouse/'..name..'.wav' end end
    self.resources:DownloadResources(files,completed,function(count,total)
        if not request.doneAt then request.progress=total>0 and math.min(.98,math.max(0,count/total)) or 0 end
    end)
end
function L:update()
    local r=self.pending
    if r and r.doneAt and self.clock()-r.doneAt>=.18 and (not r.initial or self.clock()-r.started>=.65) then
        self.pending=nil;r.action()
    end
end
function L:cancel()
    if self.pending and not self.pending.initial then self.pending=nil;return true end
    return false
end
function L:retry()
    local r=self.pending
    if r and r.error then self:request(r.group,r.action,r.initial) end
end
return L
