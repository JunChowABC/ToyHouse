import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../scripts/playwright_system_chrome.mjs';
import M from '../src/mechanics.js';
const out = 'test-output/mechanics-v15'; await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true }), errors = [], reports = [];
const toy = (id, x, y, direction = 'R', length = 2, extra = {}) => ({ toy_id: id, archetype_id: length === 3 ? 'LARGE' : 'ORDINARY', grid_position: [x, y], footprint: ['L', 'R'].includes(direction) ? [length, 1] : [1, length], direction, ...extra });
const entity = (id, kind, x, y, extra = {}) => ({ entity_id: id, kind, grid_position: [x, y], footprint: [1, 1], ...extra });
try {
  for (const entry of ['/', '/docs/']) for (const viewport of [{ width: 540, height: 960 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.goto(`http://127.0.0.1:4186${entry}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => window.__toyhouse_art_ready);
    await page.waitForFunction(() => !!window.__toyhouse_background_ready, null, { polling: 100 });
    await page.evaluate(() => window.__toyhouse_background_ready);
    const advance = async () => page.evaluate(() => window.advanceTime(2500));
    const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const snapshot = () => page.evaluate(() => window.__toyhouse_debug.mechanicSnapshot());
    const load = async (toys, entities = []) => { await page.evaluate(c => window.__toyhouse_debug.loadMechanicConfig(c), { board_width: 12, board_height: 18, toy_list: toys, board_entities: entities }); await advance(); };
    const click = async id => {
      const s = await read(), t = s.toys.find(t => t.id === id), b = await page.locator('#game').boundingBox();
      await page.mouse.click(b.x + (s.board.x + (t.x + .5) * s.board.cell) * b.width / 540, b.y + (s.board.y + (t.y + .5) * s.board.cell) * b.height / 960);
    };
    const shot = name => page.screenshot({ path: `${out}/${name}-${entry === '/' ? 'source' : 'built'}-${viewport.width}.png` });
    await load([toy('hit', 0, 3), toy('ice', 2, 3, 'D', 3, { modifier: 'FROZEN', ice_layers: 2 })]);
    await click('ice'); assert.equal((await read()).moves, 0); await shot('ice');
    const before = M.hash(await snapshot()); await page.evaluate(() => window.__toyhouse_debug.flipToy('ice')); assert.equal(M.hash(await snapshot()), before);
    await page.evaluate(() => { const d = window.__toyhouse_debug; d.grantReward({ id: 'ice-tools', source: 'task', tools: { flip: 1, shuffle: 1 } }); d.openToolModal('flip'); window.advanceTime(400); d.confirmTool(); window.advanceTime(400); });
    await click('ice'); assert.equal((await read()).toolUses.flip, 0); assert.equal((await read()).economy.inventory.flip, 1);
    await load([toy('hit', 0, 3), toy('ice', 2, 3, 'D', 3, { modifier: 'FROZEN', ice_layers: 2 })]);
    await click('hit'); assert.equal((await snapshot()).toys.find(t => t.id === 'ice').ice, 1);
    await advance(); await click('hit'); assert.equal((await snapshot()).toys.find(t => t.id === 'ice').ice, 0);
    await advance(); await click('ice'); assert.equal((await snapshot()).toys.find(t => t.id === 'ice').state, 'EXITING');
    await load([toy('ice', 2, 3, 'D', 3, { modifier: 'FROZEN', ice_layers: 1 }), toy('other', 7, 10)]);
    const frozen = (await snapshot()).toys[0];
    await page.evaluate(() => { const d = window.__toyhouse_debug; d.openToolModal('shuffle'); window.advanceTime(400); d.confirmTool(); window.advanceTime(400); });
    assert.deepEqual((await snapshot()).toys[0], frozen, 'shuffle excludes frozen toys'); assert.equal((await read()).toolUses.shuffle, 1);
    await load([toy('r', 0, 3)], [entity('gate', 'ONE_WAY_EXIT', 11, 3, { direction: 'U' })]);
    await click('r'); assert.equal((await snapshot()).toys[0].state, 'IDLE'); assert((await read()).mechanics.events.some(e => e.type === 'ON_GATE_BLOCKED')); await shot('gate-blocked');
    await load([toy('r', 0, 3)], [entity('gate', 'ONE_WAY_EXIT', 11, 3, { direction: 'R' })]);
    await click('r'); assert((await read()).mechanics.events.some(e => e.type === 'ON_GATE_PASS'));
    const belt = entity('belt', 'CONVEYOR', 0, 2, { footprint: [6, 3], direction: 'R', period: 2 });
    await load([toy('a', 0, 2), toy('b', 2, 2), toy('c1', 0, 8), toy('c2', 0, 10)], [belt]);
    await click('c1'); assert.equal((await snapshot()).entities[0].phase, 1); await advance();
    const paused = M.hash(await snapshot()); await page.evaluate(() => window.__toyhouse_debug.openPause()); await advance(); await click('c2'); assert.equal(M.hash(await snapshot()), paused);
    await page.evaluate(() => window.__toyhouse_debug.closePause()); await advance(); await click('c2');
    assert.deepEqual((await snapshot()).toys.slice(0, 2).map(t => t.x), [1, 3]); await page.evaluate(() => window.advanceTime(150)); await shot('conveyor-motion'); await advance();
    await load([toy('a', 0, 2), toy('b', 2, 2), toy('wall', 4, 2, 'D', 3), toy('clock', 0, 8)], [{ ...belt, footprint: [4, 3], period: 1 }]);
    await click('clock'); assert.deepEqual((await snapshot()).toys.slice(0, 2).map(t => t.x), [0, 2]); assert((await read()).mechanics.events.some(e => e.type === 'ON_ZONE_BLOCKED'));
    const rotor = entity('rot', 'ROTATOR', 1, 2, { footprint: [4, 4], period: 1, clockwise: true });
    await load([toy('whale', 1, 4, 'R', 3), toy('clock', 0, 10)], [rotor]);
    await click('clock'); assert.equal((await snapshot()).toys[0].direction, 'DOWN'); assert.deepEqual(M.validate(await snapshot()), []); await advance(); await shot('rotation');
    await load([toy('a', 1, 4), toy('b', 4, 2, 'D'), toy('clock', 0, 10)], [rotor]);
    await click('clock'); assert.equal((await snapshot()).toys[0].direction, 'RIGHT'); assert((await read()).mechanics.events.some(e => e.type === 'ON_ZONE_BLOCKED'));
    for (const index of [100, 104, 106, 108]) { await page.evaluate(i => window.__toyhouse_debug.startLevel(i), index); await advance(); await shot(`level-${index + 1}`); }
    reports.push({ entry, viewport, status: 'PASS', cases: ['ice hit/thaw/flip denial', 'gate reject/pass', 'conveyor period/pause/atomic movement/block', 'rotation footprint/atomic block', 'dense levels'] });
    await page.close();
  }
  assert.deepEqual(errors, []); await writeFile(`${out}/browser-report.json`, JSON.stringify({ reports, errors }, null, 2)); console.log('Four mechanisms browser: source/build, desktop/mobile real pointer interactions PASS');
} finally { await browser.close(); }
