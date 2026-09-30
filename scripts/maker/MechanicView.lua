-- Mechanism art and motion on the established NanoVG board.
local Art=require('MechanicAssets')
local DIR={LEFT={-1,0},RIGHT={1,0},UP={0,-1},DOWN={0,1}}
return function(V,img,toy,color)
 local function art(name,b,alpha) if Art[name] then img(Art[name],b,alpha) end end
 local function sprite(g,t,dx,dy,alpha)
  if t.kind=='SPRING' then
   local v=V.vg;nvgSave(v);nvgTranslate(v,60+(t.x+.5)*35+(dx or 0),199+(t.y+.5)*35+(dy or 0));nvgRotate(v,({RIGHT=0,DOWN=math.pi/2,LEFT=math.pi,UP=-math.pi/2})[t.direction] or 0)
   art('spring',{-18,-18,36,36},alpha);nvgRestore(v)
  else toy(g,t,dx,dy,alpha) end
 end
 function V.mechanicOverlay(g,t)
  local minX,minY,maxX,maxY=t.x,t.y,t.x,t.y;for _,c in ipairs(t.cells) do maxX=math.max(maxX,c.x);maxY=math.max(maxY,c.y) end
  local cx=60+(minX+maxX+1)*17.5;local cy=199+(minY+maxY+1)*17.5
  if t.sleeping then art('sleep-count',{cx-12,cy-10,24,20});V.text(t.sleepRemaining,cx,cy,12,'#685185',18) end
  if (t.ice or 0)>0 then art('ice',{cx-20,cy-20,40,40},.78);V.text(t.ice,cx,cy+12,11,'#71628d',15,'#ffffff') end
  if t.pairId then art('heart',{cx-7,cy-27,14,18}) end
  if t.keyId then art('key',{cx-18,cy-25,14,17}) end
 end
 function V.mechanicEntities(g)
  for _,e in ipairs(g.entities or {}) do if e.state=='IDLE' then
   local flying=false for _,a in ipairs(g.flights or {}) do if a.toy.id==e.id then flying=true end end
   if not flying then
    local w,h=1,1 for _,c in ipairs(e.cells) do w=math.max(w,c.x-e.x+1);h=math.max(h,c.y-e.y+1) end
    local b={60+e.x*35+1,199+e.y*35+1,w*35-2,h*35-2}
    if e.kind=='SPRING' then sprite(g,e,0,0,1)
    else art(e.kind=='BOX' and 'box' or e.kind=='LOCK_BOX' and 'lock' or 'portal',b)
     if e.kind=='BOX' then V.text(e.hp,b[1]+b[3]/2,b[2]+b[4]*.75,10,'#80584d',20,'#fff5dc') end
     if e.kind=='PORTAL' then
      local index=0 for _,p in ipairs(g.entities) do if p.kind=='PORTAL' then index=index+1;if p.pairId==e.pairId then break end end end
      V.text(math.ceil(index/2),b[1]+b[3]/2,b[2]+b[4]/2,13,'#ffffff',20,'#75528d')
     end
    end
   end
  end end
 end
 function V.mechanicFlights(g)
  for _,a in ipairs(g.flights or {}) do
   local progress=math.max(0,math.min(1,(g.time-a.start)/a.duration));local s=progress*(#a.steps-1);local i=math.min(#a.steps-1,math.floor(s)+1);local x,y=a.steps[i],a.steps[i+1];local f=s-i+1
   if y.teleport then f=f>=.5 and 1 or 0 end
   local frame=f==1 and y or x;local t={} for k,v in pairs(a.toy) do t[k]=v end
   t.cells=frame.cells;t.x=math.huge;t.y=math.huge;for _,c in ipairs(t.cells) do t.x=math.min(t.x,c.x);t.y=math.min(t.y,c.y) end;t.direction=frame.direction
   local bx,by=math.huge,math.huge;for _,c in ipairs(y.cells) do bx=math.min(bx,c.x);by=math.min(by,c.y) end
   sprite(g,t,(bx-t.x)*f*35,(by-t.y)*f*35,a.exits and 1-math.max(0,(progress-.8)*5) or 1)
  end
 end
end
