-- Shared gameplay semantics for imported V2.2 boards. No developer controls.
local M={boards=setmetatable({},{__mode='k'})}
local DIR={LEFT={-1,0},RIGHT={1,0},UP={0,-1},DOWN={0,1}}
local ORDER={'LEFT','RIGHT','UP','DOWN'}
local CONFIG={L='LEFT',R='RIGHT',U='UP',D='DOWN'}
local function copy(v) if type(v)~='table' then return v end local r={} for k,x in pairs(v) do r[k]=copy(x) end return r end
local function key(c) return c.x..','..c.y end
local function active(t) return t.state=='IDLE' end
local function inside(b,c) return c.x>=0 and c.y>=0 and c.x<b.cols and c.y<b.rows end
local function all(b) local r={} for _,t in ipairs(b.toys) do r[#r+1]=t end for _,t in ipairs(b.entities) do r[#r+1]=t end return r end
local function find(b,id) for _,t in ipairs(all(b)) do if t.id==id then return t end end end
function M.enabled(t) return active(t) and not t.sleeping and not t.hugLocked and (t.ice or 0)==0 end
function M.manual(t) return M.enabled(t) and t.archetypeId~='AUTO_EXIT' and t.kind~='SPRING' end
function M.position(t,cells) t.cells=copy(cells);t.x=math.huge;t.y=math.huge;for _,c in ipairs(cells) do t.x=math.min(t.x,c.x);t.y=math.min(t.y,c.y) end end
function M.occupied(b,except) local r={} for _,t in ipairs(all(b)) do if active(t) and t.id~=except and t.kind~='PORTAL' then for _,c in ipairs(t.cells) do r[key(c)]=t end end end return r end
local function portalAt(b,c) for _,p in ipairs(b.entities) do if active(p) and p.kind=='PORTAL' then for _,v in ipairs(p.cells) do if key(v)==key(c) then return p end end end end end
local function partner(b,p) for _,v in ipairs(b.entities) do if active(v) and v.kind=='PORTAL' and v.id~=p.id and v.pairId==p.pairId then return v end end end
function M.portalExits(b,p,length,id)
 local occ=M.occupied(b,id);local r={}
 for _,direction in ipairs(ORDER) do local d=DIR[direction] for lane=0,1 do
  local x=direction=='LEFT' and p.x-1 or direction=='RIGHT' and p.x+2 or p.x+lane
  local y=direction=='UP' and p.y-1 or direction=='DOWN' and p.y+2 or p.y+lane
  local cells={};local valid=true
  for i=0,length-1 do local c={x=x+d[1]*i,y=y+d[2]*i};cells[#cells+1]=c;if not inside(b,c) or occ[key(c)] or portalAt(b,c) then valid=false end end
  if valid then r[#r+1]={direction=direction,cells=cells,lane=lane} end
 end end return r
end
local function pick(options,state)
 local nextState=(state*1664525+1013904223)&0xffffffff
 local sample=nextState~(nextState>>16);sample=(sample*0x7feb352d)&0xffffffff;sample=sample~(sample>>15);sample=(sample*0x846ca68b)&0xffffffff;sample=sample~(sample>>16)
 return options[math.floor((sample&0xffffffff)/4294967296*#options)+1],nextState
end
local function pickExit(options,state)
 local sides,seen={},{} for _,e in ipairs(options) do if not seen[e.direction] then sides[#sides+1]={direction=e.direction};seen[e.direction]=true end end
 local side,rng=pick(sides,state);local lanes={} for _,e in ipairs(options) do if e.direction==side.direction then lanes[#lanes+1]=e end end
 return pick(lanes,rng)
end
function M.scan(b,t)
 local r={emptySteps=0,exitsBoard=false,cells=copy(t.cells),direction=t.direction,travel={},portals={},randomState=b.randomState}
 if not M.enabled(t) then return r end
 if t.archetypeId=='AUTO_EXIT' then r.exitsBoard=M.duckPath(b,t)~=nil;return r end
 local occ=M.occupied(b,t.id);local seen={};local cells=copy(t.cells);local direction=t.direction;local rng=b.randomState
 while true do
  local d=assert(DIR[direction],'Missing moving direction');local head=cells[1]
  for _,c in ipairs(cells) do if c.x*d[1]+c.y*d[2]>head.x*d[1]+head.y*d[2] then head=c end end
  local n={x=head.x+d[1],y=head.y+d[2]};r.cells=cells;r.direction=direction;r.randomState=rng
  if not inside(b,n) then r.exitsBoard=true;return r end
  local marker=key(cells[1])..':'..direction;if seen[marker] then r.loop=true;return r end;seen[marker]=true
  if occ[key(n)] then r.blockerId=occ[key(n)].id;return r end
  local portal=portalAt(b,n)
  if portal then
   local dest=partner(b,portal);local options=dest and M.portalExits(b,dest,#cells,t.id) or {}
   if #options==0 then r.blockerId=portal.id;return r end
   local selected;selected,rng=pickExit(options,rng);cells=copy(selected.cells);direction=selected.direction
   r.portals[#r.portals+1]={from=portal.id,to=dest.id,direction=direction,lane=selected.lane}
   r.travel[#r.travel+1]={cells=copy(cells),direction=direction,teleport=true}
  else
   for _,c in ipairs(cells) do c.x=c.x+d[1];c.y=c.y+d[2] end
   r.travel[#r.travel+1]={cells=copy(cells),direction=direction}
  end
  r.emptySteps=r.emptySteps+1
 end
end
function M.duckPath(b,t)
 local occ=M.occupied(b,t.id);local q={{x=t.x,y=t.y,parent=0}};local seen={[key(t)]=true};local i=1
 while i<=#q do local c=q[i]
  if c.x==0 or c.y==0 or c.x==b.cols-1 or c.y==b.rows-1 then
   local path={};local n=i while n>0 do table.insert(path,1,{x=q[n].x,y=q[n].y,portal=q[n].portal});n=q[n].parent end
   local d=c.x==0 and {-1,0} or c.x==b.cols-1 and {1,0} or c.y==0 and {0,-1} or {0,1};path[#path+1]={x=c.x+d[1],y=c.y+d[2]};return path
  end
  for _,direction in ipairs(ORDER) do local d=DIR[direction];local n={x=c.x+d[1],y=c.y+d[2],parent=i}
   if inside(b,n) and not occ[key(n)] and not seen[key(n)] then
    local p=portalAt(b,n)
    if p then local dest=partner(b,p)
     if dest then for _,exit in ipairs(M.portalExits(b,dest,1,t.id)) do local v=copy(exit.cells[1]);if not seen[key(v)] then seen[key(v)]=true;v.parent=i;v.portal={from=p.id,to=dest.id};q[#q+1]=v end end end
    else seen[key(n)]=true;q[#q+1]=n end
   end
  end i=i+1
 end
end
local function duckRoute(b,t)
 local current=copy(t);local rng=b.randomState;local path={{x=t.x,y=t.y}};local portals={};local visited={}
 while true do local route=M.duckPath(b,current)
  if not route then if #portals>0 then return {path=path,portals=portals,randomState=rng,exitsBoard=false} end return end
  local index for i,c in ipairs(route) do if c.portal then index=i;break end end
  if not index then for i=2,#route do path[#path+1]=route[i] end return {path=path,portals=portals,randomState=rng,exitsBoard=true} end
  local p=route[index].portal
  if visited[p.from] then if #portals>0 then return {path=path,portals=portals,randomState=rng,exitsBoard=false} end return end
  visited[p.from]=true;local selected;selected,rng=pickExit(M.portalExits(b,find(b,p.to),1,t.id),rng)
  for i=2,index-1 do path[#path+1]=route[i] end
  local cell=copy(selected.cells[1]);cell.portal=p;path[#path+1]=cell
  portals[#portals+1]={from=p.from,to=p.to,direction=selected.direction,lane=selected.lane};M.position(current,selected.cells)
 end
end
function M.fromConfig(l)
 local b={cols=l.board_width,rows=l.board_height,toys={},entities={},randomState=l.generator and l.generator.seed or l.level_no or 1}
 local function cells(e) local r={} for y=0,e.footprint[2]-1 do for x=0,e.footprint[1]-1 do r[#r+1]={x=e.grid_position[1]+x,y=e.grid_position[2]+y} end end return r end
 for _,e in ipairs(l.toy_list) do b.toys[#b.toys+1]={id=e.toy_id,archetypeId=e.archetype_id,skinId=e.skin_id,direction=CONFIG[e.direction],cells=cells(e),x=e.grid_position[1],y=e.grid_position[2],length=e.footprint[1]*e.footprint[2],state='IDLE',blockedAt=-9999,impactDx=0,impactDy=0,
  sleeping=e.modifier=='SLEEPING',sleepRemaining=e.wake_after_exits or 0,ice=e.ice_layers or 0,hugLocked=e.modifier=='HUG_LOCKED',hugSource=e.hug_source,pairId=e.pair_id,keyId=e.key_id,modifier=e.modifier} end
 for _,e in ipairs(l.board_entities or {}) do b.entities[#b.entities+1]={id=e.entity_id,kind=e.kind,cells=cells(e),x=e.grid_position[1],y=e.grid_position[2],direction=CONFIG[e.direction] or e.direction,state='IDLE',hp=e.hp,pairId=e.pair_id,keyId=e.key_id,ownDirection=e.own_direction,countsTowardClear=e.counts_toward_level_clear} end
 M.boards[b.toys]=b;return b
end
function M.validate(b)
 local occupied,ids={},{}
 for _,t in ipairs(all(b)) do assert(not ids[t.id],'Duplicate ID '..t.id);ids[t.id]=true
  if active(t) then for _,c in ipairs(t.cells) do assert(inside(b,c),'Outside board '..t.id);assert(not occupied[key(c)],'Overlap '..t.id);occupied[key(c)]=t.id end end
  if t.kind=='PORTAL' then assert(#t.cells==4 and partner(b,t),'Invalid portal '..t.id) end
 end return true
end
function M.settle(b,seeds)
 local queue=seeds or {};local events={};local cursor=1;local contacts={};local transferred={}
 local function emit(kind,source,target,extra) local e=extra or {};e.type=kind;e.source=source;e.target=target;queue[#queue+1]=e end
 while true do
  while cursor<=#queue do local e=queue[cursor];cursor=cursor+1;events[#events+1]=e;local source=find(b,e.source);local target=find(b,e.target)
   if e.type=='ON_EXIT' then
    local first=source and source.state=='EXITING' and not source.exitCounted;if first then source.exitCounted=true end
    for _,t in ipairs(b.toys) do if active(t) then
     if t.sleeping and first then t.sleepRemaining=t.sleepRemaining-1;emit('ON_SLEEP_COUNT',e.source,t.id,{remaining=t.sleepRemaining});if t.sleepRemaining==0 then t.sleeping=false;emit('ON_WAKE',e.source,t.id) end end
     if t.hugLocked and t.hugSource==e.source then t.hugLocked=false;t.pairId=nil;emit('ON_UNLOCK',e.source,t.id) end
    end end
    for _,lock in ipairs(b.entities) do if active(lock) and lock.kind=='LOCK_BOX' and source and source.keyId and lock.keyId==source.keyId then lock.state='DESTROYED';emit('ON_UNLOCK',e.source,lock.id) end end
   elseif e.type=='ON_COLLIDE' and target and active(target) then
    if (target.ice or 0)>0 then target.ice=target.ice-1;emit('ON_ICE_DAMAGE',e.source,target.id);if target.ice==0 then emit('ON_THAW',e.source,target.id) end end
    if target.kind=='BOX' then target.hp=target.hp-1;emit('DAMAGE',e.source,target.id);if target.hp==0 then target.state='DESTROYED';emit('ON_DESTROY',e.source,target.id) end end
    if target.kind=='SPRING' then local contact=e.source..':'..target.id
     if not contacts[contact] then contacts[contact]=true;local moving=copy(target);moving.direction=target.ownDirection and target.direction or e.direction;local p=M.scan(b,moving)
      if p.emptySteps>0 or p.exitsBoard then
       local from=copy(target.cells);local fromDirection=moving.direction;M.position(target,p.cells);target.direction=p.direction;b.randomState=p.randomState
       emit('ON_PUSH',e.source,target.id,{from=from,fromDirection=fromDirection,cells=copy(p.cells),direction=p.direction,travel=p.travel,exitsBoard=p.exitsBoard})
       for _,portal in ipairs(p.portals) do emit('TELEPORT',target.id,portal.from,{destination=portal.to,direction=portal.direction,lane=portal.lane}) end
       if p.exitsBoard then target.state='EXITING';emit('ON_SPRING_EXIT',target.id);emit('ON_EXIT',target.id) end
      end
      if target.ownDirection and p.blockerId and p.blockerId~=e.source then emit('ON_COLLIDE',target.id,p.blockerId,{direction=p.direction}) end
     end
    end
   end
  end
  local wave={};for _,t in ipairs(b.toys) do if M.enabled(t) and t.archetypeId=='AUTO_EXIT' and not transferred[t.id] and M.duckPath(b,t) then wave[#wave+1]=t end end
  if #wave==0 then break end
  for _,t in ipairs(wave) do local route=duckRoute(b,t)
   if route then b.randomState=route.randomState;for _,p in ipairs(route.portals) do emit('TELEPORT',t.id,p.from,{destination=p.to,direction=p.direction,lane=p.lane}) end
    if route.exitsBoard then t.state='EXITING';emit('ON_AUTO_EXIT',t.id,nil,{toy=copy(t),path=route.path});emit('ON_EXIT',t.id)
    else transferred[t.id]=true;local initial=copy(t);local last=route.path[#route.path];M.position(t,{{x=last.x,y=last.y}});emit('ON_DUCK_TRANSFER',t.id,nil,{toy=initial,path=route.path}) end
   end
  end
 end return events
end
function M.click(b,t)
 if not M.manual(t) then return {events={}} end
 local p=M.scan(b,t);local seeds={};local initial=copy(t)
 if p.emptySteps>0 then M.position(t,p.cells);t.direction=p.direction;b.randomState=p.randomState end
 for _,portal in ipairs(p.portals) do seeds[#seeds+1]={type='TELEPORT',source=t.id,target=portal.from,destination=portal.to,direction=portal.direction,lane=portal.lane} end
 if p.exitsBoard then t.state='EXITING';seeds[#seeds+1]={type='MANUAL_EXIT',source=t.id};seeds[#seeds+1]={type='ON_EXIT',source=t.id}
 elseif p.blockerId then seeds[#seeds+1]={type='ON_COLLIDE',source=t.id,target=p.blockerId,direction=t.direction} end
 return {scan=p,initial=initial,events=M.settle(b,seeds)}
end
M.copy=copy;M.find=find;M.DIR=DIR
return M
