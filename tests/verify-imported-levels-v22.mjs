import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import CONFIG from '../src/level-config.js';
import M from '../src/mechanics.js';
const source = JSON.parse(await readFile(new URL('../晚安玩具屋_4-200关关卡配置_V2.2_弹簧滑行版.json', import.meta.url), 'utf8'));
const original = JSON.parse(await readFile(new URL('../docs/design/核心玩法系统/晚安玩具屋_关卡配置_1-20_v1.3.json', import.meta.url), 'utf8'));
assert.equal(CONFIG.levels.length, 200);
for (let i = 0; i < 3; i++) { const { display_title, ...level } = CONFIG.levels[i]; assert.deepEqual(level, original.levels[i]); }
const vectors = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] }, reports = [];
let springs = 0, releasedDucks = 0;
for (const authored of source.levels) {
  const level = CONFIG.levels[authored.level_id - 1], board = M.fromConfig(level);
  assert.equal(level.level_no, authored.level_id); assert.deepEqual(M.validate(board), []);
  assert.equal(board.toys.length, authored.validation.toy_count_expected);
  assert.equal(level.clearance_policy.natural_solution_required, false);
  for (const t of authored.toys) {
    const actual = board.toys.find(a => a.id === t.id), [dx, dy] = vectors[t.direction] || [0, 0];
    const override = level.layout_overrides?.find(c => c.toy_id === t.id);
    const offset = override ? [override.to[0] - override.from[0], override.to[1] - override.from[1]] : [0, 0];
    const expected = Array.from({ length: t.length }, (_, i) => `${t.grid_position.x + i * dx + offset[0]},${t.grid_position.y + i * dy + offset[1]}`).sort();
    assert.deepEqual(actual.cells.map(c => `${c.x},${c.y}`).sort(), expected, t.id);
    for (const m of t.modifiers) {
      if (m.type === 'SLEEPING') assert.equal(actual.sleepRemaining, m.remaining_exit_count);
      if (m.type === 'FROZEN') assert.equal(actual.ice, m.remaining_hits);
      if (m.type === 'KEY_CARRIER') assert.equal(actual.keyId, m.key_id);
      if (m.type === 'HUG_LOCKED') assert.equal(actual.hugSource, authored.relations.find(r => r.id === m.pair_id).leader_toy_id);
    }
  }
  for (const e of authored.board_entities) {
    const actual = board.entities.find(a => a.id === e.id);
    assert.deepEqual([actual.x, actual.y], [e.grid_position.x, e.grid_position.y]);
    if (e.type === 'SPRING_TOY') { springs++; assert(actual.ownDirection && actual.countsTowardClear); assert.equal(actual.direction, { U: 'UP', D: 'DOWN', L: 'LEFT', R: 'RIGHT' }[e.direction]); }
    if (e.type === 'PORTAL') assert.equal(actual.cells.length, 4);
    if (e.type === 'BOX') assert.equal(actual.hp, e.rule.required_exit_count);
  }
  for (const duck of board.toys.filter(t => t.archetypeId === 'AUTO_EXIT')) assert.equal(M.duckPath(board, duck), null, `${duck.id}: initial path must be blocked, including portals`);
  const initialHash = M.hash(board), initialEvents = M.settle(board);
  assert.equal(M.hash(board), initialHash, `${level.level_id}: idle settlement must preserve initial board`);
  assert(!initialEvents.some(e => ['ON_AUTO_EXIT', 'ON_DUCK_TRANSFER'].includes(e.type)));
  for (let step = 0; step < 12; step++) {
    const candidates = board.toys.filter(M.manual).filter(t => { const p = M.scan(board, t); return p.emptySteps || p.exitsBoard || p.blockerId; });
    if (!candidates.length) break;
    const move = M.click(board, candidates[step % candidates.length].id);
    if (level.layout_overrides) releasedDucks += move.events.filter(e => e.type === 'ON_AUTO_EXIT').length;
    assert.deepEqual(M.validate(board), [], `${level.level_id}: after move ${step}`);
  }
  reports.push({ level: level.level_no, toys: authored.toys.length, mechanics: level.mechanic_pool, geometry: 'PASS', solver: 'NOT_CHECKED' });
}
assert.equal(springs, 89);
assert(releasedDucks > 0, 'repaired levels still release ducks after player moves');
// A perpendicular hit must preserve the spring's own heading and count its exit.
const fixture = { board_width: 8, board_height: 8, portal_randomization: 'UNIFORM_VALID_SIDE_THEN_TRACK', toy_list: [
  { toy_id: 'hit', archetype_id: 'ORDINARY', direction: 'R', footprint: [2, 1], grid_position: [0, 3] },
  { toy_id: 'sleep', archetype_id: 'ORDINARY', direction: 'L', footprint: [2, 1], grid_position: [5, 6], modifier: 'SLEEPING', wake_after_exits: 1 }
], board_entities: [{ entity_id: 'spring', kind: 'SPRING', grid_position: [3, 3], direction: 'U', own_direction: true, counts_toward_level_clear: true }] };
let b = M.fromConfig(fixture); assert(!M.click(b, 'spring').changed);
let result = M.click(b, 'hit'); assert(result.events.some(e => e.type === 'ON_SPRING_EXIT')); assert.equal(b.entities[0].direction, 'UP'); assert(!b.toys[1].sleeping);
// User-confirmed override: boxes take hits, not exit counts, including durability 4.
b = M.fromConfig({ ...fixture, toy_list: [fixture.toy_list[0], { toy_id: 'far', archetype_id: 'ORDINARY', direction: 'L', footprint: [2, 1], grid_position: [0, 6] }], board_entities: [{ entity_id: 'box', kind: 'BOX', grid_position: [3, 3], hp: 4, max_hp: 4 }] });
M.click(b, 'far'); assert.equal(b.entities[0].hp, 4);
for (let hp = 3; hp >= 0; hp--) { M.click(b, 'hit'); assert.equal(b.entities[0].hp, hp); }
assert.equal(b.entities[0].state, 'DESTROYED');
await mkdir('test-output/levels-v22', { recursive: true });
await writeFile('test-output/levels-v22/config-report.json', JSON.stringify({ preserved: [1, 2, 3], imported: reports.length, springs, releasedDucksAfterMoves: releasedDucks, provenance: CONFIG.import_provenance, reports }, null, 2));
console.log('V2.2: 197 layouts with tracked duck-block overrides, no initial duck routes/transfers/exits, 1–3 preserved, modifiers/references and sampled moves PASS');
