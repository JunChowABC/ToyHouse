import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { chromium } from '../scripts/playwright_system_chrome.mjs';
const browser = await chromium.launch({ headless: true }), errors = [];
const out = 'test-output/mechanics-v14'; await mkdir(out, { recursive: true });
const legacyExtra = JSON.parse(await readFile(new URL('../config/extra-mechanic-levels-v1.5.json', import.meta.url), 'utf8'));
try {
  for (const entry of ['/editor/', '/docs/editor/']) {
    const page = await browser.newPage({ viewport: { width: 1340, height: 1080 } });
    page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${process.env.TOYHOUSE_TEST_URL || 'http://127.0.0.1:4186'}${entry}`, { waitUntil: 'networkidle' });
    assert((await page.locator('#level option').count()) >= 100);
    assert.equal(await page.locator('#pool input').count(), 10);
    const extraFixture = legacyExtra.levels.find(l => l.mechanic_pool.includes('CONVEYOR') && l.mechanic_pool.includes('ROTATOR') && l.mechanic_pool.includes('ONE_WAY_EXIT'));
    await page.locator('#import').setInputFiles({ name: 'extra-fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(extraFixture)) });
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('导入成功'));
    for (const kind of ['CONVEYOR', 'ROTATOR', 'ONE_WAY_EXIT']) {
      const value = await page.locator('#entityList option').evaluateAll((options, label) => options.find(o => o.textContent.includes(label))?.value, { CONVEYOR: '传送带', ROTATOR: '旋转区域', ONE_WAY_EXIT: '单向出口' }[kind]);
      assert(value, `selectable ${kind}`); await page.selectOption('#entityList', value);
      if (kind !== 'ONE_WAY_EXIT') {
        assert(await page.locator('#period').isEnabled()); await page.fill('#period', '3');
        await page.locator('#properties button').click(); assert((await page.locator('#status').textContent()).includes('修改已应用'));
      } else assert(await page.locator('#direction').isEnabled());
    }
    const extraDownload = page.waitForEvent('download'); await page.click('#export');
    const extra = await extraDownload, exported = JSON.parse(await readFile(await extra.path(), 'utf8'));
    assert.equal(exported.board_entities.find(e => e.kind === 'CONVEYOR').period, 3);
    assert.equal(exported.board_entities.find(e => e.kind === 'ROTATOR').period, 3);
    assert(exported.toy_list.some(t => t.modifier === 'FROZEN'));
    assert(!exported.solution, 'edits invalidate solution');
    await page.selectOption('#level', '76');
    await page.screenshot({ path: `${out}/editor-${entry.includes('/docs') ? 'built' : 'source'}.png` });
    await page.click('#graphTab'); assert(await page.locator('#graph svg').isVisible()); assert(!(await page.locator('#board').isVisible()));
    await page.screenshot({ path: `${out}/graph-${entry.includes('/docs') ? 'built' : 'source'}.png` });
    await page.click('#boardTab');
    const fixture = { level_no: 21, level_id: 'L021', level_name: '编辑回归', board_width: 12, board_height: 18,
      toy_list: [{ toy_id: 'r', archetype_id: 'ORDINARY', direction: 'R', grid_position: [0, 2], footprint: [2, 1] }],
      board_entities: [{ entity_id: 'box', kind: 'BOX', hp: 2, grid_position: [3, 2], footprint: [1, 1] }] };
    await page.locator('#import').setInputFiles({ name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
    await page.waitForFunction(() => document.querySelector('#status').textContent.includes('导入成功'));
    await page.click('#analyze'); await page.waitForFunction(() => document.querySelector('#status').textContent.includes('无道具解法'), { timeout: 60000 });
    const report = JSON.parse(await page.locator('#report').textContent()); assert.equal(report.status, 'SOLVED'); assert.equal(report.shiftSafety.safe, 1);
    await page.click('#next'); assert((await page.locator('#events').textContent()).includes('DAMAGE'));
    await page.click('#undo'); await page.click('#reset');
    const downloadPromise = page.waitForEvent('download'); await page.click('#export'); const download = await downloadPromise; assert.equal(download.suggestedFilename(), 'L021-v1.4.json');
    await page.selectOption('#level', '21'); await page.click('details summary'); await page.fill('#limit', '500');
    await page.click('#generate');
    await page.waitForFunction(() => !document.querySelector('#status').textContent.includes('正在计算'), { timeout: 90000 });
    assert((await page.locator('#status').textContent()).includes('无道具解法'));
    assert.equal(JSON.parse(await page.locator('#report').textContent()).toyCount, 72);
    await page.close();
  }
  assert.deepEqual(errors, []); console.log('Editor: source/build, board/graph, worker analysis, replay, undo, JSON import/export, generation PASS');
} finally { await browser.close(); }
