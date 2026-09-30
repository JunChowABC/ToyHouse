import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../scripts/playwright_system_chrome.mjs';
import CONFIG from '../src/level-config.js';
import M from '../src/mechanics.js';
const out = 'test-output/mechanics-v14'; await mkdir(out, { recursive: true });
const root = process.env.TOYHOUSE_TEST_URL || 'http://127.0.0.1:4186';
const errors = [], reports = [];
const browser = await chromium.launch({ headless: true });
const fixture = {
  board_width: 12, board_height: 18,
  toy_list: [
    { toy_id: 'box-rabbit', archetype_id: 'ORDINARY', direction: 'R', footprint: [2, 1], grid_position: [0, 3] },
    { toy_id: 'wake-source', archetype_id: 'ORDINARY', direction: 'L', footprint: [2, 1], grid_position: [0, 5] },
    { toy_id: 'sleep', archetype_id: 'LARGE', direction: 'R', footprint: [3, 1], grid_position: [4, 5], modifier: 'SLEEPING', wake_after_exits: 2 },
    { toy_id: 'hug-source', archetype_id: 'ORDINARY', direction: 'R', footprint: [2, 1], grid_position: [4, 7], pair_id: 'pink' },
    { toy_id: 'hug', archetype_id: 'ORDINARY', direction: 'R', footprint: [2, 1], grid_position: [0, 9], modifier: 'HUG_LOCKED', hug_source: 'hug-source', pair_id: 'pink' },
    { toy_id: 'key', archetype_id: 'ORDINARY', direction: 'L', footprint: [2, 1], grid_position: [0, 11], key_id: 'gold' },
    { toy_id: 'portal-whale', archetype_id: 'LARGE', direction: 'R', footprint: [3, 1], grid_position: [0, 13] },
    { toy_id: 'spring-rabbit', archetype_id: 'ORDINARY', direction: 'R', footprint: [2, 1], grid_position: [0, 15] },
  ],
  board_entities: [
    { entity_id: 'box', kind: 'BOX', grid_position: [3, 3], hp: 2 },
    { entity_id: 'spring', kind: 'SPRING', grid_position: [3, 15] },
    { entity_id: 'lock', kind: 'LOCK_BOX', grid_position: [8, 9], key_id: 'gold', footprint: [1, 2] },
    { entity_id: 'p1', kind: 'PORTAL', grid_position: [4, 13], footprint: [2, 2], pair_id: 'purple' },
    { entity_id: 'p2', kind: 'PORTAL', grid_position: [8, 2], footprint: [2, 2], pair_id: 'purple' },
  ],
};
try {
  for (const entry of (process.env.TEST_BUILT ? ['/', '/docs/'] : ['/'])) {
    const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
    page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.goto(root + entry, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.__toyhouse_art_ready); await page.waitForFunction(() => !!window.__toyhouse_background_ready, null, { polling: 100 }); await page.evaluate(() => window.__toyhouse_background_ready);
    await page.keyboard.press('Enter'); await page.evaluate(() => window.advanceTime(1000));
    await page.evaluate(c => window.__toyhouse_debug.loadMechanicConfig(c), fixture);
    const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const snapshot = () => page.evaluate(() => window.__toyhouse_debug.mechanicSnapshot());
    const click = async id => {
      const state = await read(), toy = state.toys.find(t => t.id === id), bounds = await page.locator('#game').boundingBox();
      await page.mouse.click(bounds.x + (state.board.x + (toy.x + .5) * state.board.cell) * bounds.width / 540,
        bounds.y + (state.board.y + (toy.y + .5) * state.board.cell) * bounds.height / 960);
    };
    await page.screenshot({ path: `${out}/${entry === '/' ? 'source' : 'built'}-six-mechanics.png` });
    await click('sleep'); assert.equal((await read()).moves, 0);
    await click('box-rabbit'); assert.equal((await snapshot()).entities[0].hp, 1);
    await click('box-rabbit'); assert.equal((await snapshot()).entities[0].hp, 1, 'busy rejects repeated input');
    await page.evaluate(() => window.advanceTime(2000)); await click('box-rabbit'); assert.equal((await snapshot()).entities[0].state, 'DESTROYED');
    assert.equal((await read()).combo, 0, 'breaking box does not award combo');
    await page.evaluate(() => window.advanceTime(2000)); await click('wake-source'); assert.equal((await snapshot()).toys.find(t => t.id === 'sleep').sleepRemaining, 1);
    await page.evaluate(() => window.advanceTime(2000)); await click('hug-source'); assert.equal((await snapshot()).toys.find(t => t.id === 'sleep').sleeping, false); assert.equal((await snapshot()).toys.find(t => t.id === 'hug').hugLocked, false);
    await page.evaluate(() => window.advanceTime(2000)); await click('key'); assert.equal((await snapshot()).entities.find(e => e.id === 'lock').state, 'DESTROYED');
    await page.evaluate(() => window.advanceTime(2000)); await click('portal-whale'); assert((await read()).mechanics.events.some(e => e.type === 'TELEPORT'));
    await page.evaluate(() => window.advanceTime(250)); await page.screenshot({ path: `${out}/portal-motion-${entry === '/' ? 'source' : 'built'}.png` });
    await page.evaluate(() => window.advanceTime(2000)); await click('spring-rabbit'); assert.equal((await snapshot()).entities.find(e => e.id === 'spring').state, 'EXITING');
    await page.evaluate(() => window.advanceTime(2000));
    for (let index = 0; index < 20; index++) {
      const config = CONFIG.levels[index];
      const result = await page.evaluate(({ index, source }) => {
        const debug = window.__toyhouse_debug; debug.startLevel(index);
        const initial = JSON.parse(window.render_game_to_text());
        debug.clearCurrentLevel(); window.advanceTime(5000);
        return { initial, final: JSON.parse(window.render_game_to_text()) };
      }, { index, source: config });
      assert.equal(result.initial.remaining, 72);
      for (const t of config.toy_list) {
        const actual = result.initial.toys.find(a => a.id === t.toy_id); assert.deepEqual([actual.x, actual.y], t.grid_position);
      }
      assert.equal(result.final.mode, 'level-complete'); assert.equal(result.final.remaining, 0);
      assert.equal(result.final.bestCombo, 72);
      reports.push({ level: config.level_id, entry, status: 'PASS', regression: true });
    }
    // Exact engine/runtime parity for every generated level and full no-tool playthrough.
    for (let index = 20; index < CONFIG.levels.length; index++) {
      const config = CONFIG.levels[index], expected = M.fromConfig(config); M.settle(expected);
      await page.evaluate(i => window.__toyhouse_debug.startLevel(i), index);
      await page.evaluate(() => window.advanceTime(3000));
      assert.equal(M.hash(await snapshot()), M.hash(expected));
      if ([20, 30, 40, 50, 60, 75, 99].includes(index)) await page.screenshot({ path: `${out}/level-${index + 1}-${entry === '/' ? 'source' : 'built'}.png` });
      for (const id of config.solution) {
        const result = M.click(expected, id); assert(result.changed);
        await page.evaluate(id => { window.__toyhouse_debug.clickToy(id); window.advanceTime(3000); }, id);
        assert.equal(M.hash(await snapshot()), M.hash(expected), `parity ${config.level_id}/${id}`);
      }
      const state = await read(); assert.equal(state.remaining, 0); assert.equal(state.mode, 'level-complete'); assert.deepEqual(state.toolUses, { remove: 0, flip: 0, shuffle: 0 });
      assert.equal(state.completion.rewards[0].amount, 30);
      await page.evaluate(() => window.__toyhouse_debug.restartLevel());
      // Restart is also available from completion via the debug adapter; reset all mechanic state.
      const initial = M.fromConfig(config); M.settle(initial); assert.equal(M.hash(await snapshot()), M.hash(initial));
      reports.push({ level: config.level_id, entry, moves: config.solution.length, status: 'PASS' });
    }
    await page.close();
  }
  assert.deepEqual(errors, []); await writeFile(`${out}/report.json`, JSON.stringify({ errors, reports }, null, 2));
  console.log(`Mechanics browser: ${reports.length} complete playthroughs and six interaction scenarios PASS`);
} finally { await browser.close(); }
