// Deterministic rules shared by play, authoring, generation and search.
const Mechanics = (() => {
  const directions = { LEFT: { x: -1, y: 0 }, RIGHT: { x: 1, y: 0 }, UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 } };
  const configDirections = { L: 'LEFT', R: 'RIGHT', U: 'UP', D: 'DOWN' };
  const copy = value => structuredClone(value);
  const key = (x, y) => `${x},${y}`;
  const active = entity => entity.state === 'IDLE';
  const inside = (board, cell) => cell.x >= 0 && cell.y >= 0 && cell.x < board.cols && cell.y < board.rows;
  const enabled = toy => active(toy) && !toy.sleeping && !toy.hugLocked;
  const manual = toy => enabled(toy) && toy.archetypeId !== 'AUTO_EXIT';
  function occupied(board, except = null) {
    const result = new Map();
    for (const entity of [...board.toys, ...board.entities]) {
      if (!active(entity) || entity.id === except || entity.kind === 'PORTAL') continue;
      for (const cell of entity.cells) result.set(key(cell.x, cell.y), entity.id);
    }
    return result;
  }
  function position(entity, cells) {
    entity.cells = cells;
    entity.x = Math.min(...cells.map(c => c.x));
    entity.y = Math.min(...cells.map(c => c.y));
  }
  function duckPath(board, toy) {
    const occ = occupied(board, toy.id), queue = [{ x: toy.x, y: toy.y, parent: -1 }];
    const seen = new Set([key(toy.x, toy.y)]);
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      if (c.x === 0 || c.y === 0 || c.x === board.cols - 1 || c.y === board.rows - 1) {
        const path = [];
        for (let n = i; n !== -1; n = queue[n].parent) path.unshift({ x: queue[n].x, y: queue[n].y });
        const dx = c.x === 0 ? -1 : c.x === board.cols - 1 ? 1 : 0;
        path.push({ x: c.x + dx, y: c.y + (dx ? 0 : c.y === 0 ? -1 : 1) });
        return path;
      }
      for (const d of Object.values(directions)) {
        const n = { x: c.x + d.x, y: c.y + d.y, parent: i }, k = key(n.x, n.y);
        if (!inside(board, n) || occ.has(k) || seen.has(k)) continue;
        seen.add(k); queue.push(n);
      }
    }
    return null;
  }
  function scan(board, toy) {
    const blocked = { emptySteps: 0, exitsBoard: false, blockerId: null, cells: toy.cells, travel: [], portals: [] };
    if (!enabled(toy)) return blocked;
    if (toy.archetypeId === 'AUTO_EXIT') return { ...blocked, exitsBoard: !!duckPath(board, toy) };
    const d = directions[toy.direction], occ = occupied(board, toy.id);
    let cells = copy(toy.cells), steps = 0;
    const travel = [], portals = [], seen = new Set();
    while (true) {
      const head = cells.reduce((a, b) => a.x * d.x + a.y * d.y > b.x * d.x + b.y * d.y ? a : b);
      const n = { x: head.x + d.x, y: head.y + d.y };
      const result = { emptySteps: steps, exitsBoard: false, blockerId: null, cells, travel, portals };
      if (!inside(board, n)) return { ...result, exitsBoard: true };
      const marker = key(head.x, head.y);
      // A teleport loop is not a partial move: leave the entire action unchanged.
      if (seen.has(marker)) return { ...blocked, loop: true };
      seen.add(marker);
      if (occ.has(key(n.x, n.y))) return { ...result, blockerId: occ.get(key(n.x, n.y)) };
      const portal = board.entities.find(e => active(e) && e.kind === 'PORTAL' && e.x === n.x && e.y === n.y);
      if (portal) {
        const partner = board.entities.find(e => active(e) && e.kind === 'PORTAL' && e.id !== portal.id && e.pairId === portal.pairId);
        if (!partner) return { ...result, blockerId: portal.id };
        const arrival = cells.map(c => ({ x: c.x + partner.x - head.x, y: c.y + partner.y - head.y }));
        if (arrival.some(c => !inside(board, c) || occ.has(key(c.x, c.y)))) return { ...result, blockerId: portal.id };
        cells = arrival;
        portals.push({ from: portal.id, to: partner.id });
        travel.push({ cells: copy(cells), teleport: true, from: portal.id, to: partner.id });
      } else {
        cells = cells.map(c => ({ x: c.x + d.x, y: c.y + d.y }));
        travel.push({ cells: copy(cells), teleport: false });
      }
      steps++;
    }
  }
  function settle(board, seeds = []) {
    const queue = [...seeds], events = [];
    const emit = (type, source, target = null, extra = {}, depth = 1) => queue.push({ type, source, target, depth, ...extra });
    let round = 0;
    while (true) {
      while (queue.length) {
        const event = queue.shift(); events.push(event);
        const source = board.toys.find(t => t.id === event.source);
        const target = [...board.entities, ...board.toys].find(t => t.id === event.target);
        if (event.type === 'ON_EXIT') {
          for (const toy of board.toys.filter(active)) {
            if (toy.sleeping && toy.wakeSource === event.source) {
              toy.sleeping = false; emit('ON_WAKE', event.source, toy.id, {}, event.depth + 1);
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
          if (target.kind === 'BOX') {
            target.hp--; emit('DAMAGE', event.source, target.id, { hp: target.hp }, event.depth + 1);
            if (target.hp === 0) {
              target.state = 'DESTROYED'; emit('ON_DESTROY', event.source, target.id, {}, event.depth + 2);
              emit('ON_OCCUPANCY_CHANGE', target.id, null, {}, event.depth + 3);
            }
          }
          if (target.kind === 'SPRING') {
            const d = directions[event.direction], dest = target.cells.map(c => ({ x: c.x + d.x, y: c.y + d.y }));
            const occ = occupied(board, target.id);
            if (dest.every(c => inside(board, c) && !occ.has(key(c.x, c.y)))) {
              const from = copy(target.cells); position(target, dest); target.pushes = (target.pushes || 0) + 1;
              emit('ON_PUSH', event.source, target.id, { from, cells: copy(dest) }, event.depth + 1);
              emit('ON_OCCUPANCY_CHANGE', target.id, null, {}, event.depth + 2);
            }
          }
        }
      }
      // Select a whole duck wave against the same occupancy snapshot, then resolve triggers.
      const wave = board.toys.filter(t => enabled(t) && t.archetypeId === 'AUTO_EXIT')
        .map(toy => ({ toy, path: duckPath(board, toy) })).filter(item => item.path);
      if (!wave.length) break;
      round++;
      const depth = Math.max(0, ...events.map(e => e.depth || 0)) + 1;
      wave.forEach(({ toy }) => { toy.state = 'EXITING'; });
      for (const { toy, path } of wave) {
        emit('ON_AUTO_EXIT', toy.id, null, { toy: copy(toy), path, round }, depth);
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
    if (path.loop) return { changed: false, events: [], scan: path };
    if (path.emptySteps) {
      const from = copy(toy.cells); position(toy, copy(path.cells));
      seeds.push({ type: 'ON_SHIFT', source: id, from, cells: copy(toy.cells), depth: 0 });
      seeds.push({ type: 'ON_OCCUPANCY_CHANGE', source: id, depth: 1 });
    }
    for (const p of path.portals) seeds.push({ type: 'TELEPORT', source: id, target: p.from, destination: p.to, depth: 1 });
    if (path.exitsBoard) {
      toy.state = 'EXITING';
      seeds.push({ type: 'MANUAL_EXIT', source: id, toy: copy(toy), depth: 0 }, { type: 'ON_EXIT', source: id, depth: 1 }, { type: 'ON_OCCUPANCY_CHANGE', source: id, depth: 1 });
    } else if (path.blockerId) seeds.push({ type: 'ON_COLLIDE', source: id, target: path.blockerId, direction: toy.direction, depth: 0 });
    const events = settle(board, seeds);
    return { changed: before !== hash(board), events, scan: path };
  }
  function hash(board) {
    return JSON.stringify([board.toys.map(t => [t.id, t.state, t.x, t.y, t.direction, t.sleeping || false, t.hugLocked || false]),
      board.entities.map(e => [e.id, e.state, e.x, e.y, e.hp ?? null])]);
  }
  function fromConfig(config) {
    const cells = e => Array.from({ length: e.footprint?.[1] || 1 }, (_, y) => Array.from({ length: e.footprint?.[0] || 1 }, (_, x) => ({ x: e.grid_position[0] + x, y: e.grid_position[1] + y }))).flat();
    return { cols: config.board_width, rows: config.board_height,
      toys: config.toy_list.map(e => ({ id: e.toy_id, archetypeId: e.archetype_id, direction: configDirections[e.direction] || null,
        x: e.grid_position[0], y: e.grid_position[1], cells: cells(e), state: 'IDLE',
        sleeping: e.modifier === 'SLEEPING', wakeSource: e.wake_source || null,
        hugLocked: e.modifier === 'HUG_LOCKED', hugSource: e.hug_source || null,
        pairId: e.pair_id || null, keyId: e.key_id || null })),
      entities: (config.board_entities || []).map(e => ({ id: e.entity_id, kind: e.kind, x: e.grid_position[0], y: e.grid_position[1],
        cells: cells(e), state: 'IDLE', hp: e.kind === 'BOX' ? e.hp ?? 2 : undefined, pairId: e.pair_id || null, keyId: e.key_id || null })) };
  }
  function validate(board) {
    const errors = [], ids = new Set(), occ = new Set();
    if (!Number.isInteger(board.cols) || !Number.isInteger(board.rows) || board.cols < 1 || board.rows < 1) errors.push('INVALID_BOARD');
    for (const e of [...board.toys, ...board.entities]) {
      if (!e.id || ids.has(e.id)) errors.push(`DUPLICATE_ID:${e.id}`); ids.add(e.id);
      if (!e.cells.length || e.cells.some(c => !Number.isInteger(c.x) || !Number.isInteger(c.y) || !inside(board, c))) errors.push(`INVALID_CELLS:${e.id}`);
      if (active(e) && e.kind !== 'PORTAL') for (const c of e.cells) { const k = key(c.x, c.y); if (occ.has(k)) errors.push(`OVERLAP:${e.id}`); occ.add(k); }
      if (e.kind && !['BOX', 'SPRING', 'LOCK_BOX', 'PORTAL'].includes(e.kind)) errors.push(`UNKNOWN_MECHANIC:${e.id}`);
      if (['BOX', 'SPRING', 'PORTAL'].includes(e.kind) && e.cells.length !== 1) errors.push(`INVALID_FOOTPRINT:${e.id}`);
      if (e.kind === 'BOX' && active(e) && (!Number.isInteger(e.hp) || e.hp < 1 || e.hp > 3)) errors.push(`INVALID_HP:${e.id}`);
      if (e.kind === 'LOCK_BOX' && (!e.keyId || !board.toys.some(t => t.keyId === e.keyId))) errors.push(`MISSING_KEY:${e.id}`);
      if (e.kind === 'PORTAL' && (!e.pairId || board.entities.filter(p => p.kind === 'PORTAL' && p.pairId === e.pairId).length !== 2)) errors.push(`INVALID_PORTAL_PAIR:${e.id}`);
      if (e.archetypeId) {
        const length = { ORDINARY: 2, LARGE: 3, AUTO_EXIT: 1 }[e.archetypeId];
        const d = directions[e.direction];
        if (!length || e.cells.length !== length || (length === 1 ? e.direction !== null : !d)) errors.push(`INVALID_TOY:${e.id}`);
        if (d && e.cells.some(c => d.x ? c.y !== e.y : c.x !== e.x)) errors.push(`INVALID_DIRECTION:${e.id}`);
        if (e.sleeping || e.hugLocked) {
          const source = e.sleeping ? e.wakeSource : e.hugSource;
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
    const start = copy(source); settle(start);
    const required = requireMechanics ? source.entities.map(e => e.kind === 'PORTAL' ? `portal:${e.pairId}` : e.id) : [];
    const seen = new Set(); let nodes = 0, limited = false;
    const stack = [{ board: start, actions: [], coverage: new Set() }];
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
          if (['ON_PUSH', 'ON_DESTROY', 'ON_UNLOCK'].includes(event.type)) cov.add(event.target);
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
      const path = scan(board, { ...toy, sleeping: false, hugLocked: false });
      if (path.blockerId) {
        edges.push({ source: path.blockerId, target: toy.id, type: 'BLOCKS' });
        const blocker = board.entities.find(e => e.id === path.blockerId);
        if (blocker && ['BOX', 'SPRING'].includes(blocker.kind)) edges.push({ source: toy.id, target: blocker.id, type: blocker.kind === 'BOX' ? 'HIT' : 'PUSH' });
      }
      if (toy.sleeping) edges.push({ source: toy.wakeSource, target: toy.id, type: 'EXIT_WAKE' });
      if (toy.hugLocked) edges.push({ source: toy.hugSource, target: toy.id, type: 'EXIT_UNLOCK' });
      if (toy.keyId) for (const e of board.entities.filter(e => active(e) && e.keyId === toy.keyId)) edges.push({ source: toy.id, target: e.id, type: 'EXIT_UNLOCK' });
    }
    return edges;
  }
  function analyze(board, { shift = false, maxNodes = 12000 } = {}) {
    const solution = solve(board, { maxNodes });
    const { turns } = replay(board, solution.actions);
    const cascades = turns.map(events => ({ length: events.length, toyRelease: events.filter(e => ['MANUAL_EXIT', 'ON_AUTO_EXIT'].includes(e.type)).length,
      mechanicCount: events.filter(e => ['ON_WAKE', 'ON_UNLOCK', 'ON_PUSH', 'ON_DESTROY', 'TELEPORT'].includes(e.type)).length,
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
      if (result.events.some(e => ['DAMAGE', 'ON_PUSH', 'ON_AUTO_EXIT', 'ON_UNLOCK', 'ON_WAKE'].includes(e.type))) shiftSafety.cascade++;
    }
    if (shiftSafety.opportunities && !shiftSafety.unknown) shiftSafety.rate = shiftSafety.safe / shiftSafety.opportunities;
    const special = board.entities.length + board.toys.filter(t => t.sleeping || t.hugLocked || t.pairId || t.keyId).length;
    return { ...solution, initialExitCount: ready(board), toyCount: board.toys.length,
      occupancy: [...board.toys, ...board.entities].filter(e => e.kind !== 'PORTAL').reduce((n, t) => n + t.cells.length, 0) / (board.cols * board.rows),
      mechanicDensity: special / (board.toys.length + board.entities.length), cascades,
      maxCascade: Math.max(0, ...cascades.map(c => c.toyRelease)), cascadeDepth: Math.max(0, ...cascades.map(c => c.depth)),
      shiftSafety, graph: graph(board) };
  }
  return { directions, copy, active, enabled, manual, occupied, position, duckPath, scan, settle, click, hash, fromConfig, validate, solve, replay, graph, analyze };
})();
export default Mechanics;
