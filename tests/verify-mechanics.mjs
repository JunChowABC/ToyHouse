import assert from 'node:assert/strict';
import M from '../src/mechanics.js';
const toy = (id, x, y, dir = 'RIGHT', length = 2, extra = {}) => ({ id, x, y, direction: length === 1 ? null : dir,
  archetypeId: length === 1 ? 'AUTO_EXIT' : length === 3 ? 'LARGE' : 'ORDINARY', state: 'IDLE',
  cells: Array.from({ length }, (_, i) => ({ x: x + (['LEFT', 'RIGHT'].includes(dir) ? i : 0), y: y + (['UP', 'DOWN'].includes(dir) ? i : 0) })), ...extra });
const entity = (id, kind, x, y, extra = {}) => ({ id, kind, x, y, state: 'IDLE', cells: [{ x, y }], ...extra });
const board = (toys, entities = [], cols = 8, rows = 8) => ({ toys, entities, cols, rows });
let b = board([toy('r', 0, 3)], [entity('box', 'BOX', 2, 3, { hp: 2 })]);
let r = M.click(b, 'r');
assert.equal(b.entities[0].hp, 1); assert.equal(r.scan.emptySteps, 0); assert.equal(b.toys[0].state, 'IDLE');
M.click(b, 'r'); assert.equal(b.entities[0].state, 'DESTROYED'); assert.equal(b.toys[0].state, 'IDLE');
M.click(b, 'r'); assert.equal(b.toys[0].state, 'EXITING');
b = board([toy('r', 0, 3)], [entity('s', 'SPRING', 3, 3)]);
r = M.click(b, 'r'); assert.equal(b.toys[0].x, 1); assert.equal(b.entities[0].x, 7); assert(r.events.some(e => e.type === 'ON_PUSH'));
assert.equal(b.entities[0].state, 'EXITING'); M.click(b, 'r'); assert.equal(b.toys[0].state, 'EXITING', 'departed spring releases its last pusher');
b = board([toy('r', 0, 3)], [entity('s', 'SPRING', 7, 3)]);
M.click(b, 'r'); assert.equal(b.entities[0].state, 'EXITING', 'spring at the edge exits immediately when hit outward');
b = board([toy('r', 0, 3), toy('block', 3, 3, 'UP')], [entity('s', 'SPRING', 2, 3)]);
r = M.click(b, 'r'); assert.equal(r.changed, false); assert.equal(b.entities[0].x, 2);
b = board([toy('a', 0, 0), toy('b', 0, 1), toy('sleep', 0, 2, 'RIGHT', 2, { sleeping: true, sleepRemaining: 2 })]);
assert.equal(M.click(b, 'sleep').changed, false);
r = M.click(b, 'a'); assert.equal(b.toys[2].sleepRemaining, 1); assert(b.toys[2].sleeping); assert(r.events.some(e => e.type === 'ON_SLEEP_COUNT' && e.remaining === 1));
M.settle(b, [{ type: 'ON_EXIT', source: 'a' }]); assert.equal(b.toys[2].sleepRemaining, 1, 'duplicate exit is not counted');
r = M.click(b, 'b'); assert.equal(b.toys[2].sleeping, false); assert.equal(b.toys[2].sleepRemaining, 0); assert.equal(b.toys[2].direction, 'RIGHT');
b = board([toy('a', 0, 0, 'RIGHT', 2, { pairId: 'pink' }), toy('hug', 0, 2, 'RIGHT', 2, { hugLocked: true, hugSource: 'a', pairId: 'pink' })]);
assert.deepEqual(M.validate(b), []); assert.equal(M.click(b, 'hug').changed, false); M.click(b, 'a'); assert.equal(b.toys[1].hugLocked, false);
b = board([toy('key', 0, 0, 'RIGHT', 2, { keyId: 'gold' })], [entity('lock1', 'LOCK_BOX', 2, 2, { keyId: 'gold' }), entity('lock2', 'LOCK_BOX', 5, 2, { keyId: 'gold' })]);
M.click(b, 'key'); assert(b.entities.every(e => e.state === 'DESTROYED'));
b = board([toy('duck', 0, 0, 'RIGHT', 1), toy('sleep', 2, 2, 'RIGHT', 2, { sleeping: true, sleepRemaining: 1 })]);
r = M.settle(b); assert.equal(b.toys[1].sleeping, false); assert(r.findIndex(e => e.type === 'ON_EXIT') < r.findIndex(e => e.type === 'ON_WAKE'));
b = board([toy('duck1', 0, 0, 'RIGHT', 1), toy('duck2', 7, 7, 'RIGHT', 1), toy('sleep', 2, 2, 'RIGHT', 2, { sleeping: true, sleepRemaining: 2 })]);
r = M.settle(b); assert.equal(b.toys[2].sleeping, false); assert.deepEqual(r.filter(e => e.type === 'ON_SLEEP_COUNT').map(e => e.remaining), [1, 0]);
b = board([toy('a', 0, 0, 'RIGHT', 2, { sleeping: true, sleepRemaining: 1 }), toy('b', 0, 2, 'RIGHT', 2, { sleeping: true, sleepRemaining: 1 })]);
assert.equal(M.solve(b).status, 'DEADLOCK'); b.toys[0].sleepRemaining = 0; assert.equal(M.solve(b).status, 'INVALID');
b = board([toy('r', 0, 3)], [entity('box', 'BOX', 2, 3, { hp: 2 })]);
r = M.solve(b); assert.equal(r.status, 'SOLVED'); assert.deepEqual(r.actions, ['r', 'r', 'r']);
assert.equal(M.solve(b, { maxNodes: 1 }).status, 'UNKNOWN');
assert(M.replay(b, r.actions).board.toys.every(t => t.state === 'EXITING'));
assert.equal(M.hash(b), M.hash(M.copy(b))); assert.notEqual(M.hash(b), M.hash(M.replay(b, ['r']).board));
for (const kind of ['BOX', 'SPRING']) {
  b = board([toy('r', 0, 1), toy('duck', 2, 2, 'RIGHT', 1), toy('sleeper', 4, 4, 'RIGHT', 2, { sleeping: true, sleepRemaining: 1 })],
    [entity('trigger', kind, 2, 1, { hp: 1 }), entity('wall1', 'BOX', 1, 2, { hp: 3 }), entity('wall2', 'BOX', 3, 2, { hp: 3 }), entity('wall3', 'BOX', 2, 3, { hp: 3 })]);
  assert.equal(M.duckPath(b, b.toys[1]), null);
  r = M.click(b, 'r'); assert.equal(b.toys[1].state, 'EXITING'); assert.equal(b.toys[2].sleeping, false);
  const types = r.events.map(e => e.type);
  assert(types.indexOf(kind === 'BOX' ? 'ON_DESTROY' : 'ON_PUSH') < types.indexOf('ON_AUTO_EXIT'));
  assert(types.indexOf(kind === 'SPRING' ? 'ON_SPRING_EXIT' : 'ON_AUTO_EXIT') < types.indexOf('ON_WAKE'));
}
b = board([toy('keyduck', 0, 0, 'RIGHT', 1, { keyId: 'gold' }), toy('r', 0, 2)], [entity('lock', 'LOCK_BOX', 4, 4, { keyId: 'gold' })]);
assert.equal(M.solve(b, { requireMechanics: true }).status, 'SOLVED', 'initial duck triggers are included in coverage');
console.log('Mechanics: collision, wake, hug, locks, portals, duck triggers, validation and solver PASS');
