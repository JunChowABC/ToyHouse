import { mkdir, writeFile } from 'node:fs/promises';
import { importLevelsV22 } from './import-levels-v22.mjs';
import M from '../src/mechanics.js';

// Find empty components with no path to an edge, including every legal portal exit.
function enclosedCells(board) {
  const bare = M.copy(board); bare.toys = bare.toys.filter(t => t.archetypeId !== 'AUTO_EXIT');
  const occupied = M.occupied(bare), cells = [], reverse = new Map();
  const key = c => `${c.x},${c.y}`;
  const portals = bare.entities.filter(e => e.kind === 'PORTAL');
  const portalAt = c => portals.find(p => p.cells.some(q => q.x === c.x && q.y === c.y));
  for (let y = 0; y < bare.rows; y++) for (let x = 0; x < bare.cols; x++) if (!occupied.has(`${x},${y}`) && !portalAt({ x, y })) {
    cells.push({ x, y }); reverse.set(`${x},${y}`, []);
  }
  for (const cell of cells) for (const d of Object.values(M.directions)) {
    const next = { x: cell.x + d.x, y: cell.y + d.y }, portal = portalAt(next);
    let targets = [next];
    if (portal) {
      const partner = portals.find(p => p.id !== portal.id && p.pairId === portal.pairId);
      targets = partner ? M.portalExits(bare, partner, 1, '__probe').map(e => e.cells[0]) : [];
    }
    for (const target of targets) if (reverse.has(key(target))) reverse.get(key(target)).push(key(cell));
  }
  const queue = cells.filter(c => c.x === 0 || c.y === 0 || c.x === bare.cols - 1 || c.y === bare.rows - 1).map(key), seen = new Set(queue);
  for (let i = 0; i < queue.length; i++) for (const from of reverse.get(queue[i])) if (!seen.has(from)) { seen.add(from); queue.push(from); }
  return cells.filter(c => !seen.has(key(c)));
}

const { levels } = await importLevelsV22({ applyOverrides: false });
const fixes = [], report = [];
for (const level of levels) {
  let board = M.fromConfig(level);
  const ducks = board.toys.filter(t => t.archetypeId === 'AUTO_EXIT');
  const ready = ducks.filter(t => M.duckPath(board, t));
  if (!ready.length) continue;
  let safe = enclosedCells(board);
  const changes = [];
  if (safe.length < ducks.length) {
    // Move at most one unmodified rabbit to form a real physical blocker.
    const candidates = [];
    for (const toy of board.toys.filter(t => t.archetypeId === 'ORDINARY' && !t.modifier && !t.pairId && !t.keyId)) {
      const without = M.copy(board); without.toys = without.toys.filter(t => t.id !== toy.id && t.archetypeId !== 'AUTO_EXIT');
      const occ = M.occupied(without);
      for (const p of without.entities.filter(e => e.kind === 'PORTAL')) for (const c of p.cells) occ.set(`${c.x},${c.y}`, p.id);
      const width = Math.max(...toy.cells.map(c => c.x)) - toy.x + 1, height = Math.max(...toy.cells.map(c => c.y)) - toy.y + 1;
      for (let y = 0; y <= board.rows - height; y++) for (let x = 0; x <= board.cols - width; x++) {
        if (x === toy.x && y === toy.y) continue;
        const cells = toy.cells.map(c => ({ x: c.x + x - toy.x, y: c.y + y - toy.y }));
        if (cells.some(c => occ.has(`${c.x},${c.y}`))) continue;
        candidates.push({ id: toy.id, cells, cost: Math.abs(x - toy.x) + Math.abs(y - toy.y) });
      }
    }
    candidates.sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
    let found = false;
    for (const candidate of candidates) {
      const trial = M.copy(board), toy = trial.toys.find(t => t.id === candidate.id), from = [toy.x, toy.y];
      M.position(toy, candidate.cells);
      const trapped = enclosedCells(trial);
      if (trapped.length < ducks.length) continue;
      changes.push({ toy_id: toy.id, from, to: [toy.x, toy.y], reason: 'SEAL_DUCK_ESCAPE_PATH' });
      board = trial; safe = trapped; found = true; break;
    }
    if (!found) throw new Error(`${level.level_id}: no minimal blocker layout found`);
  }
  const available = new Map(safe.map(c => [`${c.x},${c.y}`, c])), relocate = [];
  for (const duck of board.toys.filter(t => t.archetypeId === 'AUTO_EXIT')) {
    if (available.has(`${duck.x},${duck.y}`)) available.delete(`${duck.x},${duck.y}`);
    else relocate.push(duck);
  }
  for (const duck of relocate) {
    const candidates = [...available.values()].sort((a, b) => Math.abs(a.x - duck.x) + Math.abs(a.y - duck.y) - Math.abs(b.x - duck.x) - Math.abs(b.y - duck.y) || a.y - b.y || a.x - b.x);
    const cell = candidates[0], from = [duck.x, duck.y];
    if (!cell) throw new Error(`${level.level_id}: no enclosed duck cell`);
    M.position(duck, [cell]); available.delete(`${cell.x},${cell.y}`);
    changes.push({ toy_id: duck.id, from, to: [cell.x, cell.y], reason: 'INITIAL_DUCK_PATH_BLOCKED' });
  }
  const errors = M.validate(board);
  if (errors.length || board.toys.filter(t => t.archetypeId === 'AUTO_EXIT').some(t => M.duckPath(board, t))) throw new Error(`${level.level_id}: final blocked layout validation failed: ${errors}`);
  const before = M.hash(board); M.settle(board); if (M.hash(board) !== before) throw new Error(`${level.level_id}: initial settlement changed board`);
  fixes.push({ level_no: level.level_no, changes });
  report.push({ level: level.level_no, initially_ready: ready.length, moved_ducks: relocate.length, blocker_changes: changes.filter(c => c.reason === 'SEAL_DUCK_ESCAPE_PATH').length, status: 'PASS' });
}
await writeFile(new URL('../config/initial-duck-blocks-v22.json', import.meta.url), JSON.stringify({ rule: 'NO_INITIAL_DUCK_PATH_INCLUDING_PORTALS', fixes }, null, 2) + '\n');
await mkdir('test-output/levels-v22', { recursive: true });
await writeFile('test-output/levels-v22/duck-block-repair.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ repairedLevels: fixes.length, movedDucks: report.reduce((s, r) => s + r.moved_ducks, 0), movedBlockers: report.reduce((s, r) => s + r.blocker_changes, 0) }));
