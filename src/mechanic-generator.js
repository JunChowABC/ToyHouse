import Mechanics from './mechanics.js';

// Existing authored release skeletons supply dense, four-direction spatial layouts.
// Insert explicit trigger nodes into that skeleton, then accept only replayable solutions.
const MechanicGenerator = (() => {
  const M = Mechanics;
  function random(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function shuffled(items, rng) { return items.map(item => ({ item, rank: rng() })).sort((a, b) => a.rank - b.rank).map(x => x.item); }
  function placePortals(config, { seed = 1, maxNodes = 1800, anchors = [] } = {}) {
    const rng = random(seed), original = M.copy(config);
    const old = original.board_entities.filter(e => e.kind === 'PORTAL');
    const pairId = old[0]?.pair_id || `${config.level_id}_P`;
    const ids = old.length === 2 ? old.map(e => e.entity_id) : [0, 1].map(i => `${config.level_id}_PORTAL_${i}`);
    const fixed = original.board_entities.filter(e => e.kind !== 'PORTAL');
    const fixedCells = new Set(fixed.flatMap(e => Array.from({ length: e.footprint?.[1] || 1 }, (_, dy) =>
      Array.from({ length: e.footprint?.[0] || 1 }, (_, dx) => `${e.grid_position[0] + dx},${e.grid_position[1] + dy}`)).flat()));
    const toyCells = t => Array.from({ length: t.footprint[1] }, (_, dy) =>
      Array.from({ length: t.footprint[0] }, (_, dx) => `${t.grid_position[0] + dx},${t.grid_position[1] + dy}`)).flat();
    const protectedIds = new Set(original.toy_list.flatMap(t => [t.hug_source].filter(Boolean)));
    const candidates = [];
    for (let y = 1; y < original.board_height - 2; y++) for (let x = 1; x < original.board_width - 2; x++) {
      const cells = [0, 1].flatMap(dy => [0, 1].map(dx => `${x + dx},${y + dy}`));
      if (cells.some(c => fixedCells.has(c))) continue;
      const displaced = original.toy_list.filter(t => toyCells(t).some(c => cells.includes(c)));
      if (displaced.length > 3 || displaced.some(t => t.modifier || t.pair_id || t.key_id || protectedIds.has(t.toy_id))) continue;
      const proximity = anchors.length ? Math.min(...anchors.map(a => Math.abs(a[0] - x) + Math.abs(a[1] - y))) : 0;
      candidates.push({ x, y, cells, displaced: displaced.map(t => t.toy_id), rank: displaced.length * 10 + proximity + rng() });
    }
    candidates.sort((a, b) => a.rank - b.rank);
    for (const a of candidates.slice(0, 35)) for (const b of candidates.slice(0, 35)) {
      if (a === b || a.cells.some(c => b.cells.includes(c))) continue;
      if (Math.abs(a.x - b.x) + Math.abs(a.y - b.y) < 5) continue;
      const removed = new Set([...a.displaced, ...b.displaced]);
      if (removed.size > 5) continue;
      const trial = M.copy(original);
      trial.toy_list = trial.toy_list.filter(t => !removed.has(t.toy_id));
      trial.board_entities = [...fixed, ...[a, b].map((p, i) => ({ entity_id: ids[i], kind: 'PORTAL', grid_position: [p.x, p.y], footprint: [2, 2], pair_id: pairId }))];
      const board = M.fromConfig(trial);
      if (M.validate(board).length) continue;
      const solution = M.solve(board, { maxNodes, requireMechanics: true });
      if (!solution.solvable) continue;
      trial.solution = solution.actions;
      const replay = M.replay(board, solution.actions);
      trial.validation = { ...trial.validation, status: solution.status, nodes: solution.nodes,
        toyCount: board.toys.length, initialExitCount: board.toys.filter(t => M.manual(t) && M.scan(board, t).exitsBoard).length,
        activatedMechanics: [...new Set(replay.turns.flat().filter(e => ['ON_PUSH', 'ON_DESTROY', 'ON_WAKE', 'ON_UNLOCK', 'TELEPORT'].includes(e.type)).map(e => e.target))] };
      trial.generator = { ...trial.generator, portalLayout: '2x2', displacedToys: [...removed] };
      return trial;
    }
    throw new Error(`PORTAL 2x2 embedding failed for ${config.level_id}`);
  }
  function poolFor(level) {
    return ['BOX', ...(level >= 31 ? ['SLEEPING'] : []), ...(level >= 41 ? ['SPRING'] : []), ...(level >= 51 ? ['HUG'] : []), ...(level >= 61 ? ['KEY_LOCK'] : []), ...(level >= 76 ? ['PORTAL'] : [])];
  }
  function generate(base, { levelNo = 21, seed = levelNo * 313, pool = poolFor(levelNo), maxNodes = 1800 } = {}) {
    const rng = random(seed), config = M.copy(base);
    config.level_no = levelNo; config.level_id = `L${String(levelNo).padStart(3, '0')}`;
    config.chapter_id = `NIGHT_${Math.ceil(levelNo / 20)}`;
    config.level_name = `玩具的秘密 · ${levelNo}`; config.display_title = config.level_name;
    config.schema_version = '1.4'; config.board_entities = [];
    for (const toy of config.toy_list) for (const key of ['modifier', 'wake_source', 'wake_after_exits', 'hug_source', 'pair_id', 'key_id', 'ice_layers']) delete toy[key];
    const ids = config.toy_list.map(t => t.toy_id);
    config.toy_list.forEach((t, i) => { t.toy_id = `${config.level_id}_T${String(i + 1).padStart(3, '0')}`; });
    const sourceIds = new Map(ids.map((id, i) => [id, config.toy_list[i].toy_id]));
    let solution = M.solve(M.fromConfig(config), { maxNodes });
    if (!solution.solvable) throw new Error(`Invalid base skeleton ${base.level_id}`);
    const intended = [], byId = id => config.toy_list.find(t => t.toy_id === id);
    // EXIT before target in the proven skeleton ensures a legal, explicit dependency.
    function dependency(kind) {
      const order = [...new Set(solution.actions)];
      for (const targetId of shuffled(order.slice(Math.floor(order.length * .45)), rng)) {
        const target = byId(targetId); if (target.modifier || target.pair_id || target.key_id) continue;
        if (kind === 'SLEEPING') {
          target.modifier = kind;
          target.wake_after_exits = Math.min(3, Math.max(1, Math.floor(order.indexOf(targetId) / 5)));
          intended.push({ source: 'ANY_TOY_EXIT', target: targetId, type: `EXIT_COUNT_${target.wake_after_exits}` });
          return;
        }
        const sourceId = order[Math.floor(rng() * Math.max(1, Math.floor(order.indexOf(targetId) * .5)))];
        const source = byId(sourceId); if (source.modifier || source.pair_id) continue;
        target.modifier = 'HUG_LOCKED'; target.hug_source = sourceId; target.pair_id = source.pair_id = `${config.level_id}_HUG`;
        intended.push({ source: sourceId, target: targetId, type: 'EXIT_UNLOCK' });
        return;
      }
      throw new Error('No dependency insertion');
    }
    if (pool.includes('SLEEPING')) { dependency('SLEEPING'); if (levelNo >= 51) dependency('SLEEPING'); }
    if (pool.includes('HUG')) dependency('HUG');
    function emptyCells() {
      const board = M.fromConfig(config), used = new Set([...board.toys, ...board.entities].flatMap(e => e.cells.map(c => `${c.x},${c.y}`)));
      const cells = [];
      for (let y = 1; y < board.rows - 1; y++) for (let x = 1; x < board.cols - 1; x++) if (!used.has(`${x},${y}`)) cells.push([x, y]);
      return shuffled(cells, rng);
    }
    function rays(cell) {
      return M.fromConfig(config).toys.filter(t => {
        if (!t.direction) return false;
        const d = M.directions[t.direction], head = t.cells.reduce((a, b) => a.x * d.x + a.y * d.y > b.x * d.x + b.y * d.y ? a : b);
        return d.x ? head.y === cell[1] && (cell[0] - head.x) * d.x > 0 : head.x === cell[0] && (cell[1] - head.y) * d.y > 0;
      });
    }
    function insert(kind, serial, extra = {}) {
      for (const cell of emptyCells()) {
        const sources = rays(cell); if (!sources.length) continue;
        const entity = { entity_id: `${config.level_id}_${kind}_${serial}`, kind, grid_position: cell, footprint: [1, 1], ...extra };
        config.board_entities.push(entity);
        const candidate = M.solve(M.fromConfig(config), { maxNodes, requireMechanics: true });
        if (candidate.solvable) {
          solution = candidate;
          intended.push({ source: sources[0].id, target: entity.entity_id, type: kind === 'BOX' ? 'HIT' : kind === 'SPRING' ? 'PUSH' : 'EXIT_UNLOCK' });
          return true;
        }
        config.board_entities.pop();
      }
      return false;
    }
    if (pool.includes('BOX')) for (let i = 1; i <= (levelNo <= 30 && levelNo % 3 === 0 ? 3 : 2); i++) if (!insert('BOX', i, { hp: 2 })) throw new Error('BOX embedding failed');
    if (pool.includes('SPRING') && !insert('SPRING', 1)) throw new Error('SPRING embedding failed');
    if (pool.includes('KEY_LOCK')) {
      const key = byId(solution.actions[Math.floor(solution.actions.length * .2)]);
      key.key_id = `${config.level_id}_GOLD`;
      if (!insert('LOCK_BOX', 1, { key_id: key.key_id })) throw new Error('LOCK embedding failed');
      intended[intended.length - 1].source = key.toy_id;
    }
    if (pool.includes('PORTAL')) {
      const placed = placePortals(config, { seed, maxNodes });
      config.toy_list = placed.toy_list; config.board_entities = placed.board_entities;
      solution = { solvable: true, actions: placed.solution };
      config.generator = placed.generator;
    }
    const accept = () => {
      const result = M.solve(M.fromConfig(config), { maxNodes, requireMechanics: true });
      if (result.solvable) { solution = result; return true; }
      return false;
    };
    if (pool.includes('FROZEN')) {
      let found = false;
      const b = M.fromConfig(config);
      const targets = [...new Set(b.toys.filter(M.manual).map(t => M.scan(b, t).blockerId).filter(Boolean))];
      for (const id of shuffled(targets, rng)) {
        const target = byId(id); if (!target || target.archetype_id === 'AUTO_EXIT' || target.modifier) continue;
        target.modifier = 'FROZEN'; target.ice_layers = 1 + seed % 2;
        if (accept()) { found = true; break; }
        delete target.modifier; delete target.ice_layers;
      }
      if (!found) throw new Error('FROZEN embedding failed');
    }
    if (pool.includes('ONE_WAY_EXIT')) {
      let found = false;
      for (const toy of shuffled(M.fromConfig(config).toys.filter(M.manual), rng)) {
        const d = M.directions[toy.direction], cell = [d.x < 0 ? 0 : d.x > 0 ? config.board_width - 1 : toy.x, d.y < 0 ? 0 : d.y > 0 ? config.board_height - 1 : toy.y];
        config.board_entities.push({ entity_id: `${config.level_id}_EXIT`, kind: 'ONE_WAY_EXIT', grid_position: cell, footprint: [1, 1], direction: toy.direction });
        if (accept()) { found = true; break; }
        config.board_entities.pop();
      }
      if (!found) throw new Error('EXIT embedding failed');
    }
    for (const kind of ['CONVEYOR', 'ROTATOR'].filter(k => pool.includes(k))) {
      let found = false;
      const candidates = [];
      for (let y = 0; y <= config.board_height - 3; y++) for (let x = 0; x <= config.board_width - 3; x++) candidates.push([x, y]);
      for (const cell of shuffled(candidates, rng).slice(0, 48)) {
        const e = { entity_id: `${config.level_id}_${kind}`, kind, grid_position: cell, footprint: [3, 3], direction: ['RIGHT', 'DOWN', 'LEFT', 'UP'][Math.floor(rng() * 4)], period: 2, clockwise: true };
        config.board_entities.push(e);
        if (accept()) { found = true; break; }
        config.board_entities.pop();
      }
      if (!found) throw new Error(`${kind} embedding failed`);
    }
    const board = M.fromConfig(config);
    solution = M.solve(board, { maxNodes, requireMechanics: true });
    if (!solution.solvable) throw new Error(`Final validation: ${solution.status}`);
    const replay = M.replay(board, solution.actions);
    if (replay.board.toys.some(M.active)) throw new Error('Solution replay failed');
    const initialExits = board.toys.filter(t => M.manual(t) && M.scan(board, t).exitsBoard).length;
    if (initialExits < 3) throw new Error('Insufficient initial choices');
    config.mechanic_pool = pool;
    config.generator = { version: '1.4', seed, skeleton: base.level_id,
      sourceIds: Object.fromEntries([...sourceIds].filter(([, id]) => config.toy_list.some(t => t.toy_id === id))),
      intended_graph: intended, ...(pool.includes('PORTAL') ? { portalLayout: '2x2' } : {}) };
    config.solution = solution.actions;
    config.validation = { status: solution.status, nodes: solution.nodes, initialExitCount: initialExits,
      toyCount: board.toys.length, mechanicCount: board.entities.length + board.toys.filter(t => t.sleeping || t.pairId || t.keyId || t.ice).length,
      activatedMechanics: [...new Set(replay.turns.flat().filter(e => ['ON_PUSH', 'ON_DESTROY', 'ON_WAKE', 'ON_UNLOCK', 'TELEPORT', 'ON_THAW', 'ON_GATE_PASS', 'ON_CONVEY', 'ON_ROTATE'].includes(e.type)).map(e => e.target))] };
    return config;
  }
  return { generate, poolFor, placePortals };
})();
export default MechanicGenerator;
