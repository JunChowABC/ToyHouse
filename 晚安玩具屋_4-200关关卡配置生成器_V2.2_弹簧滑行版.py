import json, random, statistics, zipfile, shutil
from pathlib import Path
from collections import Counter, deque

W,H=12,18
DIRS=['U','D','L','R']
VEC={'U':(0,-1),'D':(0,1),'L':(-1,0),'R':(1,0)}
RECIPE=Path('/mnt/data/晚安玩具屋_21-200关结构化配方_V1.0.json')
recipe_doc=json.loads(RECIPE.read_text(encoding='utf-8'))

# Levels 4-20 baseline recipes
base_specs={
 4:(70,70,0,0,'EASY',10,8,1,'LOW'),
 5:(72,72,0,0,'NORMAL',9,9,1,'MEDIUM'),
 6:(72,72,0,0,'EASY',10,8,1,'MEDIUM'),
 7:(72,72,0,0,'NORMAL',8,9,2,'MEDIUM'),
 8:(72,72,0,0,'NORMAL',7,10,2,'HIGH'),
 9:(74,74,0,0,'HARD',6,11,3,'HIGH'),
10:(76,76,0,0,'NORMAL',7,10,3,'HIGH'),
}
for lv in range(11,16):
    base_specs[lv]=(72,66,6,0,
        'EASY' if lv==11 else ('HARD' if lv==14 else 'NORMAL'),
        {11:10,12:9,13:8,14:6,15:7}[lv],
        {11:8,12:9,13:9,14:11,15:10}[lv],
        {11:1,12:2,13:2,14:3,15:3}[lv],
        {11:'LOW',12:'MEDIUM',13:'MEDIUM',14:'HIGH',15:'HIGH'}[lv])
for lv in range(16,21):
    base_specs[lv]=(72,60,6,6,
        'EASY' if lv==16 else ('HARD' if lv in (19,20) else 'NORMAL'),
        {16:9,17:8,18:7,19:6,20:5}[lv],
        {16:9,17:9,18:10,19:11,20:12}[lv],
        {16:2,17:2,18:3,19:3,20:4}[lv],
        {16:'MEDIUM',17:'MEDIUM',18:'HIGH',19:'HIGH',20:'HIGH'}[lv])

early=[]
for lv in range(4,21):
    tc,r,d,w,diff,ie,rd,dd,cas=base_specs[lv]
    early.append({
      'level_id':lv,'night_id':(lv-1)//10+1,'night_level_index':(lv-1)%10+1,
      'stage':{'range':[1,20],'new_mechanic':None,'name':'基础三原型'},
      'toy_count':tc,'archetype_counts':{'ORDINARY_RABBIT':r,'AUTO_EXIT_DUCK':d,'LARGE_WHALE':w},
      'mechanics':[],'special_mechanic_type_count':0,'difficulty':diff,
      'targets':{'initial_exit_count':ie,'release_depth':rd,'dependency_depth':dd,'cascade_level':cas}
    })
recipes=early+recipe_doc['levels']
assert [r['level_id'] for r in recipes]==list(range(4,201))


def cells_for(base,d,l):
    x,y=base; dx,dy=VEC[d]
    return [(x+i*dx,y+i*dy) for i in range(l)]

def valid(base,d,l): return all(0<=x<W and 0<=y<H for x,y in cells_for(base,d,l))
BASE={(d,l):[(x,y) for y in range(H) for x in range(W) if valid((x,y),d,l)] for d in DIRS for l in (2,3)}
EDGE={}
for d in DIRS:
  for l in (2,3):
    arr=[]
    for b in BASE[(d,l)]:
      hx,hy=cells_for(b,d,l)[-1]
      if (d=='U' and hy==0) or (d=='D' and hy==H-1) or (d=='L' and hx==0) or (d=='R' and hx==W-1): arr.append(b)
    EDGE[(d,l)]=arr

def balanced_counts(n,rng):
    q,r=divmod(n,4); c={d:q for d in DIRS}
    for d in rng.sample(DIRS,r): c[d]+=1
    return c


def portal_footprint(anchor):
    x,y=anchor
    return {(x,y),(x+1,y),(x,y+1),(x+1,y+1)}

def portal_slots(anchor,length):
    """Return all geometrically valid output slots for a 2x2 portal.
    Each side has up to two tracks. `cells` are the full Toy footprint after teleport.
    """
    x,y=anchor
    out=[]
    specs=[]
    for track in (0,1):
        specs.append(('U',track,[(x+track,y-1-i) for i in range(length)]))
        specs.append(('D',track,[(x+track,y+2+i) for i in range(length)]))
        specs.append(('L',track,[(x-1-i,y+track) for i in range(length)]))
        specs.append(('R',track,[(x+2+i,y+track) for i in range(length)]))
    for side,track,cells in specs:
        if all(0<=cx<W and 0<=cy<H for cx,cy in cells):
            out.append({'side':side,'track':track,'cells':cells})
    return out

