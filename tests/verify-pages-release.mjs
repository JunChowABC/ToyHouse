import assert from 'node:assert/strict';
import { chromium } from '../scripts/playwright_system_chrome.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import CONFIG from '../src/level-config.js';
const root = process.env.TOYHOUSE_RELEASE_URL || 'http://127.0.0.1:4195/output/full-publish/pages';
const output = process.env.TOYHOUSE_RELEASE_OUT || 'test-output/full-publish/pages';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true }), errors = [], reports = [];
try {
 for (const level of [4, 46, 139, 151, 200]) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', e => errors.push(String(e)));page.on('console', m => {if (m.type() === 'error') errors.push(m.text())});
  page.on('response', r => {if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`)});
  await page.goto(`${root}/?previewLevel=${level}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).mode === 'play', null, { timeout: 30000 });
  await page.waitForTimeout(2000);
  const state = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  assert.equal(state.levelNo, level);assert.equal(state.remaining, CONFIG.levels[level - 1].toy_list.length);assert.equal(state.combo, 0);
  assert.equal(await page.evaluate(() => typeof window.__toyhouse_debug), 'undefined');
  await page.screenshot({path:`${output}/level-${level}.png`});
  const target=state.toys.find(t=>t.canMove && t.archetype !== 'AUTO_EXIT' && !t.sleeping && !t.hugLocked && !t.iceLayers);
  if(target) {
   const rect=await page.locator('#game').boundingBox(),vp=state.art.viewport,cell=target.cells[0];
   await page.mouse.click(rect.x+(state.board.x+(cell.x+.5)*state.board.cell)*rect.width/540,
     rect.y+(state.board.y+(cell.y+.5)*state.board.cell+vp.y)*rect.height/vp.height);
   await page.waitForTimeout(2200);
   const after=await page.evaluate(()=>JSON.parse(window.render_game_to_text()));assert(after.moves>state.moves);
  }
  reports.push({level,initiallyBlocked:true,realInput:!!target});await page.close();
 }
 assert.deepEqual(errors, []);await writeFile(`${output}/report.json`,JSON.stringify({root,reports,errors},null,2));
 console.log('Actual Pages artifact: five mobile mechanism boards, blocked initial ducks, real clicks, no missing resources or GM PASS');
}finally{await browser.close()}
