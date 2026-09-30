import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '../scripts/playwright_system_chrome.mjs';
import CONFIG from '../src/level-config.js';
import M from '../src/mechanics.js';

const level = CONFIG.levels.find(l => l.level_no === 76);
const expected = M.fromConfig(level);
M.settle(expected);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(`${process.env.TOYHOUSE_TEST_URL || 'http://127.0.0.1:4186'}/docs/?previewLevel=76`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'play');
  await page.evaluate(() => window.advanceTime(3000));
  let teleported = false;
  for (const id of level.solution) {
    const result = M.click(expected, id);
    const state = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const toy = state.toys.find(t => t.id === id);
    assert(toy, `${id} must still be on the board`);
    const bounds = await page.locator('#game').boundingBox();
    await page.mouse.click(bounds.x + (state.board.x + (toy.x + .5) * state.board.cell) * bounds.width / 540,
      bounds.y + (state.board.y + (toy.y + .5) * state.board.cell) * bounds.height / 960);
    await page.evaluate(() => window.advanceTime(3000));
    const after = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    assert.equal(after.moves, state.moves + 1, `click accepted: ${id}`);
    const transfer = result.events.find(e => e.type === 'TELEPORT');
    if (!transfer) continue;
    assert(after.mechanics.events.some(e => e.type === 'TELEPORT' && e.direction === transfer.direction));
    const actual = after.toys.find(t => t.id === id);
    if (actual) assert.equal(actual.direction, expected.toys.find(t => t.id === id).direction);
    await mkdir('test-output/mechanics-v14', { recursive: true });
    await page.screenshot({ path: 'test-output/mechanics-v14/portal-built-76.png' });
    teleported = true;
    break;
  }
  assert(teleported, 'witness must transfer a toy');
  assert.deepEqual(errors, []);
  console.log('Built preview: 2x2 portal transfer and facing PASS');
} finally { await browser.close(); }
