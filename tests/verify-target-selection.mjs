import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from '../scripts/playwright_system_chrome.mjs';
const browser = await chromium.launch({headless:true});
const errors=[];
await mkdir('test-output/target-selection',{recursive:true});
try {
  for(const [width,height] of [[540,960],[390,844],[1024,768]]) {
    const page=await browser.newPage({viewport:{width,height}});
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto('http://127.0.0.1:4173/',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>Boolean(window.__toyhouse_background_ready));
    await page.evaluate(()=>window.__toyhouse_background_ready);
    await page.keyboard.press('Enter');
    await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='play');
    await page.evaluate(()=>window.advanceTime(1500));
    const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
    const click=async(x,y)=>{const b=await page.locator('#game').boundingBox();await page.mouse.click(b.x+x*b.width/540,b.y+y*b.height/960);};
    const target=async t=>{const s=await read();await click(s.board.x+(t.cells[0].x+.5)*s.board.cell,s.board.y+(t.cells[0].y+.5)*s.board.cell);};
    for(const id of ['flip','remove']) {
      await page.evaluate(id=>{window.__toyhouse_debug.grantReward({id:'select-'+id,source:'task',tools:{[id]:1}});window.__toyhouse_debug.openToolModal(id);},id);
      await page.evaluate(()=>window.advanceTime(400));await page.keyboard.press('Enter');await page.evaluate(()=>window.advanceTime(400));
      let s=await read();assert.equal(s.toolMode,id);assert.equal(s.targetSelection.locked,true);
      const before=s.economy;
      for(const key of ['Escape','p','1','2','3']) await page.keyboard.press(key);
      await click(40,45);await click(100,905);await click(270,905);await click(440,905);await click(20,700);
      await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
      s=await read();assert.equal(s.toolMode,id);assert.deepEqual(s.economy,before);assert.equal(s.toolDialog,null);
      await page.screenshot({path:`test-output/target-selection/${width}-${id}.png`});
      const toys=s.toys.filter(t=>t.archetype!=='AUTO_EXIT');
      await target(toys[0]);s=await read();
      if(id==='remove') {
        assert.equal(s.toolMode,'remove');assert.match(s.targetSelection.prompt,/第2个/);
        await page.keyboard.press('Escape');assert.equal((await read()).toolMode,'remove');
        await page.screenshot({path:`test-output/target-selection/${width}-remove-second.png`});
        await target(toys[1]);
      }
      s=await read();assert.equal(s.toolMode,null);assert.equal(s.targetSelection,null);assert.equal(s.toolUses[id],1);
      assert.equal(s.economy.inventory[id],0);await page.evaluate(()=>window.advanceTime(600));
    }
    await page.close();
  }
  assert.deepEqual(errors,[]);console.log('PASS target selection: 3 viewports, both tools, locked input, staged selection, single consumption');
} finally {await browser.close();}
