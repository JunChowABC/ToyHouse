import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '../scripts/playwright_system_chrome.mjs';
import ART from '../src/art-manifest.js';
assert.ok(!Object.keys(ART.assets).some(id => id.startsWith('board_') || id === 'art_combo_value_5'));
await mkdir('test-output/core-ui-v4', { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  for (const [entry, width, height] of [['/',540,960], ['/docs/',390,844]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('response', r => { if(r.status() >= 400) errors.push(r.url()); });
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 0;
      const p = CanvasRenderingContext2D.prototype, draw = p.drawImage, clear = p.clearRect;
      window.__uiDraws = [];
      p.clearRect = function(...args) { window.__uiDraws=[]; return clear.apply(this,args); };
      p.drawImage = function(im,...args) { window.__uiDraws.push({file:im.src?.split('/').pop(),scale:this.getTransform().a}); return draw.call(this,im,...args); };
    });
    await page.goto('http://127.0.0.1:4173'+entry+'?qa', {waitUntil:'networkidle'});
    await page.waitForFunction(() => Boolean(window.__toyhouse_background_ready));
    await page.evaluate(() => window.__toyhouse_background_ready);
    await page.evaluate(() => window.__toyhouse_debug.startLevel(0));
    const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const trace = () => page.evaluate(() => { window.advanceTime(0); return window.__uiDraws; });
    const move = async r => {
      const b = await page.locator('#game').boundingBox();
      await page.mouse.move(b.x+(r.x+r.w/2)*b.width/540,b.y+(r.y+r.h/2)*b.height/960);
    };
    const hit = async r => { await move(r); await page.mouse.down(); await page.mouse.up(); };
    let s = await read();
    assert.equal(s.art.version,'core-ui-v4');
    for (const button of s.uiHitAreas.tools) {
      const before=(await trace()).find(d=>d.file===button.id+'_base.png');
      await move(button); await page.mouse.down(); await page.waitForTimeout(120);
      const held=(await trace()).find(d=>d.file===button.id+'_base.png');
      assert.ok(held.scale < before.scale, button.id+' pressed scale');
      await page.mouse.move(1,1); await page.mouse.up();
      assert.equal((await read()).toolDialog,null);
      await hit(button);
      assert.equal((await read()).toolDialog.id,button.id);
      await page.keyboard.press('Escape');
    }
    await hit(s.uiHitAreas.pause);
    assert.equal((await read()).paused,true);
    await page.keyboard.press('Escape');
    assert.equal((await read()).paused,false);
    // Use real toy exits to build a two-digit combo, never a mocked counter.
    await page.evaluate(() => {
      for(let i=0;i<12;i++) {
        const id=window.__toyhouse_debug.availableIds()[0];
        if(!id) throw new Error('Expected another legal exit');
        window.__toyhouse_debug.clickToy(id);
        window.advanceTime(100);
      }
    });
    s=await read(); assert.equal(s.combo,12);
    const files=(await trace()).map(d=>d.file);
    for(const file of ['art_combo_label.png','digit_1.png','digit_2.png','combo_fill.png','level_star_1.png',
      'remove_label.png','shuffle_label.png','flip_label.png']) assert.ok(files.includes(file),file);
    assert.ok(!files.some(f=>f?.startsWith('board_')));
    await page.screenshot({path:`test-output/core-ui-v4/${width}-combo12.png`});
    await page.evaluate(()=>window.advanceTime(3900));
    await page.screenshot({path:`test-output/core-ui-v4/${width}-cream-track-half.png`});
    await hit(s.uiHitAreas.pause);
    const remaining=(await read()).comboRemainingMs;
    await page.evaluate(()=>window.advanceTime(2000));
    assert.equal((await read()).comboRemainingMs,remaining);
    await page.keyboard.press('Escape');
    await page.evaluate(()=>window.advanceTime(8001));
    assert.equal((await read()).combo,0);
    assert.ok(!(await trace()).some(d=>d.file==='art_combo_label.png'));
    assert.deepEqual(errors,[]);
    console.log(entry+' new UI, tool hit areas/press/cancel, pause and dynamic Combo 12 PASS');
    await page.close();
  }
} finally { await browser.close(); }
