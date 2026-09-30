import { readFile, writeFile } from 'node:fs/promises';
import M from '../src/mechanics.js';
const url = new URL('../config/mechanic-levels-v1.4.json', import.meta.url);
const config = JSON.parse(await readFile(url, 'utf8'));
for (const level of config.levels.filter(l => l.board_entities.some(e => e.kind === 'SPRING'))) {
  let board = M.fromConfig(level);
  let result = M.solve(board, { maxNodes: 500, requireMechanics: true });
  if (!result.solvable) {
    // The old retracting spring sometimes released a lane that now remains blocked.
    // Try empty positions for that spring only; retain all toys and other mechanics.
    const spring = level.board_entities.find(e => e.kind === 'SPRING'), origin = [...spring.grid_position];
    const used = new Set([...board.toys, ...board.entities].filter(e => e.id !== spring.entity_id).flatMap(e => e.cells.map(c => `${c.x},${c.y}`)));
    const spots = [];
    for (let y = 0; y < board.rows; y++) for (let x = 0; x < board.cols; x++) if (!used.has(`${x},${y}`)) spots.push([x, y]);
    spots.sort((a, b) => Math.abs(a[0] - origin[0]) + Math.abs(a[1] - origin[1]) - Math.abs(b[0] - origin[0]) - Math.abs(b[1] - origin[1]));
    for (const spot of spots) {
      spring.grid_position = spot; board = M.fromConfig(level);
      result = M.solve(board, { maxNodes: 300, requireMechanics: true });
      if (result.solvable) { console.log(`${level.level_id}: spring relocated ${origin} -> ${spot}`); break; }
    }
  }
  if (!result.solvable) throw new Error(`${level.level_id}: ${result.status}`);
  const replay = M.replay(board, result.actions);
  if (replay.board.toys.some(M.active)) throw new Error(`${level.level_id}: replay failed`);
  level.solution = result.actions;
  level.generator.springRule = 'slide-until-blocked-or-exit';
  level.validation = { ...level.validation, nodes: result.nodes, status: result.status,
    initialExitCount: board.toys.filter(t => M.manual(t) && M.scan(board, t).exitsBoard).length,
    activatedMechanics: [...new Set(replay.turns.flat().filter(e => ['ON_PUSH', 'ON_DESTROY', 'ON_WAKE', 'ON_UNLOCK', 'TELEPORT'].includes(e.type)).map(e => e.target))] };
  console.log(`${level.level_id}: ${result.actions.length} moves, ${result.nodes} nodes`);
}
await writeFile(url, JSON.stringify(config, null, 2) + '\n');
