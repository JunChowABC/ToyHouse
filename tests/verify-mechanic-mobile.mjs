import assert from 'node:assert/strict';
import { chromium } from '../scripts/playwright_system_chrome.mjs';
const browser = await chromium.launch({ headless: true }), errors = [];
try {
  for (const [width, height] of [[390, 844], [540, 960], [1024, 768]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    await page.goto('http://127.0.0.1:4186/', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.__toyhouse_art_ready);
    await page.waitForFunction(() => !!window.__toyhouse_background_ready, null, { polling: 100 }); await page.evaluate(() => window.__toyhouse_background_ready);
    await page.keyboard.press('Enter'); await page.evaluate(() => { window.advanceTime(1000); window.__toyhouse_debug.startLevel(75); window.advanceTime(20); });
    await page.screenshot({ path: `test-output/mechanics-v14/mobile-${width}.png` });
    const snapshot = () => page.evaluate(() => window.__toyhouse_debug.mechanicSnapshot());
    const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const initial = await snapshot(), sleeping = initial.toys.find(t => t.sleeping), source = initial.toys.find(t => t.id !== sleeping.id && t.archetypeId !== 'AUTO_EXIT' && t.state === 'IDLE');
    const clickToy = async toy => { const s = await read(), r = await page.locator('#game').boundingBox(); await page.mouse.click(r.x + (s.board.x + (toy.x + .5) * s.board.cell) * r.width / 540, r.y + (s.board.y + (toy.y + .5) * s.board.cell + s.art.viewport.y) * r.height / s.art.viewport.height); };
    await page.evaluate(() => window.__toyhouse_debug.grantReward({ id: 'mechanic-test', source: 'task', tools: { remove: 1, flip: 1, shuffle: 1 } }));
    const tool = async id => page.evaluate(id => { const d = window.__toyhouse_debug; d.openToolModal(id); window.advanceTime(400); d.confirmTool(); window.advanceTime(400); }, id);
    await tool('flip'); await clickToy(sleeping); assert.equal((await read()).toolUses.flip, 0, 'sleeping targets cannot consume flip');
    await page.evaluate(() => { window.__toyhouse_debug.restartLevel(); window.advanceTime(1200); });
    await tool('remove'); await clickToy(source);
    const other = initial.toys.find(t => t.id !== source.id && t.id !== sleeping.id && t.archetypeId !== 'AUTO_EXIT'); await clickToy(other);
    const after = await snapshot(), remaining = after.toys.find(t => t.id === sleeping.id);
    assert(remaining.sleepRemaining <= Math.max(0, sleeping.sleepRemaining - 2), `tool removal decrements for both toys and any duck cascades: ${sleeping.sleepRemaining} -> ${remaining.sleepRemaining}; ${JSON.stringify({ uses: (await read()).toolUses, selected: [source.id, other.id].map(id => after.toys.find(t => t.id === id)?.state), paused: (await read()).paused })}`);
    assert.equal(remaining.sleeping, remaining.sleepRemaining > 0);
    assert.equal((await read()).toolUses.remove, 1); assert.equal((await read()).economy.inventory.remove, 0);
    await page.evaluate(() => window.advanceTime(4000));
    await tool('shuffle');
    const shuffled = await snapshot(), occ = new Set();
    for (const e of [...shuffled.toys, ...shuffled.entities].filter(e => e.state === 'IDLE' && !e.retracted && e.kind !== 'PORTAL')) for (const c of e.cells) {
      const key = `${c.x},${c.y}`; assert(!occ.has(key), 'shuffle must respect obstacles'); occ.add(key);
    }
    await page.evaluate(() => { window.__toyhouse_debug.restartLevel(); window.advanceTime(100); });
    const restored = await snapshot(); assert.equal(restored.toys.find(t => t.id === sleeping.id).sleepRemaining, sleeping.sleepRemaining);
    assert.deepEqual(restored.entities.map(e => [e.id, e.x, e.y, e.hp, e.state]), initial.entities.map(e => [e.id, e.x, e.y, e.hp, e.state]));
    assert.equal((await read()).toolUses.remove, 1, 'restart preserves consumed stock and per-level limits');
    await page.close();
  }
  assert.deepEqual(errors, []); console.log('Mobile: three viewports, locked flip, removal triggers, shuffle occupancy, restart and inventory PASS');
} finally { await browser.close(); }
