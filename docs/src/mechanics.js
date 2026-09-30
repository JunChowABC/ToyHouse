// Deterministic rules shared by play, authoring, generation and search.
const Mechanics = (() => {
  const directions = { LEFT: { x: -1, y: 0 }, RIGHT: { x: 1, y: 0 }, UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 } };
  const configDirections = { L: 'LEFT', R: 'RIGHT', U: 'UP', D: 'DOWN' };
  const copy = value => structuredClone(value);
  const key = (x, y) => `${x},${y}`;
  const active = entity => entity.state === 'IDLE';
  const inside = (board, cell) => cell.x >= 0 && cell.y >= 0 && cell.x < board.cols && cell.y < board.rows;
  const enabled = toy => active(toy) && !toy.sleeping && !toy.hugLocked && !(toy.ice > 0);
  const floor = entity => ['PORTAL', 'ONE_WAY_EXIT', 'CONVEYOR', 'ROTATOR'].includes(entity.kind);
  const rotated = { RIGHT: 'DOWN', DOWN: 'LEFT', LEFT: 'UP', UP: 'RIGHT' };
  const manual = toy => enabled(toy) && toy.kind !== 'SPRING' && toy.archetypeId !== 'AUTO_EXIT';
  const nextRandomState = state => (Math.imul(state, 1664525) + 1013904223) >>> 0;
  const randomState = board => board.randomState ?? 0x9e3779b9;
  const portalAt = (board, cell) => board.entities.find(e => active(e) && e.kind === 'PORTAL' && e.cells.some(c => c.x === cell.x && c.y === cell.y));
  function portalExits(board, portal, length, movingId) {
    const occ = occupied(board, movingId), exits = [];
    for (const [direction, d] of Object.entries(directions)) for (let lane = 0; lane < 2; lane++) {
      const tail = direction === 'LEFT' ? { x: portal.x - 1, y: portal.y + lane }
        : direction === 'RIGHT' ? { x: portal.x + 2, y: portal.y + lane }
        : direction === 'UP' ? { x: portal.x + lane, y: portal.y - 1 }
        : { x: portal.x + lane, y: portal.y + 2 };
      const cells = Array.from({ length }, (_, i) => ({ x: tail.x + d.x * i, y: tail.y + d.y * i }));
      if (cells.every(c => inside(board, c) && !occ.has(key(c.x, c.y)) && !portalAt(board, c))) exits.push({ direction, cells, lane });
    }
    return exits;
  }
  function pickPortalExit(options, state, bySide = false) {
    if (bySide) {
      const sides = [...new Set(options.map(e => e.direction))];
      const side = pickPortalExit(sides.map(direction => ({ direction })), state);
      return pickPortalExit(options.filter(e => e.direction === side.exit.direction), side.randomState);
    }
    const next = nextRandomState(state);
    let sample = next ^ (next >>> 16);
    sample = Math.imul(sample, 0x7feb352d); sample ^= sample >>> 15;
    sample = Math.imul(sample, 0x846ca68b); sample ^= sample >>> 16;
    return { exit: options[Math.floor((sample >>> 0) / 4294967296 * options.length)], randomState: next };
  }
  function occupied(board, except = null) {
    const result = new Map();
    for (const entity of [...board.toys, ...board.entities]) {
      if (!active(entity) || entity.id === except || floor(entity)) continue;
      for (const cell of entity.cells) result.set(key(cell.x, cell.y), entity.id);
    }
    return result;
  }
  function position(entity, cells) {
    entity.cells = cells;
    entity.x = Math.min(...cells.map(c => c.x));
    entity.y = Math.min(...cells.map(c => c.y));
  }
  function gateAt(board, cell) { return board.entities.find(e => active(e) && e.kind === 'ONE_WAY_EXIT' && e.x === cell.x && e.y === cell.y); }
  function boundaryExit(board, cell, direction) {
    const gate = gateAt(board, cell);
    return !gate || gate.direction === direction;
  }
  // A zone proposes a complete transaction against one snapshot. Every destination
  // must be legal; a blocked convoy cancels as a whole, including all followers.
  function zoneAction(board, zone) {
    const inZone = c => zone.cells.some(p => p.x === c.x && p.y === c.y);
    const toys = board.toys.filter(t => active(t) && t.cells.every(inZone) && (zone.kind === 'CONVEYOR' || t.archetypeId !== 'AUTO_EXIT'));
    const proposals = toys.map(toy => {
      const direction = zone.kind === 'ROTATOR' ? (zone.clockwise ? rotated[toy.direction] : Object.keys(rotated).find(k => rotated[k] === toy.direction)) : toy.direction;
      const d = directions[zone.direction];
      const oldD = directions[toy.direction];
      const head = oldD && toy.cells.reduce((a, b) => a.x * oldD.x + a.y * oldD.y > b.x * oldD.x + b.y * oldD.y ? a : b);
      const cells = zone.kind === 'CONVEYOR' ? toy.cells.map(c => ({ x: c.x + d.x, y: c.y + d.y }))
        : Array.from({ length: toy.cells.length }, (_, i) => ({ x: head.x - directions[direction].x * i, y: head.y - directions[direction].y * i }));
      return { toy, direction, cells };
    });
    const selected = new Set(toys.map(t => t.id));
    const outside = occupied(board);
    for (const [cell, id] of outside) if (selected.has(id)) outside.delete(cell);
    const destinations = new Set();
    for (const p of proposals) for (const c of p.cells) {
      const k = key(c.x, c.y);
      if (!inside(board, c) || (zone.kind === 'ROTATOR' && !inZone(c)) || outside.has(k) || destinations.has(k)) return { moved: [], blocked: true };
      destinations.add(k);
    }
    const moved = proposals.map(p => ({ id: p.toy.id, from: copy(p.toy.cells), fromDirection: p.toy.direction, cells: copy(p.cells), direction: p.direction }));
    for (const p of proposals) { position(p.toy, p.cells); p.toy.direction = p.direction; }
    return { moved, blocked: false };
  }
  function duckPath(board, toy) {
    const occ = occupied(board, toy.id), queue = [{ x: toy.x, y: toy.y, parent: -1 }];
    const seen = new Set([key(toy.x, toy.y)]);
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      if (c.x === 0 || c.y === 0 || c.x === board.cols - 1 || c.y === board.rows - 1) {
        const path = [];
        for (let n = i; n !== -1; n = queue[n].parent) path.unshift({ x: queue[n].x, y: queue[n].y, ...(queue[n].portal ? { portal: queue[n].portal } : {}) });
        const outward = Object.entries(directions).find(([name, d]) => !inside(board, { x: c.x + d.x, y: c.y + d.y }) && boundaryExit(board, c, name));
        if (outward) { path.push({ x: c.x + outward[1].x, y: c.y + outward[1].y }); return path; }
      }
      for (const d of Object.values(directions)) {
        const n = { x: c.x + d.x, y: c.y + d.y, parent: i }, k = key(n.x, n.y);
        if (!inside(board, n) || occ.has(k) || seen.has(k)) continue;
        if (board.portalRandomization) {
          const portal = portalAt(board, n);
          if (portal) {
            const partner = board.entities.find(e => active(e) && e.kind === 'PORTAL' && e.id !== portal.id && e.pairId === portal.pairId);
            if (!partner) continue;
            for (const exit of portalExits(board, partner, 1, toy.id)) {
              const cell = exit.cells[0], marker = key(cell.x, cell.y);
              if (seen.has(marker)) continue;
              seen.add(marker); queue.push({ ...cell, parent: i, portal: { from: portal.id, to: partner.id } });
            }
            continue;
          }
        }
        seen.add(k); queue.push(n);
      }
    }
    return null;
  }
  function duckRoute(board, toy) {
    let current = { ...toy, cells: copy(toy.cells) }, rng = randomState(board);
    const path = [{ x: toy.x, y: toy.y }], portals = [], visited = new Set();
    while (true) {
      const route = duckPath(board, current);
      if (!route) return portals.length ? { path, portals, randomState: rng, exitsBoard: false } : null;
      const index = route.findIndex(c => c.portal);
      if (index < 0) return { path: [...path, ...route.slice(1)], portals, randomState: rng, exitsBoard: true };
      const transfer = route[index].portal;
      if (visited.has(transfer.from)) return portals.length ? { path, portals, randomState: rng, exitsBoard: false } : null;
      visited.add(transfer.from);
      const partner = board.entities.find(e => e.id === transfer.to);
      const selected = pickPortalExit(portalExits(board, partner, 1, toy.id), rng, true);
      rng = selected.randomState;
      path.push(...route.slice(1, index), { ...selected.exit.cells[0], portal: transfer });
      portals.push({ ...transfer, direction: selected.exit.direction, lane: selected.exit.lane });
      current = { ...current, ...selected.exit.cells[0], cells: copy(selected.exit.cells) };
    }
  }
  function scan(board, toy) {
    const blocked = { emptySteps: 0, exitsBoard: false, blockerId: null, cells: toy.cells, direction: toy.direction, travel: [], portals: [], randomState: randomState(board) };
    if (!enabled(toy)) return blocked;
    if (toy.archetypeId === 'AUTO_EXIT') return { ...blocked, exitsBoard: !!duckPath(board, toy) };
    let direction = toy.direction, d = directions[direction], rng = randomState(board);
    const occ = occupied(board, toy.id);
    let cells = copy(toy.cells), steps = 0;
    const travel = [], portals = [], seen = new Set();
    while (true) {
      const head = cells.reduce((a, b) => a.x * d.x + a.y * d.y > b.x * d.x + b.y * d.y ? a : b);
      const n = { x: head.x + d.x, y: head.y + d.y };
      const result = { emptySteps: steps, exitsBoard: false, blockerId: null, cells, direction, travel, portals, randomState: rng };
      if (!inside(board, n)) return boundaryExit(board, head, direction) ? { ...result, exitsBoard: true, gateId: gateAt(board, head)?.id }
        : { ...result, blockerId: gateAt(board, head)?.id, gateBlocked: true };
      const marker = `${cells.map(c => key(c.x, c.y)).sort().join('|')}:${direction}`;
      if (seen.has(marker) || seen.size > board.cols * board.rows * 4) return { ...result, blockerId: portalAt(board, n)?.id || null, loop: true };
      seen.add(marker);
      if (occ.has(key(n.x, n.y))) return { ...result, blockerId: occ.get(key(n.x, n.y)) };
      const portal = portalAt(board, n);
      if (portal) {
        const partner = board.entities.find(e => active(e) && e.kind === 'PORTAL' && e.id !== portal.id && e.pairId === portal.pairId);
        if (!partner) return { ...result, blockerId: portal.id };
        const options = portalExits(board, partner, cells.length, toy.id);
        if (!options.length) return { ...result, blockerId: portal.id };
        const selected = pickPortalExit(options, rng, board.portalRandomization === 'UNIFORM_VALID_SIDE_THEN_TRACK'); rng = selected.randomState;
        cells = selected.exit.cells; direction = selected.exit.direction; d = directions[direction];
        portals.push({ from: portal.id, to: partner.id, direction, lane: selected.exit.lane });
        travel.push({ cells: copy(cells), direction, teleport: true, from: portal.id, to: partner.id });
      } else {
        cells = cells.map(c => ({ x: c.x + d.x, y: c.y + d.y }));
        travel.push({ cells: copy(cells), direction, teleport: false });
      }
      steps++;
    }
  }
  function settle(board, seeds = []) {
    const queue = [...seeds], events = [], springContacts = new Set(), transferredDucks = new Set();
    const emit = (type, source, target = null, extra = {}, depth = 1) => queue.push({ type, source, target, depth, ...extra });
    let round = 0;
    while (true) {
      while (queue.length) {
        const event = queue.shift(); events.push(event);
        const source = [...board.toys, ...board.entities].find(t => t.id === event.source);
        const target = [...board.entities, ...board.toys].find(t => t.id === event.target);
        if (event.type === 'ON_EXIT') {
          const firstExit = source && source.state === 'EXITING' && !source.exitCounted;
          if (firstExit) source.exitCounted = true;
          for (const toy of board.toys.filter(active)) {
            if (toy.sleeping && firstExit) {
              toy.sleepRemaining--;
              emit('ON_SLEEP_COUNT', event.source, toy.id, { remaining: toy.sleepRemaining }, event.depth + 1);
              if (toy.sleepRemaining === 0) {
                toy.sleeping = false; emit('ON_WAKE', event.source, toy.id, {}, event.depth + 2);
              }
            }
            if (toy.hugLocked && toy.hugSource === event.source) {
              toy.hugLocked = false; toy.pairId = null;
              emit('ON_UNLOCK', event.source, toy.id, {}, event.depth + 1);
            }
          }
          for (const lock of board.entities.filter(e => active(e) && e.kind === 'LOCK_BOX' && source?.keyId && e.keyId === source.keyId)) {
            lock.state = 'DESTROYED'; emit('ON_UNLOCK', event.source, lock.id, {}, event.depth + 1);
            emit('ON_OCCUPANCY_CHANGE', lock.id, null, {}, event.depth + 2);
          }
        }
        if (event.type === 'ON_COLLIDE' && target && active(target)) {
          if (target.kind === 'ONE_WAY_EXIT') emit('ON_GATE_BLOCKED', event.source, target.id, {}, event.depth + 1);
          if (target.ice > 0) {
            target.ice--; emit('ON_ICE_DAMAGE', event.source, target.id, { ice: target.ice }, event.depth + 1);
            if (!target.ice) emit('ON_THAW', event.source, target.id, {}, event.depth + 2);
          }
          if (target.kind === 'BOX') {
            target.hp--; emit('DAMAGE', event.source, target.id, { hp: target.hp }, event.depth + 1);
            if (target.hp === 0) {
              target.state = 'DESTROYED'; emit('ON_DESTROY', event.source, target.id, {}, event.depth + 2);
              emit('ON_OCCUPANCY_CHANGE', target.id, null, {}, event.depth + 3);
            }
          }
          if (target.kind === 'SPRING') {
            const contact = `${event.source}:${target.id}`;
            if (target.ownDirection && springContacts.has(contact)) continue;
            springContacts.add(contact);
            // A hit supplies the direction. The spring slides to the next blocker
            // (including portal routing), and never retracts or moves on a click.
            const springDirection = target.ownDirection ? target.direction : event.direction;
            const path = scan(board, { ...target, direction: springDirection });
            if (path.emptySteps || path.exitsBoard) {
              const from = copy(target.cells), fromDirection = springDirection;
              position(target, copy(path.cells)); target.direction = path.direction;
              board.randomState = path.randomState;
              target.pushes = (target.pushes || 0) + 1;
              emit('ON_PUSH', event.source, target.id, { from, fromDirection, cells: copy(target.cells),
                direction: target.direction, travel: path.travel, exitsBoard: path.exitsBoard }, event.depth + 1);
              for (const p of path.portals) emit('TELEPORT', target.id, p.from, { destination: p.to, direction: p.direction, lane: p.lane }, event.depth + 1);
              if (path.exitsBoard) {
                target.state = 'EXITING';
                emit('ON_SPRING_EXIT', target.id, null, {}, event.depth + 1);
                emit('ON_EXIT', target.id, null, {}, event.depth + 2);
                if (path.gateId) emit('ON_GATE_PASS', target.id, path.gateId, {}, event.depth + 1);
              }
              emit('ON_OCCUPANCY_CHANGE', target.id, null, {}, event.depth + 2);
            }
            if (target.ownDirection && path.blockerId && path.blockerId !== event.source) emit('ON_COLLIDE', target.id, path.blockerId, { direction: path.direction }, event.depth + 2);
          }
        }
        if (event.type === 'ON_TURN') {
          for (const zone of board.entities.filter(e => active(e) && ['CONVEYOR', 'ROTATOR'].includes(e.kind)).sort((a, b) => a.id.localeCompare(b.id))) {
            zone.phase = ((zone.phase || 0) + 1) % zone.period;
            if (zone.phase) continue;
            const result = zoneAction(board, zone);
            emit(result.blocked ? 'ON_ZONE_BLOCKED' : zone.kind === 'CONVEYOR' ? 'ON_CONVEY' : 'ON_ROTATE', event.source, zone.id, { moved: result.moved }, event.depth + 1);
            if (result.moved.length) emit('ON_OCCUPANCY_CHANGE', zone.id, null, {}, event.depth + 2);
          }
        }
      }
      // Select a whole duck wave against the same occupancy snapshot, then resolve triggers.
      const wave = board.toys.filter(t => enabled(t) && t.archetypeId === 'AUTO_EXIT' && !transferredDucks.has(t.id))
        .map(toy => ({ toy, route: board.portalRandomization ? duckRoute(board, toy) : null, path: board.portalRandomization ? null : duckPath(board, toy) })).filter(item => item.route || item.path);
      if (!wave.length) break;
      round++;
      const depth = Math.max(0, ...events.map(e => e.depth || 0)) + 1;
      if (!board.portalRandomization) wave.forEach(({ toy }) => { toy.state = 'EXITING'; });
      for (const item of wave) {
        const { toy } = item, route = board.portalRandomization ? duckRoute(board, toy) : null;
        if (board.portalRandomization && !route) continue;
        const path = route?.path || item.path;
        if (route) {
          board.randomState = route.randomState;
          for (const p of route.portals) emit('TELEPORT', toy.id, p.from, { destination: p.to, direction: p.direction, lane: p.lane }, depth);
          if (!route.exitsBoard) {
            transferredDucks.add(toy.id);
            const initial = copy(toy), last = path.at(-1);
            position(toy, [{ x: last.x, y: last.y }]);
            emit('ON_DUCK_TRANSFER', toy.id, null, { path, toy: initial }, depth);
            emit('ON_OCCUPANCY_CHANGE', toy.id, null, {}, depth + 1);
            continue;
          }
          toy.state = 'EXITING';
        }
        emit('ON_AUTO_EXIT', toy.id, null, { toy: copy(toy), path, round }, depth);
        const gate = gateAt(board, path[path.length - 2]);
        if (gate) emit('ON_GATE_PASS', toy.id, gate.id, {}, depth);
        emit('ON_EXIT', toy.id, null, {}, depth + 1);
        emit('ON_OCCUPANCY_CHANGE', toy.id, null, {}, depth + 1);
      }
    }
    return events;
  }
  function click(board, id) {
    const toy = board.toys.find(t => t.id === id);
    if (!toy || !manual(toy)) return { changed: false, events: [], scan: null };
    const path = scan(board, toy), before = hash(board), seeds = [];
    if (path.loop && !path.emptySteps) return { changed: false, events: [], scan: path };
    if (path.emptySteps) {
      const from = copy(toy.cells); position(toy, copy(path.cells)); toy.direction = path.direction;
      board.randomState = path.randomState;
      seeds.push({ type: 'ON_SHIFT', source: id, from, cells: copy(toy.cells), depth: 0 });
      seeds.push({ type: 'ON_OCCUPANCY_CHANGE', source: id, depth: 1 });
    }
    for (const p of path.portals) seeds.push({ type: 'TELEPORT', source: id, target: p.from, destination: p.to, direction: p.direction, lane: p.lane, depth: 1 });
    if (path.exitsBoard) {
      toy.state = 'EXITING';
      seeds.push({ type: 'MANUAL_EXIT', source: id, toy: copy(toy), depth: 0 }, { type: 'ON_EXIT', source: id, depth: 1 }, { type: 'ON_OCCUPANCY_CHANGE', source: id, depth: 1 });
      if (path.gateId) seeds.push({ type: 'ON_GATE_PASS', source: id, target: path.gateId, depth: 1 });
    } else if (path.blockerId) seeds.push({ type: 'ON_COLLIDE', source: id, target: path.blockerId, direction: toy.direction, depth: 0 });
    if (board.entities.some(e => ['CONVEYOR', 'ROTATOR'].includes(e.kind))) seeds.push({ type: 'ON_TURN', source: id, depth: 1 });
    const events = settle(board, seeds);
    return { changed: before !== hash(board), events, scan: path };
  }
  function hash(board) {
    return JSON.stringify([board.toys.map(t => [t.id, t.state, t.x, t.y, t.direction, t.sleeping || false, t.sleepRemaining || 0, t.exitCounted || false, t.hugLocked || false, t.ice || 0]),
      board.entities.map(e => [e.id, e.state, e.x, e.y, e.direction, e.hp ?? null, e.exitCounted || false, e.phase || 0]), randomState(board)]);
  }
  function fromConfig(config) {
    const cells = e => Array.from({ length: e.footprint?.[1] || 1 }, (_, y) => Array.from({ length: e.footprint?.[0] || 1 }, (_, x) => ({ x: e.grid_position[0] + x, y: e.grid_position[1] + y }))).flat();
    const seed = config.generator?.seed ?? [...(config.level_id || 'TOYHOUSE')].reduce((value, char) => (Math.imul(value, 31) + char.charCodeAt(0)) >>> 0, 0x9e3779b9);
    const board = { cols: config.board_width, rows: config.board_height, randomState: seed >>> 0, portalRandomization: config.portal_randomization,
      toys: config.toy_list.map(e => ({ id: e.toy_id, archetypeId: e.archetype_id, direction: configDirections[e.direction] || null,
        x: e.grid_position[0], y: e.grid_position[1], cells: cells(e), state: 'IDLE',
        modifier: e.modifier || null, ice: e.modifier === 'FROZEN' ? e.ice_layers ?? 1 : 0, sleeping: e.modifier === 'SLEEPING', sleepRemaining: e.modifier === 'SLEEPING' ? e.wake_after_exits : 0,
        hugLocked: e.modifier === 'HUG_LOCKED', hugSource: e.hug_source || null,
        pairId: e.pair_id || null, keyId: e.key_id || null })),
      entities: (config.board_entities || []).map(e => ({ id: e.entity_id, kind: e.kind, x: e.grid_position[0], y: e.grid_position[1],
        cells: cells(e), state: 'IDLE', hp: e.kind === 'BOX' ? e.hp ?? 2 : undefined, pairId: e.pair_id || null, keyId: e.key_id || null,
        direction: configDirections[e.direction] || e.direction || null, ownDirection: !!e.own_direction, countsTowardClear: !!e.counts_toward_level_clear,
        maxHp: e.max_hp ?? 3, period: e.period ?? 1, phase: e.phase ?? 0, clockwise: e.clockwise !== false })) };
    return board;
  }
  function validate(board) {
    const errors = [], ids = new Set(), occ = new Set();
    if (!Number.isInteger(board.cols) || !Number.isInteger(board.rows) || board.cols < 1 || board.rows < 1) errors.push('INVALID_BOARD');
    for (const e of [...board.toys, ...board.entities]) {
      if (!e.id || ids.has(e.id)) errors.push(`DUPLICATE_ID:${e.id}`); ids.add(e.id);
      if (!e.cells.length || e.cells.some(c => !Number.isInteger(c.x) || !Number.isInteger(c.y) || !inside(board, c))) errors.push(`INVALID_CELLS:${e.id}`);
      if (active(e) && !floor(e)) for (const c of e.cells) { const k = key(c.x, c.y); if (occ.has(k)) errors.push(`OVERLAP:${e.id}`); occ.add(k); }
      if (e.kind && !['BOX', 'SPRING', 'LOCK_BOX', 'PORTAL', 'ONE_WAY_EXIT', 'CONVEYOR', 'ROTATOR'].includes(e.kind)) errors.push(`UNKNOWN_MECHANIC:${e.id}`);
      if (e.kind === 'ONE_WAY_EXIT' && (e.cells.length !== 1 || !directions[e.direction] || !(e.x === 0 || e.y === 0 || e.x === board.cols - 1 || e.y === board.rows - 1))) errors.push(`INVALID_EXIT:${e.id}`);
      if (e.kind === 'ONE_WAY_EXIT' && board.entities.some(other => other !== e && other.kind === e.kind && other.x === e.x && other.y === e.y)) errors.push(`DUPLICATE_EXIT:${e.id}`);
      if (['CONVEYOR', 'ROTATOR'].includes(e.kind)) {
        if (!Number.isInteger(e.period) || e.period < 1 || e.period > 8 || !Number.isInteger(e.phase) || e.phase < 0 || e.phase >= e.period) errors.push(`INVALID_PERIOD:${e.id}`);
        if (e.kind === 'CONVEYOR' && !directions[e.direction]) errors.push(`INVALID_CONVEYOR:${e.id}`);
        const width = Math.max(...e.cells.map(c => c.x)) - e.x + 1, height = Math.max(...e.cells.map(c => c.y)) - e.y + 1;
        if (e.kind === 'ROTATOR' && (width !== height || ![3, 4].includes(width) || e.cells.length !== width * height)) errors.push(`INVALID_ROTATOR:${e.id}`);
        if (board.entities.some(other => other !== e && ['CONVEYOR', 'ROTATOR'].includes(other.kind) && other.cells.some(c => e.cells.some(p => p.x === c.x && p.y === c.y)))) errors.push(`OVERLAPPING_ZONE:${e.id}`);
      }
      if (['BOX', 'SPRING'].includes(e.kind) && e.cells.length !== 1) errors.push(`INVALID_FOOTPRINT:${e.id}`);
      if (e.kind === 'PORTAL') {
        const footprint = [0, 1].flatMap(dy => [0, 1].map(dx => key(e.x + dx, e.y + dy)));
        if (e.cells.length !== 4 || footprint.some(cell => !e.cells.some(c => key(c.x, c.y) === cell))) errors.push(`INVALID_FOOTPRINT:${e.id}`);
        if ([...board.toys, ...board.entities].some(other => other !== e && active(other) && other.cells.some(c => e.cells.some(p => p.x === c.x && p.y === c.y)))) errors.push(`OVERLAP_PORTAL:${e.id}`);
      }
      if (e.kind === 'BOX' && active(e) && (!Number.isInteger(e.hp) || e.hp < 1 || e.hp > (e.maxHp ?? 3))) errors.push(`INVALID_HP:${e.id}`);
      if (e.kind === 'LOCK_BOX' && (!e.keyId || !board.toys.some(t => t.keyId === e.keyId))) errors.push(`MISSING_KEY:${e.id}`);
      if (e.kind === 'LOCK_BOX' && ![1, 2].includes(e.cells.length)) errors.push(`INVALID_FOOTPRINT:${e.id}`);
      if (e.kind === 'PORTAL' && (!e.pairId || board.entities.filter(p => p.kind === 'PORTAL' && p.pairId === e.pairId).length !== 2)) errors.push(`INVALID_PORTAL_PAIR:${e.id}`);
      if (e.archetypeId) {
        const length = { ORDINARY: 2, LARGE: 3, AUTO_EXIT: 1 }[e.archetypeId];
        if (e.modifier && !['SLEEPING', 'HUG_LOCKED', 'KEY_CARRIER', 'FROZEN'].includes(e.modifier)) errors.push(`UNKNOWN_MODIFIER:${e.id}`);
        if (e.sleeping && (!Number.isInteger(e.sleepRemaining) || e.sleepRemaining < 1 || e.sleepRemaining > board.toys.length - 1 || length === 1)) errors.push(`INVALID_WAKE_COUNT:${e.id}`);
        if ((e.ice || e.modifier === 'FROZEN') && (!Number.isInteger(e.ice) || e.ice < 0 || e.ice > 2 || e.archetypeId === 'AUTO_EXIT')) errors.push(`INVALID_ICE:${e.id}`);
        const d = directions[e.direction];
        if (!length || e.cells.length !== length || (length === 1 ? e.direction !== null : !d)) errors.push(`INVALID_TOY:${e.id}`);
        if (d && e.cells.some(c => d.x ? c.y !== e.y : c.x !== e.x)) errors.push(`INVALID_DIRECTION:${e.id}`);
        if (d) {
          const axis = e.cells.map(c => d.x ? c.x : c.y).sort((a, b) => a - b);
          if (axis.some((n, i) => n !== axis[0] + i)) errors.push(`NONCONTIGUOUS_TOY:${e.id}`);
        }
        if (e.hugLocked) {
          const source = e.hugSource;
          if (!source || source === e.id || !board.toys.some(t => t.id === source) || length === 1) errors.push(`MISSING_TRIGGER:${e.id}`);
        }
        if (e.hugLocked && (!e.pairId || board.toys.filter(t => t.pairId === e.pairId).length !== 2 || !board.toys.some(t => t.id === e.hugSource && t.pairId === e.pairId && !t.hugLocked))) errors.push(`INVALID_HUG_PAIR:${e.id}`);
      }
    }
    return errors;
  }
  function solve(source, { maxNodes = 12000, requireMechanics = false } = {}) {
    const errors = validate(source);
    if (errors.length) return { status: 'INVALID', solvable: false, errors, actions: [], nodes: 0 };
    const start = copy(source); const initialEvents = settle(start);
    const required = requireMechanics ? source.entities.map(e => e.kind === 'PORTAL' ? `portal:${e.pairId}` : e.id) : [];
    const seen = new Set(); let nodes = 0, limited = false;
    const initialCoverage = new Set(initialEvents.filter(e => ['ON_PUSH', 'ON_DESTROY', 'ON_UNLOCK', 'ON_GATE_PASS'].includes(e.type)).map(e => e.target));
    const stack = [{ board: start, actions: [], coverage: initialCoverage }];
    while (stack.length) {
      const current = stack.pop(), { board, actions, coverage } = current;
      const signature = hash(board) + (requireMechanics ? [...coverage].sort().join('|') : '');
      if (seen.has(signature)) continue;
      if (++nodes > maxNodes) { limited = true; break; }
      seen.add(signature);
      if (board.toys.every(t => !active(t))) {
        if (required.every(id => coverage.has(id))) return { status: 'SOLVED', solvable: true, actions, nodes };
        continue;
      }
      const candidates = [];
      for (const toy of board.toys.filter(manual)) {
        const next = copy(board), result = click(next, toy.id);
        if (!result.changed) continue;
        const cov = new Set(coverage);
        for (const event of result.events) {
          if (['ON_PUSH', 'ON_DESTROY', 'ON_UNLOCK', 'ON_GATE_PASS'].includes(event.type) || (['ON_CONVEY', 'ON_ROTATE'].includes(event.type) && event.moved.length)) cov.add(event.target);
          if (event.type === 'TELEPORT') cov.add(`portal:${board.entities.find(e => e.id === event.target).pairId}`);
        }
        const releases = result.events.filter(e => ['MANUAL_EXIT', 'ON_AUTO_EXIT'].includes(e.type)).length;
        const productive = result.events.some(e => ['DAMAGE', 'ON_PUSH'].includes(e.type));
        candidates.push({ board: next, actions: [...actions, toy.id], coverage: cov, score: (cov.size - coverage.size) * 100 + releases * 10 + (productive ? 4 : 0) });
      }
      candidates.sort((a, b) => a.score - b.score);
      stack.push(...candidates);
    }
    return { status: limited ? 'UNKNOWN' : 'DEADLOCK', solvable: limited ? null : false, actions: [], nodes };
  }
  function replay(source, actions) {
    const board = copy(source), turns = [settle(board)];
    for (const id of actions) turns.push(click(board, id).events);
    return { board, turns };
  }
  function graph(board) {
    const edges = [];
    for (const toy of board.toys.filter(active)) {
      // Inspect blocking independently of whether the target is currently sleeping.
      const path = scan(board, { ...toy, sleeping: false, hugLocked: false, ice: 0 });
      if (path.blockerId) {
        edges.push({ source: path.blockerId, target: toy.id, type: 'BLOCKS' });
        const blocker = board.entities.find(e => e.id === path.blockerId);
        if (blocker && ['BOX', 'SPRING'].includes(blocker.kind)) edges.push({ source: toy.id, target: blocker.id, type: blocker.kind === 'BOX' ? 'HIT' : 'PUSH' });
      }
      if (toy.sleeping) edges.push({ source: 'ANY_TOY_EXIT', target: toy.id, type: `EXIT_COUNT_${toy.sleepRemaining}` });
      if (toy.hugLocked) edges.push({ source: toy.hugSource, target: toy.id, type: 'EXIT_UNLOCK' });
      if (toy.keyId) for (const e of board.entities.filter(e => active(e) && e.keyId === toy.keyId)) edges.push({ source: toy.id, target: e.id, type: 'EXIT_UNLOCK' });
      if (path.blockerId && board.toys.some(t => t.id === path.blockerId && t.ice > 0)) edges.push({ source: toy.id, target: path.blockerId, type: 'HIT_THAW' });
      for (const zone of board.entities.filter(e => ['CONVEYOR', 'ROTATOR'].includes(e.kind) && toy.cells.every(c => e.cells.some(p => p.x === c.x && p.y === c.y)))) edges.push({ source: zone.id, target: toy.id, type: zone.kind === 'CONVEYOR' ? 'MOVE' : 'ROTATE' });
    }
    return edges;
  }
  function analyze(board, { shift = false, maxNodes = 12000 } = {}) {
    const solution = solve(board, { maxNodes });
    const { turns } = replay(board, solution.actions);
    const releaseGraph = [], observedDepth = new Map(), releaseCurve = [];
    const working = copy(board); settle(working);
    const readyIds = b => b.toys.filter(t => manual(t) && scan(b, t).exitsBoard).map(t => t.id);
    for (const id of solution.actions) {
      const before = new Set(readyIds(working));
      const result = click(working, id);
      const released = readyIds(working).filter(next => !before.has(next));
      for (const target of released) {
        releaseGraph.push({ source: id, target, type: 'ACTION_RELEASES' });
        observedDepth.set(target, Math.max(observedDepth.get(target) || 0, (observedDepth.get(id) || 0) + 1));
      }
      for (const e of result.events.filter(e => ['ON_WAKE', 'ON_UNLOCK', 'ON_PUSH', 'ON_DESTROY', 'ON_THAW', 'ON_CONVEY', 'ON_ROTATE'].includes(e.type))) {
        observedDepth.set(e.target, Math.max(observedDepth.get(e.target) || 0, (observedDepth.get(e.source) || 0) + 1));
      }
      releaseCurve.push({ action: id, ready: readyIds(working).length, released: released.length });
    }
    const cascades = turns.map(events => ({ length: events.length, toyRelease: events.filter(e => ['MANUAL_EXIT', 'ON_AUTO_EXIT'].includes(e.type)).length,
      mechanicCount: events.filter(e => ['ON_WAKE', 'ON_UNLOCK', 'ON_PUSH', 'ON_DESTROY', 'TELEPORT', 'ON_THAW', 'ON_GATE_PASS', 'ON_CONVEY', 'ON_ROTATE'].includes(e.type) && (!e.moved || e.moved.length)).length,
      depth: Math.max(0, ...events.map(e => e.depth || 0)) }));
    const shiftSafety = { opportunities: 0, safe: 0, trap: 0, unknown: 0, productive: 0, cascade: 0, rate: null };
    const ready = b => b.toys.filter(t => manual(t) && scan(b, t).exitsBoard).length;
    if (shift) for (const toy of board.toys.filter(manual)) {
      const path = scan(board, toy);
      if (path.exitsBoard || !path.emptySteps) continue;
      shiftSafety.opportunities++;
      const next = copy(board), result = click(next, toy.id), answer = solve(next, { maxNodes });
      shiftSafety[answer.solvable === true ? 'safe' : answer.solvable === false ? 'trap' : 'unknown']++;
      if (ready(next) > ready(board)) shiftSafety.productive++;
      if (result.events.some(e => ['DAMAGE', 'ON_PUSH', 'ON_AUTO_EXIT', 'ON_UNLOCK', 'ON_WAKE', 'ON_THAW', 'ON_CONVEY', 'ON_ROTATE'].includes(e.type) && (!e.moved || e.moved.length))) shiftSafety.cascade++;
    }
    if (shiftSafety.opportunities && !shiftSafety.unknown) shiftSafety.rate = shiftSafety.safe / shiftSafety.opportunities;
    const special = board.entities.length + board.toys.filter(t => t.sleeping || t.hugLocked || t.pairId || t.keyId || t.ice).length;
    return { ...solution, initialExitCount: ready(board), toyCount: board.toys.length,
      occupancy: [...board.toys, ...board.entities].filter(e => e.kind !== 'PORTAL').reduce((n, t) => n + t.cells.length, 0) / (board.cols * board.rows),
      mechanicDensity: special / (board.toys.length + board.entities.length), cascades,
      maxCascade: Math.max(0, ...cascades.map(c => c.toyRelease)), cascadeDepth: Math.max(0, ...cascades.map(c => c.depth)),
      shiftSafety, graph: graph(board), releaseGraph, releaseCurve, observedDependencyDepth: Math.max(0, ...observedDepth.values()) };
  }
  return { directions, copy, active, enabled, manual, floor, occupied, position, zoneAction, duckPath, portalExits, scan, settle, click, hash, fromConfig, validate, solve, replay, graph, analyze };
})();
export default Mechanics;
