import { readFile, writeFile } from 'node:fs/promises';
import G from '../src/mechanic-generator.js';
import M from '../src/mechanics.js';

const url = new URL('../config/mechanic-levels-v1.4.json', import.meta.url);
const config = JSON.parse(await readFile(url, 'utf8'));
const upgraded = [];
for (const level of config.levels) {
  const portals = (level.board_entities || []).filter(e => e.kind === 'PORTAL');
  if (!portals.length || portals.every(e => e.footprint?.[0] === 2 && e.footprint?.[1] === 2)) {
    upgraded.push(level); continue;
  }
  const next = G.placePortals(level, { seed: level.generator?.seed ?? level.level_no,
    maxNodes: 1000, anchors: portals.map(e => e.grid_position) });
  const errors = M.validate(M.fromConfig(next));
  if (errors.length) throw new Error(`${level.level_id}: ${errors.join(', ')}`);
  upgraded.push(next);
  console.log(`${level.level_id}: ${next.toy_list.length} toys, ${next.solution.length} moves`);
}
await writeFile(url, JSON.stringify({ ...config, levels: upgraded }, null, 2) + '\n');
