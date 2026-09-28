-- Presentation clock is independent of gameplay pause and ad rewards.
local M={key=nil,elapsed=0,closing=false,done=nil,transition=nil}
function M.sync(key)
    if key==M.key then return end
    M.key=key;M.elapsed=0;M.closing=false;M.done=nil
end
function M.busy() return M.transition~=nil or (M.key~=nil and (M.closing or M.elapsed<.3)) end
function M.close(done)
    if M.closing then return end
    if not M.key then done();return end
    M.elapsed=0;M.closing=true;M.done=done
end
function M.nextLevel(game)
    M.transition={elapsed=0,switched=false,next=game.levelIndex+1,game=game}
end
function M.update(dt)
    local frozen=M.closing or M.transition~=nil
    M.elapsed=M.elapsed+dt
    if M.closing and M.elapsed>=.18 then
        local done=M.done;M.key=nil;M.closing=false;M.done=nil
        if done then done() end
    end
    local t=M.transition
    if t then
        t.elapsed=t.elapsed+dt
        if not t.switched and t.elapsed>=.3 then t.switched=true;t.game:advance() end
        if t.elapsed>=.76 then M.transition=nil end
    end
    return frozen or M.transition~=nil
end
function M.pose()
    if not M.key then return 1,1 end
    local t=math.min(1,M.elapsed/(M.closing and .18 or .3))
    local alpha=M.closing and 1-t*t or 1-(1-t)^3
    local size=M.closing and 1-.16*t*t or .78+.22*(1+2.2*(t-1)^3+1.2*(t-1)^2)
    return alpha,size
end
return M
