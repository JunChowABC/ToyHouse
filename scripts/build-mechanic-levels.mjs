import { readFile, writeFile, mkdir } from 'node:fs/promises';
import G from '../src/mechanic-generator.js';
const base = JSON.parse(await readFile(new URL('../docs/design/核心玩法系统/晚安玩具屋_关卡配置_1-20_v1.3.json', import.meta.url), 'utf8'));
const levels = [];
const last = Number(process.argv[2] || 100);
for (let no = 21; no <= last; no++) {
  let level;
  for (let attempt = 0; attempt < 12 && !level; attempt++) {
    try { level = G.generate(base.levels[15 + (no + attempt) % 5], { levelNo: no, seed: no * 313 + attempt * 7919, maxNodes: 500 }); }
    catch (error) { console.log(`retry ${no}/${attempt}: ${error.message}`); }
  }
  if (!level) throw new Error(`Could not embed level ${no}; no invalid fallback is published`);
  levels.push(level); console.log(`${level.level_id}: ${level.mechanic_pool.join('+')} ${level.solution.length} clicks, ${level.validation.nodes} nodes`);
}
await mkdir(new URL('../config/', import.meta.url), { recursive: true });
await writeFile(new URL('../config/mechanic-levels-v1.4.json', import.meta.url), JSON.stringify({ schema_version: '1.4', levels }, null, 2) + '\n');
