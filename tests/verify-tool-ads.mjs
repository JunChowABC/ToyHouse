import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../scripts/playwright_system_chrome.mjs';

const out = 'test-output/tool-ads';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const checks = [], errors = [];
try {
  for (const [entry, width, height] of [['/',540,960], ['/docs/',390,844], ['/docs/',1024,768]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('response', r => { if (r.status() >= 400) errors.push(r.url()); });
    await page.goto(`http://127.0.0.1:4173${entry}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Boolean(window.__toyhouse_background_ready));
    await page.evaluate(() => window.__toyhouse_background_ready);
    await page.keyboard.press('Enter');
    await page.evaluate(() => window.advanceTime(1500));
    const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const click = async r => {
      await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).uiMotion.busy);
      const b = await page.locator('#game').boundingBox();
      await page.mouse.click(b.x+(r.x+r.w/2)*b.width/540,b.y+(r.y+r.h/2)*b.height/960);
    };
    const open = async id => click((await read()).uiHitAreas.tools.find(t => t.id === id));
    const ad = async () => click((await read()).uiHitAreas.toolModal.ad);
    const close = async () => click((await read()).uiHitAreas.toolModal.close);
    await open('remove');
    await ad();
    assert.match((await read()).toolDialog.adMessage, /暂无/);
    assert.equal((await read()).economy.inventory.remove, 0);
    await close();
    for (const id of ['remove','shuffle','flip']) {
      await open(id);
      await page.evaluate(() => { window.__adCalls=0; window.toyhouseAds={showRewarded: () => { window.__adCalls++; return new Promise(resolve => { window.__finishAd=resolve; }); }}; });
      const beforeState = await read();
      const before = beforeState.economy;
      await ad(); await ad(); await close(); await page.keyboard.press('Escape'); await page.keyboard.press('Enter');
      assert.equal((await read()).toolDialog.adPending, true);
      assert.equal(await page.evaluate(() => window.__adCalls), 1);
      assert.deepEqual((await read()).economy, before);
      await page.evaluate(() => Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}));
      await page.evaluate(receiptId => window.__finishAd({status:'completed',receiptId}), `test-${id}`);
      await page.evaluate(() => window.advanceTime(300));
      assert.equal((await read()).toolUses[id],0);
      assert.equal((await read()).toolDialog.adPending,true);
      await page.evaluate(() => { delete document.hidden; });
      await page.waitForFunction(() => !JSON.parse(window.render_game_to_text()).toolDialog);
      let state=await read();
      assert.equal(state.economy.inventory[id], before.inventory[id]+(id==='shuffle'?0:1));
      assert.equal(state.economy.coins, before.coins);
      assert.equal(state.toolUses[id], id==='shuffle'?1:0);
      if(id==='shuffle') assert.equal(state.toys.filter(t=>beforeState.toys.find(b=>b.id===t.id)?.direction!==t.direction).length,5);
      else {
        assert.equal(state.toolMode,id); await page.keyboard.press('Escape');
        assert.equal((await read()).toolMode,id);
        const targets=state.toys.filter(t=>id==='remove'||t.archetype!=='AUTO_EXIT').slice(0,id==='remove'?2:1);
        for(const toy of targets) { const c=toy.cells[0],b=state.board;await click({x:b.x+c.x*b.cell,y:b.y+c.y*b.cell,w:b.cell,h:b.cell}); }
        state=await read();assert.equal(state.toolMode,null);
      }
      await page.screenshot({path:`${out}/${width}-${id}-reward.png`});
      await open(id);
      await ad();
      await page.evaluate(receiptId => window.__finishAd({status:'completed',receiptId}), `test-${id}`);
      assert.deepEqual((await read()).economy,state.economy,'duplicate receipt must not reward twice');
      for (const result of [{status:'cancelled'}, {status:'unavailable'}, {status:'completed'}]) {
        await ad(); await page.evaluate(r => window.__finishAd(r),result);
        assert.deepEqual((await read()).economy,state.economy);
      }
      await page.evaluate(() => { window.toyhouseAds={showRewarded:()=>Promise.reject(new Error('provider failed'))}; });
      await ad(); assert.match((await read()).toolDialog.adMessage,/未能完成/);
      assert.deepEqual((await read()).economy,state.economy);
      await page.evaluate(() => {
        const original = window.setTimeout;
        window.__adAborted = false;
        window.setTimeout = (fn, ms, ...args) => {
          if (ms === 180000) { window.setTimeout = original; return original(fn, 10, ...args); }
          return original(fn, ms, ...args);
        };
        window.toyhouseAds = {showRewarded: ({signal}) => {
          signal.addEventListener('abort', () => { window.__adAborted = true; });
          return new Promise(resolve => { window.__lateAd = resolve; });
        }};
      });
      await ad();
      await page.waitForFunction(() => window.__adAborted === true);
      await page.evaluate(() => window.__lateAd({status:'completed',receiptId:'too-late'}));
      assert.equal((await read()).toolDialog.adPending,false);
      assert.deepEqual((await read()).economy,state.economy,'late callback after timeout must not reward');
      await close(); checks.push({width,id,status:'PASS'});
    }
    await page.evaluate(() => window.__toyhouse_debug.grantReward({id:'budget',source:'task',coins:100}));
    await page.reload({waitUntil:'networkidle'});
    await page.waitForFunction(() => Boolean(window.__toyhouse_background_ready));
    await page.evaluate(() => window.__toyhouse_background_ready);
    assert.deepEqual((await read()).economy.inventory,{remove:0,shuffle:0,flip:0});
    await page.keyboard.press('Enter'); await page.evaluate(() => window.advanceTime(1500));
    await open('remove');
    await page.waitForFunction(()=>!JSON.parse(window.render_game_to_text()).uiMotion.busy);
    await page.screenshot({path:`${out}/${width}-final.png`});
    await page.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile(`${out}/report.json`,JSON.stringify({checks,errors},null,2));
  console.log('Ad flow: 9 tool/viewport combinations, success, duplicate, cancel, failure, missing receipt, input lock, persistence PASS');
} finally { await browser.close(); }

