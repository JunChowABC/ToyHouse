import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../scripts/playwright_system_chrome.mjs';
import CONFIG from '../src/level-config.js';
const root = process.env.TOYHOUSE_TEST_URL || 'http://127.0.0.1:4195';
const output = 'test-output/levels-v22'; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true }), errors = [], reports = [];
try {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(root + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.__toyhouse_art_ready);
  for (let i = 0; i < 200; i++) {
    const state = await page.evaluate(index => { window.__toyhouse_debug.startLevel(index); return JSON.parse(window.render_game_to_text()); }, i);
    assert.equal(state.levelNo, i + 1);
    assert.equal(state.remaining, CONFIG.levels[i].toy_list.length, `level ${i + 1}: no automatic exit on start`);
    assert.equal(state.combo, 0, `level ${i + 1}: initial combo`);
    assert.equal(state.exitingToys.length, 0, `level ${i + 1}: no opening duck animation`);
    const board = await page.evaluate(() => window.__toyhouse_debug.mechanicSnapshot());
    for (const expected of CONFIG.levels[i].toy_list) {
      const actual = board.toys.find(t => t.id === expected.toy_id);
      assert(actual, expected.toy_id);
    }
    reports.push({ level: i + 1, loaded: true });
  }
  for (const level of [4, 29, 61, 139, 192, 198, 200]) {
    await page.evaluate(i => window.__toyhouse_debug.startLevel(i), level - 1);
    await page.waitForTimeout(500);
    const initial = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    assert.equal(initial.remaining, CONFIG.levels[level - 1].toy_list.length);
    assert.equal(initial.combo, 0);
    if ([139, 192, 198, 200].includes(level)) {
      await page.evaluate(() => window.advanceTime(3000));
      assert.equal((await page.evaluate(() => JSON.parse(window.render_game_to_text()))).remaining, initial.remaining);
      await page.evaluate(() => window.__toyhouse_debug.restartLevel());
      assert.equal((await page.evaluate(() => JSON.parse(window.render_game_to_text()))).remaining, initial.remaining);
    }
    await page.screenshot({ path: `${output}/source-${level}.png` });
    const id = await page.evaluate(() => window.__toyhouse_debug.availableIds()[0] || window.__toyhouse_debug.movableIds()[0]);
    if (id) { await page.evaluate(id => window.__toyhouse_debug.clickToy(id), id); await page.waitForTimeout(1500); }
    assert.equal((await page.evaluate(() => JSON.parse(window.render_game_to_text()))).levelNo, level);
  }
  for (const level of [4, 139, 200]) {
    const release = await browser.newPage({ viewport: { width: 390, height: 844 } });
    release.on('pageerror', e => errors.push(String(e)));
    release.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await release.goto(`${root}/docs/?previewLevel=${level}`, { waitUntil: 'networkidle' });
    await release.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'play', null, { timeout: 30000 });
    const state = await release.evaluate(() => JSON.parse(window.render_game_to_text()));
    assert.equal(state.levelNo, level); assert.equal(await release.evaluate(() => typeof window.__toyhouse_debug), 'undefined');
    assert.equal(state.remaining, CONFIG.levels[level - 1].toy_list.length);
    assert.equal(state.combo, 0); assert.equal(state.exitingToys.length, 0);
    await release.screenshot({ path: `${output}/release-${level}.png` });
    await release.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${output}/browser-report.json`, JSON.stringify({ reports, release: [4, 139, 200], errors }, null, 2));
  console.log('200 source levels + sampled gameplay + 3 mobile release boards: PASS, zero browser errors');
} finally { await browser.close(); }
