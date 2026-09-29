import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '../scripts/playwright_system_chrome.mjs';
const browser=await chromium.launch({headless:true});const errors=[];
await mkdir('test-output/guidance-release',{recursive:true});
try {
 const page=await browser.newPage({viewport:{width:540,height:960}});
 page.on('pageerror',e=>errors.push(String(e)));
 // Inject fixtures in the test response only; no fixture hook is shipped.
 await page.route('**/src/game.js',async route=>{
  const response=await route.fetch();
  const fixture=`\nwindow.__guidanceFixture=(gap=0)=>{ startLevel(0);const base=state.toys.find(t=>t.archetypeId==='ORDINARY');state.toys=[{...base,id:'fixture-a',direction:'RIGHT',x:4,y:5,cells:[{x:4,y:5},{x:5,y:5}]},{...base,id:'fixture-b',direction:'LEFT',x:6+gap,y:5,cells:[{x:6+gap,y:5},{x:7+gap,y:5}]}];state.initialToys=state.toys.map(cloneToy);state.moving=[];state.exiting=[];state.levelCompleteAt=0;};window.__guidanceCaps=()=>{state.toolUses={shuffle:3,remove:3,flip:3};};`;
  await route.fulfill({response,body:(await response.text())+fixture});
 });
 await page.goto((process.env.TOYHOUSE_TEST_URL || "http://127.0.0.1:4173") + "/",{waitUntil:'networkidle'});
 await page.waitForFunction(()=>Boolean(window.__toyhouse_background_ready));await page.evaluate(()=>window.__toyhouse_background_ready);
 const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
 await page.evaluate(()=>{window.__guidanceFixture();window.advanceTime(1500);});
 assert.equal((await read()).deadlockHint.tool,'shuffle');
 await page.screenshot({path:'test-output/guidance-release/deadlock.png'});
 await page.keyboard.press('2');await page.evaluate(()=>window.advanceTime(400));assert.equal((await read()).deadlockHint,null);
 await page.keyboard.press('Escape');await page.evaluate(()=>window.advanceTime(400));assert.equal((await read()).deadlockHint.tool,'shuffle');
 await page.evaluate(()=>window.__guidanceCaps());assert.equal((await read()).deadlockHint.tool,null);
 await page.evaluate(()=>{window.__guidanceFixture(1);window.advanceTime(1500);});assert.equal((await read()).deadlockHint,null);
 await page.evaluate(()=>{window.__guidanceFixture();window.__toyhouse_debug.grantReward({id:'rescue',source:'task',tools:{flip:1}});window.advanceTime(1500);});
 await page.keyboard.press('3');await page.evaluate(()=>window.advanceTime(400));await page.keyboard.press('Enter');await page.evaluate(()=>window.advanceTime(400));
 assert.equal((await read()).toolMode,'flip');assert.equal((await read()).deadlockHint,null);
 const s=await read(),b=await page.locator('#game').boundingBox();await page.mouse.click(b.x+(s.board.x+4.5*s.board.cell)*b.width/540,b.y+(s.board.y+5.5*s.board.cell)*b.height/960);
 await page.evaluate(()=>window.advanceTime(1500));assert.equal((await read()).deadlockHint,null);assert.equal((await read()).toolMode,null);
 assert.deepEqual(errors,[]);console.log('PASS published-rule release: blocked, partial move, caps, popup/selection hiding and flip rescue');
} finally {await browser.close();}