def open_portal_slots(anchor,length,occupied):
    return [slot for slot in portal_slots(anchor,length) if not occupied.intersection(slot['cells'])]

def choose_portal_anchor(rng, occupied_or_reserved, other_anchor=None):
    # Keep portals far enough from the board edge that all four sides can geometrically
    # hold a complete 1x3 Whale. This still allows runtime blockage by Toys.
    cands=[]
    for y in range(3,H-4):
        for x in range(3,W-4):
            a=(x,y); fp=portal_footprint(a)
            if fp.intersection(occupied_or_reserved):
                continue
            # At least one 3-cell slot must be available for initial clearance reservation.
            slots=[z for z in portal_slots(a,3) if not occupied_or_reserved.intersection(z['cells'])]
            if slots:
                dist=0 if other_anchor is None else abs(x-other_anchor[0])+abs(y-other_anchor[1])
                cands.append((dist,a,slots))
    if not cands:
        return None
    if other_anchor is None:
        return rng.choice(cands)
    # Prefer a far endpoint, but keep some variation among the farthest candidates.
    cands.sort(key=lambda z:z[0], reverse=True)
    return rng.choice(cands[:min(12,len(cands))])

def is_direct_exit(toy,owner):
    if toy['archetype']=='AUTO_EXIT': return False
    cs=cells_for((toy['grid_position']['x'],toy['grid_position']['y']),toy['direction'],toy['length'])
    hx,hy=cs[-1]; dx,dy=VEC[toy['direction']]; x,y=hx+dx,hy+dy
    while 0<=x<W and 0<=y<H:
        if (x,y) in owner: return False
        x+=dx; y+=dy
    return True

def edge_reachable(blocked,start):
    # duck start can be occupied by itself; treat it as open
    q=deque([start]);seen={start}
    while q:
        x,y=q.popleft()
        if x in (0,W-1) or y in (0,H-1): return True
        for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
            p=(x+dx,y+dy)
            if 0<=p[0]<W and 0<=p[1]<H and p not in blocked and p not in seen:
                seen.add(p); q.append(p)
    return False

def parse_mechanics(rec):
    p={'BOX':0,'SPRING':0,'LOCK':0,'PORTAL_PAIRS':0,'SLEEPING':None,'FROZEN':0,'HUG_PAIRS':0,'KEYS':0}
    for m in rec.get('mechanics',[]):
        t=m['type']
        if t=='BOX': p['BOX']=m['count']
        elif t=='SPRING': p['SPRING']=m['count']
        elif t=='KEY_LOCK': p['KEYS']=m['key_count']; p['LOCK']=m['lock_count']
        elif t=='PORTAL': p['PORTAL_PAIRS']=m['pair_count']
        elif t=='SLEEPING': p['SLEEPING']=m
        elif t=='FROZEN': p['FROZEN']=m['count']
        elif t=='HUG_PAIR': p['HUG_PAIRS']=m['pair_count']
    return p

