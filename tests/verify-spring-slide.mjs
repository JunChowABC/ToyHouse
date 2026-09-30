import assert from 'node:assert/strict';
import M from '../src/mechanics.js';
const fixture = (direction = 'R') => M.fromConfig({ board_width: 8, board_height: 8,
  toy_list: [{ toy_id: 'r', archetype_id: 'ORDINARY', direction, grid_position: [0, 3], footprint: [2, 1] },
    { toy_id: 'sleep', archetype_id: 'ORDINARY', direction: 'L', grid_position: [0, 0], footprint: [2, 1], modifier: 'SLEEPING', wake_after_exits: 1 }],
  board_entities: [{ entity_id: 'spring', kind: 'SPRING', grid_position: [2, 3], footprint: [1, 1] },
    { entity_id: 'wall', kind: 'BOX', hp: 2, grid_position: [6, 3], footprint: [1, 1] }] });
let b = fixture();
assert.equal(M.click(b, 'spring').changed, false, 'spring cannot move by direct click');
let result = M.click(b, 'r');
assert.equal(b.entities[0].x, 5, 'slides several cells to the first obstacle');
assert.equal(b.entities[0].state, 'IDLE');
assert.equal(b.entities[1].hp, 2, 'spring stops without damaging the obstacle');
assert.equal(M.occupied(b).get('5,3'), 'spring', 'stopped spring remains solid');
assert.equal(b.toys[1].sleepRemaining, 1, 'moving without leaving does not count');
assert.equal(result.events.find(e => e.type === 'ON_PUSH').travel.length, 3);
M.click(b, 'r'); // pusher catches up; blocked spring stays in place
assert.equal(b.entities[0].x, 5);
b.entities[1].state = 'DESTROYED';
result = M.click(b, 'r');
assert.equal(b.entities[0].state, 'EXITING', 'spring can be pushed again, then leave');
assert.equal(b.toys[1].sleepRemaining, 0, 'spring departure wakes sleeping toy');
assert(result.events.some(e => e.type === 'ON_SPRING_EXIT'));
M.settle(b, [{ type: 'ON_EXIT', source: 'spring' }]);
assert.equal(b.toys[1].sleepRemaining, 0, 'departure is counted once');
for (const [direction, x, y] of [['LEFT', 7, 3], ['RIGHT', 0, 3], ['UP', 3, 7], ['DOWN', 3, 0]]) {
  b = { cols: 8, rows: 8, toys: [], entities: [{ id: 's', kind: 'SPRING', state: 'IDLE', x, y, cells: [{ x, y }] }] };
  M.settle(b, [{ type: 'ON_COLLIDE', source: 'hit', target: 's', direction, depth: 0 }]);
  assert.equal(b.entities[0].state, 'EXITING', direction);
  assert.equal(b.entities[0].direction, direction);
}
console.log('Spring: click rejection, continuous sliding, solid stop, repeat hits, four-direction departure and wake count PASS');
