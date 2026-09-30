import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import M from '../src/mechanics.js';
const config = JSON.parse(await readFile(new URL('../config/mechanic-levels-v1.4.json', import.meta.url), 'utf8'));
const reports = [], fingerprints = new Set();
for (const level of config.levels) {
  const board = M.fromConfig(level), errors = M.validate(board);
  assert.deepEqual(errors, [], level.level_id);
  const initial = M.copy(board); const initialEvents = M.settle(board);
  const events = [...initialEvents];
  for (const id of level.solution) { const turn = M.click(board, id); assert(turn.changed, `${level.level_id}/${id} no-op in witness`); events.push(...turn.events); }
  assert(board.toys.every(t => !M.active(t)), `${level.level_id} unsolved`);
  for (const e of initial.entities) {
    const type = { BOX: 'ON_DESTROY', SPRING: 'ON_PUSH', LOCK_BOX: 'ON_UNLOCK', PORTAL: 'TELEPORT' }[e.kind];
    assert(events.some(event => event.type === type && (event.target === e.id || (e.kind === 'PORTAL' && event.destination === e.id))), `${level.level_id} unused ${e.id}`);
  }
  for (const t of initial.toys) {
    if (t.sleeping) assert(events.some(e => e.type === 'ON_WAKE' && e.target === t.id));
    if (t.hugLocked) assert(events.some(e => e.type === 'ON_UNLOCK' && e.target === t.id));
  }
  assert(initial.toys.length >= (level.mechanic_pool.includes('PORTAL') ? 67 : 72));
  assert.equal(initial.toys.length, level.validation.toyCount);
  assert.equal(new Set(initial.toys.map(t => t.archetypeId)).size, 3);
  assert.equal(new Set(initial.toys.filter(t => t.direction).map(t => t.direction)).size, 4);
  const initialExits = initial.toys.filter(t => M.manual(t) && M.scan(initial, t).exitsBoard).length;
  assert(initialExits >= 3);
  const special = initial.entities.length + initial.toys.filter(t => t.sleeping || t.pairId || t.keyId).length;
  assert(special / (initial.toys.length + initial.entities.length) <= .25);
  const fingerprint = JSON.stringify([level.toy_list.map(({ toy_id, ...t }) => t), level.board_entities.map(({ entity_id, ...e }) => e)]);
  assert(!fingerprints.has(fingerprint), 'duplicate complete configuration'); fingerprints.add(fingerprint);
  reports.push({ level: level.level_id, toys: initial.toys.length, mechanisms: level.mechanic_pool, initialExits, moves: level.solution.length, mechanismCoverage: 'ALL', status: 'PASS' });
}
assert.equal(config.levels.length, 80);
await mkdir('test-output/mechanics-v14', { recursive: true });
await writeFile('test-output/mechanics-v14/generated-levels.json', JSON.stringify(reports, null, 2));
console.log(`${reports.length} levels: no-tool witnesses, full mechanic coverage, density, directions and distinct configurations PASS`);