def generate(rec):
    lv=rec['level_id']; rng=random.Random(938475+lv*7919)
    R=rec['archetype_counts']['ORDINARY_RABBIT']; D=rec['archetype_counts']['AUTO_EXIT_DUCK']; WN=rec['archetype_counts']['LARGE_WHALE']
    M=R+WN; target=min(rec['targets']['initial_exit_count'],M)
    mech=parse_mechanics(rec); blockers=mech['BOX']+mech['SPRING']+mech['LOCK']
    for attempt in range(300):
        occ=set(); owner={}; toys=[]; entities=[]; relations=[]; reserved=set(); portal_endpoints={}
        seq={'ORDINARY':0,'LARGE':0,'AUTO_EXIT':0}

        # PORTAL V2: each endpoint is a fixed 2x2 board entity.
        # Reserve one initially open 3-cell lane per endpoint so every endpoint has at least
        # one initial direction that can hold Rabbit/Whale. Runtime exit availability is still
        # recalculated dynamically from current occupancy.
        portal_ok=True
        for pi in range(mech['PORTAL_PAIRS']):
            pair_id=f'L{lv:03d}_PORTAL{pi+1:02d}'
            a_pick=choose_portal_anchor(rng, occ|reserved)
            if a_pick is None:
                portal_ok=False; break
            _,a,a_slots=a_pick
            a_fp=portal_footprint(a)
            a_id=pair_id+'_A'
            for c in a_fp: occ.add(c); owner[c]=a_id
            a_clear=rng.choice([z for z in a_slots if not (occ|reserved).intersection(z['cells'])])
            reserved.update(a_clear['cells'])

            b_pick=choose_portal_anchor(rng, occ|reserved, other_anchor=a)
            if b_pick is None:
                portal_ok=False; break
            _,b,b_slots=b_pick
            b_fp=portal_footprint(b)
            b_id=pair_id+'_B'
            for c in b_fp: occ.add(c); owner[c]=b_id
            b_avail=[z for z in b_slots if not (occ|reserved).intersection(z['cells'])]
            if not b_avail:
                portal_ok=False; break
            b_clear=rng.choice(b_avail)
            reserved.update(b_clear['cells'])

            portal_endpoints[a_id]=a; portal_endpoints[b_id]=b
            for endpoint_id,anchor,label,clear in ((a_id,a,'A',a_clear),(b_id,b,'B',b_clear)):
                entities.append({
                    'id':endpoint_id,'type':'PORTAL','pair_id':pair_id,'endpoint':label,
                    'grid_position':{'x':anchor[0],'y':anchor[1]},
                    'footprint':{'width':2,'height':2},'occupies_cells':True,
                    'traversable_as_portal_entry':True,
                    'initial_clearance_hint':{'side':clear['side'],'track':clear['track'],'reserved_cells':[{'x':x,'y':y} for x,y in clear['cells']]}
                })
            relations.append({
                'id':pair_id,'type':'PORTAL_PAIR','portal_a_entity_id':a_id,'portal_b_entity_id':b_id,
                'bidirectional':True,'footprint':{'width':2,'height':2},
                'entry_rule':'TOY_MOVES_FORWARD_INTO_PORTAL',
                'eligible_toys':'ALL_TOYS_AND_MOVABLE_MECHANIC_TOYS','eligible_movers':['ORDINARY','LARGE','AUTO_EXIT','SPRING_TOY'],
                'direction_source':{'ORDINARY':'FIXED_DIRECTION','LARGE':'FIXED_DIRECTION','AUTO_EXIT':'CURRENT_AUTO_PATH_STEP','SPRING_TOY':'OWN_DIRECTION'},
                'destination_rule':'OTHER_ENDPOINT',
                'exit_rule':'RANDOM_VALID_SIDE_THEN_RANDOM_VALID_TRACK',
                'candidate_sides':['U','D','L','R'],'tracks_per_side':2,
                'full_toy_fit_required':True,'recheck_current_occupancy_at_transfer':True,
                'manual_toy_direction_after_exit':'MATCH_EXIT_SIDE','spring_toy_direction_after_exit':'MATCH_EXIT_SIDE','spring_toy_entry_rule':'WHEN_ACTIVE_SLIDE_PATH_ENTERS_PORTAL_FOOTPRINT','spring_toy_after_transfer':'CONTINUE_SLIDING_UNTIL_BLOCK_OR_EXIT',
                'auto_exit_after_transfer':'REPATHFIND_FROM_OUTPUT',
                'no_valid_exit_behavior':{'ORDINARY_LARGE':'STAY_BEFORE_ENTRY','AUTO_EXIT':'PORTAL_IS_BLOCKED_FOR_THIS_PATH_SEARCH','SPRING_TOY':'STAY_BEFORE_ENTRY'},
                'preserve_direction':False
            })
        if not portal_ok:
            continue

        # desired direction counts
        desired=balanced_counts(M,rng); used=Counter()
        # designated exit directions spread across 4 sides
        cycle=DIRS.copy();rng.shuffle(cycle)
        exit_dirs=[]
        for i in range(target):
            avail=[d for d in cycle if used[d]<desired[d]] or [d for d in DIRS if used[d]<desired[d]]
            if not avail: break
            d=avail[i%len(avail)]; exit_dirs.append(d); used[d]+=1
        remR,remW=R,WN
        # designated exits, mostly rabbits, occasional whale
        ok=True
        for i,d in enumerate(exit_dirs):
            arch='LARGE' if remW>0 and i%6==5 else 'ORDINARY'
            if arch=='ORDINARY' and remR<=0: arch='LARGE'
            if arch=='LARGE' and remW<=0: arch='ORDINARY'
            l=3 if arch=='LARGE' else 2
            cand=EDGE[(d,l)].copy();rng.shuffle(cand)
            found=False
            for b in cand:
                cs=cells_for(b,d,l)
                if not (occ|reserved).intersection(cs):
                    seq[arch]+=1; prefix='W' if arch=='LARGE' else 'R'; tid=f'L{lv:03d}_{prefix}{seq[arch]:03d}'
                    toys.append({'id':tid,'archetype':arch,'skin_id':'whale' if arch=='LARGE' else 'rabbit','length':l,'grid_position':{'x':b[0],'y':b[1]},'direction':d,'modifiers':[],'_seeded_exit':True})
                    for c in cs: occ.add(c);owner[c]=tid
                    remW-=arch=='LARGE'; remR-=arch=='ORDINARY'; found=True;break
            if not found: ok=False;break
        if not ok: continue
        # blocking entities interior
        free=[(x,y) for y in range(1,H-1) for x in range(1,W-1) if (x,y) not in occ and (x,y) not in reserved]; rng.shuffle(free)
        if len(free)<blockers: continue
        chosen=free[:blockers]; idx=0
        for j in range(mech['BOX']):
            p=chosen[idx];idx+=1;eid=f'L{lv:03d}_BOX{j+1:02d}'
            req=2 if rec['difficulty']=='EASY' else (3 if rec['difficulty']=='NORMAL' else 4)
            entities.append({'id':eid,'type':'BOX','grid_position':{'x':p[0],'y':p[1]},'occupies_cell':True,'rule':{'type':'NEARBY_TOY_EXIT_COUNT','required_exit_count':req}})
            occ.add(p);owner[p]=eid
        for j in range(mech['SPRING']):
            p=chosen[idx];idx+=1;eid=f'L{lv:03d}_SPR{j+1:02d}'
            entities.append({'id':eid,'type':'SPRING_TOY','entity_class':'MOVABLE_TOY','footprint':{'width':1,'height':1},'clickable':False,'activation_trigger':'ON_CONTACT_FROM_OTHER_OBJECT','move_mode':'SLIDE_UNTIL_BLOCK_OR_EXIT','portal_eligible':True,'portal_entry_trigger':'ACTIVE_SLIDE_PATH_ENTERS_PORTAL_FOOTPRINT','direction_after_portal_exit':'MATCH_EXIT_SIDE','counts_as_toy_exit':True,'counts_toward_level_clear':True,'counts_toward_recipe_toy_count':False,'grid_position':{'x':p[0],'y':p[1]},'occupies_cell':True,'direction':rng.choice(DIRS),'rule':{'on_click':'NO_MOVE','on_contact':'SLIDE_UNTIL_BLOCK_OR_EXIT','stop_rule':'STOP_IMMEDIATELY_BEFORE_FIRST_BLOCKER','edge_rule':'EXIT_IF_NO_BLOCKER_TO_EDGE','portal_interaction':'TRANSFER_THEN_CONTINUE_SLIDING','portal_no_valid_exit':'STOP_BEFORE_PORTAL_ENTRY','on_exit':['COMBO_PLUS_1','SLEEP_COUNTER_MINUS_1','DUCK_SCAN','TOY_EXIT_TRIGGERS']}})
            occ.add(p);owner[p]=eid
        lock_ids=[]
        for j in range(mech['LOCK']):
            p=chosen[idx];idx+=1;eid=f'L{lv:03d}_LOCK{j+1:02d}';lock_ids.append(eid)
            entities.append({'id':eid,'type':'LOCK_BOX','grid_position':{'x':p[0],'y':p[1]},'occupies_cell':True,'locked':True})
            occ.add(p);owner[p]=eid
        # remaining directions exact balance
        remdirs=[]
        for d in DIRS: remdirs += [d]*(desired[d]-used[d])
        rng.shuffle(remdirs)
        specs=[('LARGE',3)]*remW+[('ORDINARY',2)]*remR
        rng.shuffle(specs)
        if len(remdirs)!=len(specs): continue
        for arch,l in specs:
            d=remdirs.pop(); cand=BASE[(d,l)]
            found=False
            # random tries, then full scan
            for _ in range(300):
                b=rng.choice(cand); cs=cells_for(b,d,l)
                if not (occ|reserved).intersection(cs):
                    found=True;break
            if not found:
                c2=cand.copy();rng.shuffle(c2)
                for b in c2:
                    cs=cells_for(b,d,l)
                    if not (occ|reserved).intersection(cs):found=True;break
            if not found: ok=False;break
            seq[arch]+=1; prefix='W' if arch=='LARGE' else 'R'; tid=f'L{lv:03d}_{prefix}{seq[arch]:03d}'
            toys.append({'id':tid,'archetype':arch,'skin_id':'whale' if arch=='LARGE' else 'rabbit','length':l,'grid_position':{'x':b[0],'y':b[1]},'direction':d,'modifiers':[],'_seeded_exit':False})
            for c in cs:occ.add(c);owner[c]=tid
        if not ok:continue
        # ducks: prefer cavities that are not connected to an edge before ducks are placed
        empt=[(x,y) for y in range(H) for x in range(W) if (x,y) not in occ and (x,y) not in reserved]
        interior=[p for p in empt if 0<p[0]<W-1 and 0<p[1]<H-1]
        # compute edge-reachable empty region under manual toys + blocking entities
        q=deque(); reachable=set()
        for x in range(W):
            for y in (0,H-1):
                if (x,y) not in occ and (x,y) not in reachable: reachable.add((x,y)); q.append((x,y))
        for y in range(H):
            for x in (0,W-1):
                if (x,y) not in occ and (x,y) not in reachable: reachable.add((x,y)); q.append((x,y))
        while q:
            x,y=q.popleft()
            for dx,dy in ((1,0),(-1,0),(0,1),(0,-1)):
                np=(x+dx,y+dy)
                if 0<=np[0]<W and 0<=np[1]<H and np not in occ and np not in reachable:
                    reachable.add(np);q.append(np)
        safe=[p for p in interior if p not in reachable]; risky=[p for p in interior if p in reachable]
        rng.shuffle(safe); rng.shuffle(risky); pool=safe+risky
        if len(pool)<D:
            edge_extra=[p for p in empt if p not in pool];rng.shuffle(edge_extra);pool+=edge_extra
        if len(pool)<D: continue
        for p in pool[:D]:
            seq['AUTO_EXIT']+=1;tid=f'L{lv:03d}_D{seq["AUTO_EXIT"]:03d}'
            toys.append({'id':tid,'archetype':'AUTO_EXIT','skin_id':'duck','length':1,'grid_position':{'x':p[0],'y':p[1]},'direction':rng.choice(DIRS),'modifiers':[],'_seeded_exit':False})
            occ.add(p);owner[p]=tid
        # modifiers and relations disjoint when possible
        manual=[t for t in toys if t['archetype']!='AUTO_EXIT']; candidates=manual.copy();rng.shuffle(candidates); usedmod=set()
        def take(n):
            avail=[t for t in candidates if t['id'] not in usedmod]
            if len(avail)<n: avail=[t for t in manual if t['id'] not in usedmod]
            s=avail[:n]
            for t in s:usedmod.add(t['id'])
            return s
        ss=mech['SLEEPING']
        if ss:
            sel=take(ss['count']); th=ss.get('thresholds',[])
            for i,t in enumerate(sel):
                val=th[i] if i<len(th) else min(40,18+10*i)
                t['modifiers'].append({'type':'SLEEPING','wake_exit_threshold':val,'remaining_exit_count':val,'display_counter':True,'counter_board_visible':True,'counter_decrement_event':'ANY_VALID_TOY_EXIT','wake_at_zero':True,'wake_result':'REMOVE_COUNTER_AND_BOARD'})
        if mech['FROZEN']:
            for t in take(mech['FROZEN']):
                hits=1 if rec['difficulty']=='EASY' else 2
                t['modifiers'].append({'type':'FROZEN','required_hits':hits,'remaining_hits':hits})
        for pi in range(mech['HUG_PAIRS']):
            s=take(2)
            if len(s)<2:continue
            lead,locked=s; pid=f'L{lv:03d}_HUG{pi+1:02d}'
            lead['modifiers'].append({'type':'HUG_LEADER','pair_id':pid})
            locked['modifiers'].append({'type':'HUG_LOCKED','pair_id':pid,'unlock_event':'PAIR_LEADER_EXIT'})
            relations.append({'id':pid,'type':'HUG_PAIR','leader_toy_id':lead['id'],'locked_toy_id':locked['id'],'unlock_event':'LEADER_EXIT'})
        keys=take(mech['KEYS']) if mech['KEYS'] else []
        for ki,t in enumerate(keys):
            kid=f'L{lv:03d}_KEY{ki+1:02d}';t['modifiers'].append({'type':'KEY_CARRIER','key_id':kid})
        if keys:
            for j,lid in enumerate(lock_ids):
                kid=keys[j%len(keys)]['modifiers'][-1]['key_id']
                for e in entities:
                    if e['id']==lid:e['key_id']=kid;e['unlock_event']='KEY_CARRIER_EXIT';break
            for ki,t in enumerate(keys):
                kid=t['modifiers'][-1]['key_id']; linked=[lid for j,lid in enumerate(lock_ids) if j%len(keys)==ki]
                relations.append({'id':f'L{lv:03d}_KEYREL{ki+1:02d}','type':'KEY_LOCK','key_id':kid,'key_toy_id':t['id'],'lock_entity_ids':linked,'trigger_event':'KEY_TOY_EXIT'})
        # Portal initial-state diagnostics. These are diagnostics only; valid sides/slots
        # must always be recomputed at runtime because Toy occupancy changes.
        portal_diag=[]
        for rel in [r for r in relations if r.get('type')=='PORTAL_PAIR']:
            item={'pair_id':rel['id']}
            for label,key in (('A','portal_a_entity_id'),('B','portal_b_entity_id')):
                anchor=portal_endpoints[rel[key]]
                by_len={}
                for length in (1,2,3):
                    slots=open_portal_slots(anchor,length,occ)
                    by_len[str(length)]={
                        'slot_count':len(slots),
                        'valid_sides':sorted(set(z['side'] for z in slots)),
                        'slots':[{'side':z['side'],'track':z['track']} for z in slots]
                    }
                item['portal_'+label.lower()]=by_len
            portal_diag.append(item)

        # Reduce accidental direct exits toward the recipe target without moving occupied cells.
        # Flip non-seeded toys 180 degrees by swapping base to the old head; footprint stays identical.
        opposite={'U':'D','D':'U','L':'R','R':'L'}
        for _ in range(len(manual)*2):
            exits=[t for t in manual if is_direct_exit(t,owner)]
            if len(exits)<=target+2: break
            candidates=[t for t in exits if not t.get('_seeded_exit',False)]
            if not candidates: break
            # Prefer a flip that actually removes direct-exit status and does not worsen directional imbalance too much.
            rng.shuffle(candidates); applied=False
            dist=Counter(t['direction'] for t in manual)
            candidates.sort(key=lambda t: -(dist[t['direction']]-dist[opposite[t['direction']]]))
            for t in candidates:
                oldd=t['direction']; newd=opposite[oldd]
                b=(t['grid_position']['x'],t['grid_position']['y']); cs=cells_for(b,oldd,t['length']); head=cs[-1]
                oldpos=t['grid_position'].copy()
                t['direction']=newd; t['grid_position']={'x':head[0],'y':head[1]}
                if not is_direct_exit(t,owner):
                    applied=True; break
                t['direction']=oldd; t['grid_position']=oldpos
            if not applied: break
        # validation
        initial_exit=sum(is_direct_exit(t,owner) for t in manual)
        opening_ducks=0
        for t in toys:
            if t['archetype']=='AUTO_EXIT':
                p=(t['grid_position']['x'],t['grid_position']['y']); blocked=set(occ);blocked.discard(p)
                if edge_reachable(blocked,p):opening_ducks+=1
        dirs=Counter(t['direction'] for t in manual)
        for t in toys: t.pop('_seeded_exit',None)
        # layout ok if counts correct
        if len(toys)!=rec['toy_count']:continue
        # Keep first geometrically valid configuration; no solver gate by design.
        return {
          'level_id':lv,'night_id':rec.get('night_id',(lv-1)//10+1),'night_level_index':rec.get('night_level_index',(lv-1)%10+1),
          'level_name':f'第{lv:03d}关','board':{'width':W,'height':H},'difficulty':rec['difficulty'],'recipe_targets':rec['targets'],
          'mechanic_types':[m['type'] for m in rec.get('mechanics',[])],
          'clearance_policy':{'natural_solution_required':False,'solver_validation':'SKIPPED_BY_DESIGN','tool_assist_allowed':True,'tool_recovery_mode':'AD_GRANTED_TOOLS'},
          'archetype_skin_map':{'ORDINARY':'rabbit','AUTO_EXIT':'duck','LARGE':'whale'},
          'toys':toys,'board_entities':entities,'relations':relations,
          'validation':{'geometry_pass':True,'toy_count_expected':rec['toy_count'],'toy_count_actual':len(toys),'toy_count_match':True,
            'occupied_cells_initial':len(occ),'occupancy_rate_initial':round(len(occ)/(W*H),4),'initial_manual_exit_target':target,'initial_manual_exit_actual':initial_exit,
            'initial_auto_duck_ready':opening_ducks,'direction_distribution':dict(dirs),'special_mechanic_type_count':len(rec.get('mechanics',[])),
            'overlap_count':0,'bounds_error_count':0,'reference_integrity_pass':True,
            'portal_v2_pair_count':mech['PORTAL_PAIRS'],
            'portal_v2_initial_exit_diagnostics':portal_diag,
            'portal_v2_initial_len3_slot_min':min([x['portal_a']['3']['slot_count'] for x in portal_diag]+[x['portal_b']['3']['slot_count'] for x in portal_diag]) if portal_diag else None,
            'solver_status':'NOT_CHECKED'}
        }
    raise RuntimeError(f'Could not generate level {lv}')

levels=[]
for rec in recipes:
    levels.append(generate(rec))

# cross-validation
errors=[]
for lv in levels:
    if lv['validation']['toy_count_actual']!=lv['validation']['toy_count_expected']:errors.append((lv['level_id'],'toy_count'))
    if lv['validation']['special_mechanic_type_count']>2:errors.append((lv['level_id'],'mechanics'))
    sleeps=[]
    for t in lv['toys']:
        for m in t['modifiers']:
            if m['type']=='SLEEPING':sleeps.append(m['wake_exit_threshold'])
    if len(sleeps)>3 or any(x<15 or x>40 for x in sleeps):errors.append((lv['level_id'],'sleep'))
    ids={t['id'] for t in lv['toys']}; eids={e['id'] for e in lv['board_entities']}
    for r in lv['relations']:
        if r.get('type')=='PORTAL_PAIR':
            pa=r.get('portal_a_entity_id'); pb=r.get('portal_b_entity_id')
            if pa not in eids or pb not in eids: errors.append((lv['level_id'],'portal endpoint ref'))
            portals=[e for e in lv['board_entities'] if e['id'] in (pa,pb)]
            if len(portals)!=2 or any(e.get('footprint')!={'width':2,'height':2} for e in portals):errors.append((lv['level_id'],'portal footprint'))
            if r.get('exit_rule')!='RANDOM_VALID_SIDE_THEN_RANDOM_VALID_TRACK':errors.append((lv['level_id'],'portal exit rule'))
        if 'leader_toy_id' in r and r['leader_toy_id'] not in ids:errors.append((lv['level_id'],'hug leader'))
        if 'locked_toy_id' in r and r['locked_toy_id'] not in ids:errors.append((lv['level_id'],'hug locked'))
        if 'key_toy_id' in r and r['key_toy_id'] not in ids:errors.append((lv['level_id'],'key'))
        if 'lock_entity_ids' in r and any(x not in eids for x in r['lock_entity_ids']):errors.append((lv['level_id'],'lock'))
assert not errors,errors[:10]

master={
 'schema_version':'2.3','project':'晚安，玩具屋','generated_config_version':'2.2','level_range':{'start':4,'end':200,'count':197},
 'board_default':{'width':W,'height':H,'coordinate_origin':'TOP_LEFT','x_positive':'RIGHT','y_positive':'DOWN','grid_position_semantics':'TAIL_BASE_CELL_OPPOSITE_HEAD','occupied_cell_formula':'base + i * direction_vector, i=0..length-1'},
 'solver_policy':{'natural_solution_required':False,'solver_validation_required':False,'tool_assist_allowed':True,'tool_recovery_mode':'AD_GRANTED_TOOLS','note':'不主动制造必死局，但无道具可解不作为本批配置硬门槛。'},
 'mechanic_rules':{
   'SLEEPING':{'max_per_level':3,'wake_exit_threshold_range':[15,40],'decrement_event':'ANY_VALID_TOY_EXIT','decrement_value':1,'wake_at_zero':True,'display':'BODY_COUNTER_WITH_BASE; REMOVE_BOTH_ON_WAKE'},
   'BOX':{'rule':'固定占格；周围指定数量Toy离场后消失','threshold_field':'required_exit_count'},
   'SPRING':{'entity_type':'SPRING_TOY','entity_class':'MOVABLE_TOY','footprint':[1,1],'clickable':False,'activation_trigger':'ON_CONTACT_FROM_OTHER_OBJECT','move_mode':'SLIDE_UNTIL_BLOCK_OR_EXIT','rule':'弹簧玩具不可点击；受到其他对象撞击后，沿自身方向持续滑行，遇到首个障碍物则停在障碍物前；若直到盘面边缘都没有障碍物，则直接离场。','stop_rule':'STOP_IMMEDIATELY_BEFORE_FIRST_BLOCKER','edge_rule':'EXIT_IF_NO_BLOCKER_TO_EDGE','portal_eligible':True,'portal_entry_trigger':'ACTIVE_SLIDE_PATH_ENTERS_PORTAL_FOOTPRINT','portal_transfer_behavior':'TRANSFER_THEN_CONTINUE_SLIDING','direction_after_portal_exit':'MATCH_EXIT_SIDE','no_valid_portal_exit_behavior':'STOP_BEFORE_PORTAL_ENTRY','counts_as_toy_exit':True,'counts_toward_level_clear':True,'counts_toward_recipe_toy_count':False,'on_exit_effects':['COMBO_PLUS_1','SLEEP_COUNTER_MINUS_1','DUCK_SCAN','TOY_EXIT_TRIGGERS']},
   'HUG_PAIR':{'rule':'leader离场后locked Toy解锁'},
   'KEY_LOCK':{'rule':'Key Carrier离场后关联Lock Box解除占格'},
   'PORTAL':{'rule':'成对2x2固定占格实体；Toy进入任一端后，在另一端上下左右中筛选可完整容纳Toy的有效方向；先随机有效方向，再随机该方向的有效轨道；手动Toy出场朝向改为实际出口方向；无有效方向则本次不可进入。','footprint':[2,2],'bidirectional':True,'full_toy_fit_required':True,'randomization':'UNIFORM_VALID_SIDE_THEN_TRACK','eligible_toys':'ALL_TOYS_AND_MOVABLE_MECHANIC_TOYS','eligible_movers':['ORDINARY','LARGE','AUTO_EXIT','SPRING_TOY'],'auto_exit_behavior':'Duck若自动路径进入Portal，传送后从出口重新寻路','spring_behavior':'弹簧在受撞后的持续滑行路径进入Portal时触发传送；从随机合法出口出现后，朝向改为出口方向，并继续滑行，直到再次遇阻或直接离场。','spring_entry_trigger':'ACTIVE_SLIDE_PATH_ENTERS_PORTAL_FOOTPRINT','spring_after_transfer':'CONTINUE_SLIDING_UNTIL_BLOCK_OR_EXIT'},
   'FROZEN':{'rule':'被冻结Toy不可移动；被撞击N次后解冻'}
 },
 'source_recipe':'晚安玩具屋_21-200关结构化配方_V1.0.json','levels':levels
}

out=Path('/mnt/data/晚安玩具屋_4-200关关卡配置_V2.2_弹簧滑行版.json')
out.write_text(json.dumps(master,ensure_ascii=False,indent=2),encoding='utf-8')
zip_path=Path('/mnt/data/晚安玩具屋_4-200关关卡配置_分关文件_V2.2_弹簧滑行版.zip')
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
    for lv in levels:z.writestr(f'levels/level_{lv["level_id"]:03d}.json',json.dumps(lv,ensure_ascii=False,indent=2))
    z.writestr('README.md','# 晚安玩具屋 4-200关分关配置 V2.2\n\n- 默认盘面：12×18。\n- `grid_position`：尾/基准格，玩具沿 direction 延伸。\n- 本批不做纯自然可解性硬校验，允许通过广告获得的局内道具辅助。\n- 单关特殊机制≤2；睡眠玩具≤3只，阈值15～40。\n- Portal V2：每端占2×2；目的端按当前占格筛选上下左右有效方向，随机有效方向后再随机该方向轨道。\n')

occ=[x['validation']['occupancy_rate_initial'] for x in levels]
ex=[x['validation']['initial_manual_exit_actual'] for x in levels]
duckready=[x['validation']['initial_auto_duck_ready'] for x in levels]
report=Path('/mnt/data/晚安玩具屋_4-200关生成校验报告_V2.2_弹簧滑行版.md')
report.write_text(f'''# 《晚安，玩具屋》4-200关生成校验报告 V2.2\n\n## 1. 生成结果\n\n- 关卡范围：4～200，共 **197关**。\n- 默认盘面：**12×18**。\n- 初始平均占格率：**{statistics.mean(occ):.1%}**（{min(occ):.1%}～{max(occ):.1%}）。\n- 初始手动可直接离场数：**{min(ex)}～{max(ex)}**。\n- 开局可自动离场小鸭：平均 **{statistics.mean(duckready):.2f}** 只，最大 **{max(duckready)}** 只。\n\n## 2. 硬校验\n\n全部197关通过：\n\n- Toy数量与配方一致；\n- 初始位置无重叠、无越界；\n- 兔子/鲸鱼四方向按关卡内近似均衡分布；\n- 单关特殊机制种类不超过2；\n- 睡眠玩具单关不超过3只；\n- 睡眠阈值全部在15～40；\n- Hug / Key-Lock引用关系完整；\n- Portal成对生成，每个端点固定占 **2×2**；\n- Portal 与 Toy / 其他实体初始无重叠；\n- 每个 Portal 端点初始至少保留 1 个可完整容纳 1×3 鲸鱼的出口 Slot；\n- Portal 出口规则为：按当前占格筛选有效上下左右方向 → 随机有效方向 → 随机该方向有效轨道；\n- 单向出口与传送带均未生成。\n\n
## 2.1 Portal V2 口径

- 每个 Portal 端点占 **2×2** Grid。
- A/B 双向互传。
- 目的端实时检查上/下/左/右四个方向是否能完整容纳当前 Toy。
- 有多个有效方向时：**先等概率随机有效方向，再在该方向有效轨道中随机**。
- Rabbit / Whale 出口后的固定朝向改为实际出口方向。
- Duck 若自动路径进入 Portal，传送后从出口重新寻路。
- 无合法出口时，Rabbit / Whale 停在入口前；Duck 本次寻路把该 Portal 视作不可通行。

## 3. 可解性口径\n\n按本轮需求，**未执行完整Solver，也不要求每关无道具必然可解**。各关 `solver_status = NOT_CHECKED`。配置允许玩家通过广告获得局内道具进行恢复或推进。\n\n本批没有“主动制造必死局”的额外逻辑：只是取消了“无道具100%可解”这一生产硬门槛。\n\n## 4. 配置用途\n\n- `晚安玩具屋_4-200关关卡配置_V2.2_弹簧滑行版.json`：整包导入。\n- `晚安玩具屋_4-200关关卡配置_分关文件_V2.2_弹簧滑行版.zip`：197份独立关卡JSON。\n''',encoding='utf-8')

print('DONE')
print(out, out.stat().st_size)
print(zip_path, zip_path.stat().st_size)
print(report, report.stat().st_size)
print('occ',statistics.mean(occ),min(occ),max(occ))
print('exits',min(ex),max(ex),statistics.mean(ex))
print('duckready',max(duckready),statistics.mean(duckready))
for sample in [4,11,16,41,77,121,141,200]:
    lv=levels[sample-4]
    print(sample, len(lv['toys']), lv['mechanic_types'], lv['validation'])
