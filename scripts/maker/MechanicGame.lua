-- Integrates production mechanisms into the established wallet, tools and UI flow.
local M=require('Mechanics')
return function(G,Data)
 local build,start,scan,duckPath,occupancy,activate,settle,clear,update,target,unavailable,deadlock=G.build,G.start,G.scan,G.duckPath,G.occupancy,G.activate,G.settleDucks,G.checkClear,G.update,G.target,G.unavailable,G.updateDeadlock
 function G.build(index) local l=Data.levels.levels[index];if l.imported_v22 then local b=M.fromConfig(l);M.validate(b);return b.toys end return build(index) end
 function G:start(index) self.flights={};self.busyUntil=0;self.entities={};self.board=nil;start(self,index) end
 function G.scan(t,toys) local b=M.boards[toys];if b then local p=M.scan(b,t);return p.emptySteps,p.exitsBoard,M.find(b,p.blockerId) end return scan(t,toys) end
 function G.duckPath(t,toys) local b=M.boards[toys];if b then return M.duckPath(b,t) end return duckPath(t,toys) end
 function G.occupancy(toys,except)
  local b=M.boards[toys];if not b then return occupancy(toys,except) end
  local r={} for _,t in ipairs(b.toys) do if t.state=='IDLE' and t.id~=except then for _,c in ipairs(t.cells) do r[c.y*12+c.x]=t end end end
  for _,t in ipairs(b.entities) do if t.state=='IDLE' then for _,c in ipairs(t.cells) do r[c.y*12+c.x]=t end end end return r
 end
 local function flight(g,t,steps,exits)
  if #steps<2 then return end
  if exits then local last=steps[#steps];local d=M.DIR[last.direction] or {0,-1};for i=1,3 do local cells={} for _,c in ipairs(last.cells) do cells[#cells+1]={x=c.x+d[1]*i,y=c.y+d[2]*i} end steps[#steps+1]={cells=cells,direction=last.direction} end end
  local duration=math.max(300,math.min(1800,#steps*80));g.flights[#g.flights+1]={toy=M.copy(t),steps=steps,start=g.time,duration=duration,exits=exits};g.busyUntil=math.max(g.busyUntil or 0,g.time+duration)
 end
 function G:mechanicEvents(events)
  self.events=events
  for _,e in ipairs(events) do
   if e.type=='MANUAL_EXIT' or e.type=='ON_AUTO_EXIT' or e.type=='ON_SPRING_EXIT' then self:comboExit() end
   if e.type=='ON_PUSH' then local t=M.find(self.board,e.target);local initial=M.copy(t);M.position(initial,e.from)
    local steps={{cells=e.from,direction=e.fromDirection}};for _,step in ipairs(e.travel) do steps[#steps+1]=step end;flight(self,initial,steps,e.exitsBoard)
   elseif e.type=='ON_AUTO_EXIT' or e.type=='ON_DUCK_TRANSFER' then
    if e.type=='ON_AUTO_EXIT' then self.exiting[#self.exiting+1]={toy=e.toy,path=e.path,elapsed=0,duration=math.max(500,(#e.path-1)*90),kind='auto'}
    else local steps={} for i,c in ipairs(e.path) do local nextCell=e.path[i+1] or c;local dx,dy=nextCell.x-c.x,nextCell.y-c.y;local direction=math.abs(dx)>math.abs(dy) and (dx>0 and 'RIGHT' or 'LEFT') or (dy>0 and 'DOWN' or 'UP');steps[#steps+1]={cells={{x=c.x,y=c.y}},direction=direction,teleport=c.portal~=nil} end;flight(self,e.toy,steps,false) end
   end
  end
 end
 function G:settleDucks()
  self.board=M.boards[self.toys];if not self.board then return settle(self) end
  self.entities=self.board.entities;local seeds={}
  for _,t in ipairs(self.toys) do if t.state=='EXITING' and not t.exitCounted then seeds[#seeds+1]={type='ON_EXIT',source=t.id} end end
  self:mechanicEvents(M.settle(self.board,seeds));self:checkClear()
 end
 function G:activate(t)
  if not M.boards[self.toys] then return activate(self,t) end
  if not t or self.pause or self.modal or self.mode~='play' or self.clearAt or self.time<(self.busyUntil or 0) or #self.exiting>0 then return end
  if self.tool then self:target(t);return end
  if not M.manual(t) then return end
  self.moves=self.moves+1;local result=M.click(self.board,t);local p=result.scan
  if p.emptySteps>0 or p.exitsBoard then local steps={{cells=result.initial.cells,direction=result.initial.direction}};for _,step in ipairs(p.travel) do steps[#steps+1]=step end;flight(self,result.initial,steps,p.exitsBoard) end
  if p.blockerId then self:impact(t,M.find(self.board,p.blockerId),M.DIR[t.direction]) else self.sound('click') end
  self:mechanicEvents(result.events);self:checkClear()
 end
 function G:checkClear()
  if not M.boards[self.toys] then return clear(self) end
  if self.clearAt then return end
  for _,t in ipairs(self.toys) do if t.state=='IDLE' then return end end
  for _,e in ipairs(self.entities) do if e.countsTowardClear and e.state=='IDLE' then return end end
  local delay=math.max(650,(self.busyUntil or 0)-self.time+100);for _,a in ipairs(self.exiting) do delay=math.max(delay,a.duration-a.elapsed+100) end;self.clearAt=self.time+delay
 end
 function G:update(dt)
  update(self,dt)
  for i=#(self.flights or {}),1,-1 do if self.time>=self.flights[i].start+self.flights[i].duration then table.remove(self.flights,i) end end
 end
 function G:target(t)
  if self.board and (self.time<(self.busyUntil or 0) or (self.tool=='flip' and not M.enabled(t))) then return end
  local flip=self.tool=='flip';target(self,t);if self.board and flip then self:settleDucks() end
 end
 function G:unavailable(id)
  if self.board then
   if self.uses[id]>=3 then return '本关使用次数已达上限' end
   local count=0 for _,t in ipairs(self.toys) do if t.state=='IDLE' and (id=='remove' or (M.enabled(t) and t.archetypeId~='AUTO_EXIT')) then count=count+1 end end
   if count==0 then return '当前没有可使用的目标' end
  end return unavailable(self,id)
 end
 function G:updateDeadlock()
  if not self.board then return deadlock(self) end
  if self.mode~='play' or self.pause or self.modal or self.tool or self.clearAt or self.time<(self.busyUntil or 0) or #self.exiting>0 then self.deadlocked=false;return end
  local blocked=true;local any=false
  for _,t in ipairs(self.toys) do if t.state=='IDLE' then any=true;if M.manual(t) then local p=M.scan(self.board,t);local b=M.find(self.board,p.blockerId)
   if p.emptySteps>0 or p.exitsBoard or (b and (b.kind=='BOX' or b.kind=='SPRING' or (b.ice or 0)>0)) then blocked=false;break end
  end end end
  blocked=blocked and any;if blocked and not self.deadlocked then self.deadlockSince=self.time end;self.deadlocked=blocked
 end
 function G.validateLevels()
  local count=0 for index,l in ipairs(Data.levels.levels) do local toys=G.build(index);count=count+#toys;local b=M.boards[toys]
   if b then M.validate(b);for _,t in ipairs(toys) do if t.archetypeId=='AUTO_EXIT' then assert(not M.duckPath(b,t),'Initial duck path '..t.id) end end
   else assert(#toys==#l.toy_list,'Toy count changed') end
  end print('TOYHOUSE validation PASS levels='..#Data.levels.levels..' toys='..count)
 end
end
