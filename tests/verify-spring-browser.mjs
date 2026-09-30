import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '../scripts/playwright_system_chrome.mjs';
const browser = await chromium.launch({ headless: true });
const out = 'test-output/spring-slide'; await mkdir(out, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } }), errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
  await page.goto('http://127.0.0.1:4186/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.__toyhouse_art_ready);
  await page.waitForFunction(() => !!window.__toyhouse_background_ready);
  await page.evaluate(() => window.__toyhouse_background_ready);
  await page.keyboard.press('Enter'); await page.evaluate(() => window.advanceTime(1000));
  await page.evaluate(() => window.__toyhouse_debug.loadMechanicConfig({ board_width: 12, board_height: 18,
    toy_list: [
      { toy_id: 'r', archetype_id: 'ORDINARY', direction: 'R', grid_position: [0, 6], footprint: [2, 1] },
      { toy_id: 'breaker', archetype_id: 'ORDINARY', direction: 'D', grid_position: [8, 2], footprint: [1, 2] },
      { toy_id: 'sleep', archetype_id: 'LARGE', direction: 'R', grid_position: [3, 10], footprint: [3, 1], modifier: 'SLEEPING', wake_after_exits: 1 }],
    board_entities: [
      { entity_id: 'spring', kind: 'SPRING', grid_position: [3, 6], footprint: [1, 1] },
      { entity_id: 'box', kind: 'BOX', hp: 2, grid_position: [8, 6], footprint: [1, 1] }] }));
  const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
  const click = async (x, y) => {
    const state = await read(), bounds = await page.locator('#game').boundingBox();
    await page.mouse.click(bounds.x + (state.board.x + (x + .5) * state.board.cell) * bounds.width / 540,
      bounds.y + (state.board.y + (y + .5) * state.board.cell) * bounds.height / 960);
  };
  await click(3, 6); assert.equal((await read()).moves, 0, 'direct click ignored');
  await click(0, 6);
  await page.evaluate(() => window.advanceTime(400));
  await page.screenshot({ path: `${out}/moving.png` });
  await page.evaluate(() => window.advanceTime(2500));
  let state = await read();
  assert.equal(state.mechanics.entities.find(e => e.id === 'spring').x, 7);
  assert.equal(state.toys.find(t => t.id === 'sleep').sleepRemaining, 1);
  await page.screenshot({ path: `${out}/stopped.png` });
  await click(8, 2); await page.evaluate(() => window.advanceTime(3000));
  state = await read(); const breaker = state.toys.find(t => t.id === 'breaker');
  await click(breaker.x, breaker.y); await page.evaluate(() => window.advanceTime(3000));
  state = await read(); const pusher = state.toys.find(t => t.id === 'r');
  await click(pusher.x, pusher.y); await page.evaluate(() => window.advanceTime(3000));
  state = await read();
  assert(!state.mechanics.entities.some(e => e.id === 'spring'));
  assert(state.mechanics.events.some(e => e.type === 'ON_SPRING_EXIT'));
  assert.equal(state.toys.find(t => t.id === 'sleep').sleeping, false);
  await page.screenshot({ path: `${out}/exited.png` });
  assert.deepEqual(errors, []);
  console.log('Spring browser: ignored click, glide, solid stop, repeated collision, exit and waking PASS');
} finally { await browser.close(); }
