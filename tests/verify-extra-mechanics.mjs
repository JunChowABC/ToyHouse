import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import M from '../src/mechanics.js';
const toy = (id, x, y, direction = 'R', length = 2, extra = {}) => ({ toy_id: id, archetype_id: length === 1 ? 'AUTO_EXIT' : length === 3 ? 'LARGE' : 'ORDINARY', grid_position: [x, y], footprint: ['L', 'R'].includes(direction) ? [length, 1] : [1, length], direction: length === 1 ? null : direction, ...extra });
const entity = (id, kind, x, y, extra = {}) => ({ entity_id: id, kind, grid_position: [x, y], footprint: [1, 1], ...extra });
const board = (toys, entities = [], width = 8, height = 8) => M.fromConfig({ toy_list: toys, board_entities: entities, board_width: width, board_height: height });
let b = board([toy('r', 0, 2), toy('ice', 2, 2, 'D', 3, { modifier: 'FROZEN', ice_layers: 2 })]);
assert(!M.click(b, 'ice').changed);
assert.equal(M.click(b, 'r').events.filter(e => e.type === 'ON_ICE_DAMAGE').length, 1); assert.equal(b.toys[1].ice, 1);
assert(M.click(b, 'r').events.some(e => e.type === 'ON_THAW')); assert.equal(b.toys[1].ice, 0);
M.click(b, 'ice'); assert.equal(b.toys[1].state, 'EXITING');
assert(M.solve(board([toy('r', 0, 2), toy('ice', 2, 2, 'D', 3, { modifier: 'FROZEN', ice_layers: 2 })])).solvable);
b = board([toy('r', 0, 2)], [entity('exit', 'ONE_WAY_EXIT', 7, 2, { direction: 'U' })]);
let result = M.click(b, 'r'); assert.equal(result.scan.gateBlocked, true); assert.equal(b.toys[0].x, 6); assert.equal(b.toys[0].state, 'IDLE');
b.entities[0].direction = 'RIGHT'; result = M.click(b, 'r'); assert(result.events.some(e => e.type === 'ON_GATE_PASS'));
b = board([toy('d', 0, 0, 'R', 1)], [entity('e', 'ONE_WAY_EXIT', 0, 0, { direction: 'U' })]);
assert.deepEqual(M.duckPath(b, b.toys[0]), [{ x: 0, y: 0 }, { x: 0, y: -1 }]);
b.entities[0].direction = 'RIGHT'; assert(M.duckPath(b, b.toys[0]).length > 2, 'duck finds a different legal boundary');
const conv = (extra = {}) => entity('belt', 'CONVEYOR', 0, 1, { footprint: [6, 3], direction: 'R', period: 1, ...extra });
b = board([toy('a', 0, 1), toy('b', 2, 1), toy('clock', 0, 6)], [conv()]);
result = M.click(b, 'clock'); assert.equal(b.toys[0].x, 1); assert.equal(b.toys[1].x, 3); assert.equal(result.events.filter(e => e.type === 'ON_CONVEY')[0].moved.length, 2);
b = board([toy('a', 0, 1), toy('b', 2, 1), toy('outside', 4, 1, 'D', 3), toy('clock', 0, 6)], [conv({ footprint: [4, 3] })]);
result = M.click(b, 'clock'); assert(result.events.some(e => e.type === 'ON_ZONE_BLOCKED')); assert.equal(b.toys[0].x, 0); assert.equal(b.toys[1].x, 2);
b = board([toy('a', 6, 1), toy('clock', 0, 6)], [conv({ grid_position: [5, 1], footprint: [3, 3] })]);
M.click(b, 'clock'); assert.equal(b.toys[0].x, 6, 'conveyor cannot eject toys');
b = board([toy('partial', 1, 1), toy('clock', 0, 6)], [conv({ grid_position: [2, 1], footprint: [3, 3] })]);
M.click(b, 'clock'); assert.equal(b.toys[0].x, 1, 'straddling toys are excluded');
b = board([toy('a', 0, 1), toy('c1', 0, 6), toy('c2', 3, 6)], [conv({ period: 2 })]);
const hash0 = M.hash(b); M.click(b, 'c1'); assert.equal(b.entities[0].phase, 1); assert.equal(b.toys[0].x, 0);
assert.notEqual(hash0, M.hash(b)); M.click(b, 'c2'); assert.equal(b.entities[0].phase, 0); assert.equal(b.toys[0].x, 1);
const rotor = (extra = {}) => entity('rot', 'ROTATOR', 1, 1, { footprint: [4, 4], period: 1, clockwise: true, ...extra });
b = board([toy('whale', 1, 3, 'R', 3), toy('clock', 0, 6)], [rotor()]);
result = M.click(b, 'clock'); assert.equal(b.toys[0].direction, 'DOWN'); assert.deepEqual(b.toys[0].cells, [{ x: 3, y: 3 }, { x: 3, y: 2 }, { x: 3, y: 1 }]); assert(result.events.some(e => e.type === 'ON_ROTATE'));
assert.deepEqual(M.validate(b), []);
b = board([toy('rabbit', 1, 2), toy('clock', 0, 6)], [rotor({ clockwise: false })]); M.click(b, 'clock'); assert.equal(b.toys[0].direction, 'UP'); assert.equal(b.toys[0].y, 2);
b = board([toy('a', 1, 3), toy('b', 4, 1, 'D'), toy('clock', 0, 6)], [rotor()]);
const old = M.copy(b.toys[0]); result = M.click(b, 'clock'); assert(result.events.some(e => e.type === 'ON_ZONE_BLOCKED')); assert.deepEqual(b.toys[0], old, 'rotation cancels atomically when any member cannot fit');
b = board([toy('a', 0, 1, 'R', 2, { modifier: 'FROZEN', ice_layers: 1 }), toy('clock', 0, 6)], [conv()]);
M.click(b, 'a'); assert.equal(b.entities[0].phase, 0); assert.equal(b.toys[0].x, 0, 'locked clicks do not tick zones');
M.click(b, 'clock'); assert.equal(b.toys[0].x, 1); assert.equal(b.toys[0].ice, 1, 'board movement preserves ice');
b = board([toy('r', 0, 6)], [rotor(), conv()]); assert(M.validate(b).some(e => e.startsWith('OVERLAPPING_ZONE')));
b = board([toy('r', 0, 6)], [entity('e', 'ONE_WAY_EXIT', 3, 3, { direction: 'R' })]); assert(M.validate(b).some(e => e.startsWith('INVALID_EXIT')));
b = board([toy('r', 0, 6)], [conv({ period: 0 })]); assert(M.validate(b).some(e => e.startsWith('INVALID_PERIOD')));
const config = JSON.parse(await readFile(new URL('../config/extra-mechanic-levels-v1.5.json', import.meta.url), 'utf8'));
const reports = [];
for (const level of config.levels) {
  b = M.fromConfig(level); assert.deepEqual(M.validate(b), []);
  const { board: end, turns } = M.replay(b, level.solution); assert(end.toys.every(t => !M.active(t)));
  const events = turns.flat();
  for (const [pool, type] of Object.entries({ FROZEN: 'ON_THAW', ONE_WAY_EXIT: 'ON_GATE_PASS', CONVEYOR: 'ON_CONVEY', ROTATOR: 'ON_ROTATE' })) if (level.mechanic_pool.includes(pool)) {
    assert(events.some(e => e.type === type && (!e.moved || e.moved.length)), `${level.level_id}: unused ${pool}`);
  }
  for (const id of level.solution) { M.click(b, id); const currentErrors = M.validate(b); assert.deepEqual(currentErrors, [], `${level.level_id}/${id}`); }
  reports.push({ level: level.level_id, pool: level.mechanic_pool, moves: level.solution.length, status: 'PASS' });
}
await mkdir('test-output/mechanics-v15', { recursive: true }); await writeFile('test-output/mechanics-v15/rules-report.json', JSON.stringify(reports, null, 2));
console.log('Four mechanisms: rules, transactional occupancy, periods, solver and 9 generated no-tool witnesses PASS');
