import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import M from '../src/mechanics.js';
import G from '../src/mechanic-generator.js';

const toy = (id, x, y, length = 2) => ({ id, x, y, direction: 'RIGHT', archetypeId: length === 3 ? 'LARGE' : 'ORDINARY', state: 'IDLE',
  cells: Array.from({ length }, (_, i) => ({ x: x + i, y })) });
const entity = (id, kind, x, y, extra = {}) => ({ id, kind, x, y, state: 'IDLE',
  cells: kind === 'PORTAL' ? [0, 1].flatMap(dy => [0, 1].map(dx => ({ x: x + dx, y: y + dy }))) : [{ x, y }], ...extra });
const portal = (id, x, y) => entity(id, 'PORTAL', x, y, { pairId: 'pair' });
const board = (toys, entities, randomState = 7) => ({ cols: 12, rows: 12, toys, entities, randomState });
const outletWalls = () => [
  ...[[6, 5], [6, 6], [9, 5], [9, 6], [7, 7], [8, 7]].map(([x, y], i) => entity(`wall${i}`, 'BOX', x, y, { hp: 2 })),
];

let b = board([], [portal('a', 0, 0), portal('b', 7, 5)]);
assert.equal(M.portalExits(b, b.entities[1], 2, 'r').length, 8, 'both lanes on each side are checked');
assert.equal(M.portalExits(b, b.entities[1], 3, 'w').length, 8, 'whole whale fits on each open lane');
assert.deepEqual(M.validate(b), []);
b.entities[0].cells = [{ x: 0, y: 0 }];
assert(M.validate(b).includes('INVALID_FOOTPRINT:a'), 'a portal must occupy exactly 2x2');

for (const length of [2, 3]) {
  const id = length === 2 ? 'rabbit' : 'whale';
  b = board([toy(id, 0, 5, length)], [portal('a', length + 1, 5), portal('b', 7, 5), ...outletWalls()]);
  assert.deepEqual(M.validate(b), []);
  const beforeSeed = b.randomState, preview = M.scan(b, b.toys[0]);
  assert.equal(b.randomState, beforeSeed, 'preview does not consume randomness');
  assert.equal(preview.portals[0].direction, 'UP');
  assert.equal(preview.travel.find(step => step.teleport).cells.length, length);
  assert(preview.travel.find(step => step.teleport).cells.every(cell => cell.y < 5), 'complete toy appears outside destination portal');
  const turn = M.click(b, id);
  assert(turn.events.some(e => e.type === 'TELEPORT' && e.direction === 'UP'));
  assert.equal(b.toys[0].direction, 'UP');
  assert.notEqual(b.randomState, beforeSeed);
}

b = board([toy('rabbit', 0, 5)], [portal('a', 3, 5), portal('b', 7, 5), ...outletWalls(),
  entity('up0', 'BOX', 7, 4, { hp: 2 }), entity('up1', 'BOX', 8, 4, { hp: 2 })]);
const stopped = M.click(b, 'rabbit');
assert.equal(b.toys[0].x, 1, 'blocked transfer stops immediately before the entrance');
assert.equal(b.toys[0].direction, 'RIGHT');
assert(!stopped.events.some(e => e.type === 'TELEPORT'));
assert.equal(b.randomState, 7, 'failed transfer does not consume randomness');

b = board([toy('pusher', 0, 5)], [entity('spring', 'SPRING', 2, 5), portal('a', 3, 5), portal('b', 7, 5), ...outletWalls()]);
let turn = M.click(b, 'pusher');
assert(turn.events.some(e => e.type === 'TELEPORT' && e.source === 'spring' && e.direction === 'UP'));
assert.equal(b.entities[0].direction, 'UP');
assert.equal(b.entities[0].state, 'EXITING');
assert(b.entities[0].y < 5);

b = board([toy('pusher', 0, 5)], [entity('spring', 'SPRING', 2, 5), portal('a', 3, 5), portal('b', 7, 5), ...outletWalls(),
  entity('up0', 'BOX', 7, 4, { hp: 2 }), entity('up1', 'BOX', 8, 4, { hp: 2 })]);
turn = M.click(b, 'pusher');
assert.equal(b.entities[0].x, 2);
assert.equal(b.entities[0].retracted, undefined);
assert(!turn.events.some(e => e.type === 'TELEPORT'));

const destinations = new Set();
for (let seed = 1; seed <= 64; seed++) {
  b = board([toy('rabbit', 0, 5)], [portal('a', 3, 5), portal('b', 7, 5)], seed);
  const preview = M.scan(b, b.toys[0]);
  destinations.add(`${preview.portals[0].direction}:${preview.portals[0].lane}`);
  assert.deepEqual(M.scan(b, b.toys[0]).portals, preview.portals, 'same state replays the same random choice');
}
assert(destinations.size >= 4, 'different seeds use multiple legal outlets');
assert.deepEqual(new Set([...destinations].map(value => value.split(':')[0])), new Set(['LEFT', 'RIGHT', 'UP', 'DOWN']));
const base = JSON.parse(await readFile(new URL('../docs/design/核心玩法系统/晚安玩具屋_关卡配置_1-20_v1.3.json', import.meta.url), 'utf8'));
const generated = G.generate(base.levels[16], { levelNo: 76, seed: 23788, maxNodes: 500 });
assert.equal(generated.board_entities.filter(e => e.kind === 'PORTAL' && e.footprint.join('x') === '2x2').length, 2);
assert.deepEqual(M.validate(M.fromConfig(generated)), []);
console.log('2x2 portals: complete rabbit/whale/spring transfer, 4-side outlets, blocking, facing and seeded selection PASS');
