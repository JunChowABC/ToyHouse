import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '../scripts/playwright_system_chrome.mjs';
const out = 'test-output/mechanic-art-v2'; await mkdir(out, { recursive: true });
const manifest = JSON.parse(await readFile('assets/mechanics-v1/manifest.json', 'utf8'));
for (const [name, entry] of Object.entries(manifest)) {
  assert.equal(createHash('sha256').update(await readFile(entry.source)).digest('hex'), entry.sha256, name);
  const file = entry.rect ? 'mechanics.webp' : `${name}.webp`;
  assert.deepEqual(await readFile(`assets/mechanics-v1/${file}`), await readFile(`docs/assets/mechanics-v1/${file}`));
}
const toy = (id, x, y, dir, length = 2, extra = {}) => ({ toy_id: id, archetype_id: length === 3 ? 'LARGE' : 'ORDINARY', direction: dir, grid_position: [x, y], footprint: ['L', 'R'].includes(dir) ? [length, 1] : [1, length], ...extra });
const entity = (id, kind, x, y, extra = {}) => ({ entity_id: id, kind, grid_position: [x, y], footprint: [1, 1], ...extra });
const fixture = { board_width: 12, board_height: 18, toy_list: [
  toy('wake', 0, 1, 'L'), toy('other-exit', 10, 1, 'R'), toy('sleep-r', 3, 2, 'U', 2, { modifier: 'SLEEPING', wake_after_exits: 2 }),
  toy('sleep-w', 6, 3, 'L', 3, { modifier: 'SLEEPING', wake_after_exits: 2 }),
  toy('hug-source', 1, 6, 'U', 2, { pair_id: 'pink' }), toy('hug', 4, 6, 'U', 2, { modifier: 'HUG_LOCKED', pair_id: 'pink', hug_source: 'hug-source' }),
  toy('key', 8, 6, 'U', 2, { key_id: 'gold' }), toy('ice', 5, 11, 'L', 3, { modifier: 'FROZEN', ice_layers: 2 }), toy('hit', 2, 11, 'R'),
], board_entities: [entity('box', 'BOX', 1, 10, { hp: 2 }), entity('spring', 'SPRING', 2, 14), entity('lock', 'LOCK_BOX', 5, 14, { key_id: 'gold' }), entity('p1', 'PORTAL', 8, 14, { pair_id: 'violet' }), entity('p2', 'PORTAL', 10, 16, { pair_id: 'violet' })] };
const browser = await chromium.launch({ headless: true }), errors = [], reports = [];
try {
  for (const viewport of [{ width: 540, height: 960 }, { width: 390, height: 844 }, { width: 1024, height: 768 }]) {
    const page = await browser.newPage({ viewport });
    page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 0; window.artCalls = []; window.zzzCalls = [];
      const draw = CanvasRenderingContext2D.prototype.drawImage, fill = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) { if (image.src?.includes('-sleep.webp')) window.artCalls.push(image.src); return draw.call(this, image, ...args); };
      CanvasRenderingContext2D.prototype.fillText = function(text, ...args) { if (text === 'z') window.zzzCalls.push([args[0], args[1], this.globalAlpha]); return fill.call(this, text, ...args); };
    });
    const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
    await page.goto('http://127.0.0.1:4186/?previewLevel=31', { waitUntil: 'networkidle' });
    await page.evaluate(() => window.__toyhouse_art_ready); await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'play' && JSON.parse(window.render_game_to_text()).art.systems.play, null, { polling: 100 });
    await page.evaluate(c => { window.__toyhouse_debug.loadMechanicConfig(c); window.advanceTime(100); }, fixture);
    const render = ms => page.evaluate(ms => { window.artCalls = []; window.zzzCalls = []; window.advanceTime(ms); return { images: window.artCalls, zzz: window.zzzCalls }; }, ms);
    const a = await render(1); assert(a.images.some(p => p.includes('rabbit-sleep'))); assert(a.images.some(p => p.includes('whale-sleep'))); assert.equal(a.zzz.length, 6);
    await page.screenshot({ path: `${out}/all-art-${viewport.width}.png` });
    const b = await render(600); assert.notDeepEqual(a.zzz, b.zzz, 'zzz floats and fades over time');
    await page.screenshot({ path: `${out}/breathing-${viewport.width}.png` });
    await page.evaluate(() => window.__toyhouse_debug.openPause()); const paused = await render(500); const still = await render(500); assert.deepEqual(paused.zzz, still.zzz, 'pause freezes breathing');
    await page.evaluate(() => { window.__toyhouse_debug.closePause(); window.advanceTime(1200); });
    assert.equal((await read()).paused, false, 'pause closes before counting exits');
    const click = async id => { const s = await read(), t = s.toys.find(t => t.id === id), box = await page.locator('#game').boundingBox(); await page.mouse.click(box.x + (s.board.x + (t.x + .5) * s.board.cell) * box.width / 540, box.y + (s.board.y + (t.y + .5) * s.board.cell + s.art.viewport.y) * box.height / s.art.viewport.height); };
    await click('wake'); await render(3000); assert((await read()).toys.filter(t => t.id.startsWith('sleep')).every(t => t.sleepRemaining === 1 && t.sleeping), JSON.stringify({ moves: (await read()).moves, paused: (await read()).paused, events: (await read()).mechanics?.events?.slice(-8), sleepers: (await read()).toys.filter(t => t.id.startsWith('sleep')) }));
    await page.screenshot({ path: `${out}/count-one-${viewport.width}.png` });
    await click('other-exit'); const awake = await render(3000); assert.equal(awake.images.length, 0); assert.equal(awake.zzz.length, 0); assert((await read()).toys.filter(t => t.id.startsWith('sleep')).every(t => !t.sleeping && t.sleepRemaining === 0));
    await page.screenshot({ path: `${out}/awake-${viewport.width}.png` });
    await click('hit'); await render(3000); assert.equal((await read()).toys.find(t => t.id === 'ice').iceLayers, 1);
    await click('hit'); await render(3000); assert.equal((await read()).toys.find(t => t.id === 'ice').iceLayers, 0);
    await click('hug-source'); await render(3000); assert.equal((await read()).toys.find(t => t.id === 'hug').hugLocked, false);
    // Exercise the actual release entry without injecting a debug interface.
    for (const level of [31, 76, 101]) {
      await page.goto(`http://127.0.0.1:4186/docs/?previewLevel=${level}`, { waitUntil: 'networkidle' });
      await page.evaluate(() => window.__toyhouse_art_ready); await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'play' && JSON.parse(window.render_game_to_text()).art.systems.play, null, { polling: 100 });
      const draw = await render(500); assert.equal(await page.evaluate(() => typeof window.__toyhouse_debug), 'undefined');
      if (level !== 101) assert(draw.images.length > 0);
      await page.screenshot({ path: `${out}/built-${level}-${viewport.width}.png` });
    }
    reports.push({ viewport, status: 'PASS', cases: ['source provenance', 'sleep sprite rendering', 'zzz motion/pause/wake', 'ice thaw', 'hug unlock', 'release visual/no-debug'] }); await page.close();
  }
  assert.deepEqual(errors, []); await writeFile(`${out}/report.json`, JSON.stringify({ reports, errors }, null, 2)); console.log('Mechanic art v2: sources, runtime parity, 3 viewports, sleep/wake/pause, ice, hug and release assets PASS');
} finally { await browser.close(); }
