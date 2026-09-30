import { readFile, writeFile } from 'node:fs/promises';
import G from '../src/mechanic-generator.js';
const base = JSON.parse(await readFile(new URL('../docs/design/核心玩法系统/晚安玩具屋_关卡配置_1-20_v1.3.json', import.meta.url), 'utf8'));
const pools = [['FROZEN'], ['FROZEN', 'BOX'], ['ONE_WAY_EXIT'], ['ONE_WAY_EXIT', 'FROZEN'], ['CONVEYOR'], ['CONVEYOR', 'FROZEN'], ['ROTATOR'], ['ROTATOR', 'ONE_WAY_EXIT'], ['FROZEN', 'ONE_WAY_EXIT', 'CONVEYOR', 'ROTATOR']];
const levels = [];
for (const [index, pool] of pools.entries()) {
  const levelNo = 101 + index; let result;
  for (let attempt = 0; attempt < 8 && !result; attempt++) {
    try { result = G.generate(base.levels[15 + (index + attempt) % 5], { levelNo, seed: levelNo * 137 + attempt * 991, pool, maxNodes: 180 }); }
    catch (e) { console.log(`${levelNo}/${attempt}: ${e.message}`); }
  }
  if (!result) throw new Error(`No valid candidate for ${levelNo}`);
  levels.push(result); console.log(`${levelNo} ${pool.join('+')}: ${result.solution.length} clicks`);
}
await writeFile(new URL('../config/extra-mechanic-levels-v1.5.json', import.meta.url), JSON.stringify({ schema_version: '1.5', levels }, null, 2) + '\n');
