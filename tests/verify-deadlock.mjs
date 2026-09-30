import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '../scripts/playwright_system_chrome.mjs';
const browser=await chromium.launch({headless:true});const errors=[];
await mkdir('test-output/deadlock',{recursive:true});
try {
 for(const [entry,width,height] of [['/',540,960],['/docs/',390,844]]) {
  const p=await browser.newPage({viewport:{width,height}});p.on('pageerror',e=>errors.push(String(e)));
  await p.goto('http://127.0.0.1:4173'+entry,{waitUntil:'networkidle'});
  await p.waitForFunction(()=>Boolean(window.__toyhouse_background_ready));await p.evaluate(()=>window.__toyhouse_background_ready);
  await p.keyboard.press('Enter');await p.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='play');
  const read=()=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
  const config={board_width:12,board_height:18,toy_list:[
   {toy_id:'a',archetype_id:'ORDINARY',grid_position:[4,5],footprint:[2,1],direction:'R'},
   {toy_id:'b',archetype_id:'ORDINARY',grid_position:[6,5],footprint:[2,1],direction:'L'}],board_entities:[]};
  const load=async c=>{await p.evaluate(c=>window.__toyhouse_debug.loadMechanicConfig(c),c);await p.evaluate(()=>window.advanceTime(1400));};
  await load(config);assert.equal((await read()).deadlockHint.tool,'shuffle');
  await p.screenshot({path:`test-output/deadlock/${width}-blocked.png`});
  await p.keyboard.press('2');await p.evaluate(()=>window.advanceTime(400));assert.equal((await read()).deadlockHint,null);
  await p.keyboard.press('Escape');await p.evaluate(()=>window.advanceTime(400));assert.equal((await read()).deadlockHint.tool,'shuffle');
  const freed=structuredClone(config);freed.toy_list[0].direction='L';await load(freed);assert.equal((await read()).deadlockHint,null);
  const partial=structuredClone(config);partial.toy_list[1].grid_position=[7,5];await load(partial);assert.equal((await read()).deadlockHint,null,'one step is enough to avoid deadlock');
  const box=structuredClone(config);box.toy_list.pop();box.board_entities=[{entity_id:'box',kind:'BOX',grid_position:[6,5],footprint:[1,1],hp:2}];await load(box);assert.equal((await read()).deadlockHint,null,'breakable box is an effective action');
  await load(config);
  await p.evaluate(()=>window.__toyhouse_debug.grantReward({id:'rescue',source:'task',tools:{flip:1}}));
  await p.keyboard.press('3');await p.evaluate(()=>window.advanceTime(400));await p.keyboard.press('Enter');await p.evaluate(()=>window.advanceTime(400));
  assert.equal((await read()).deadlockHint,null);assert.equal((await read()).toolMode,'flip');
  const b=await p.locator('#game').boundingBox(),s=await read();await p.mouse.click(b.x+(s.board.x+4.5*s.board.cell)*b.width/540,b.y+(s.board.y+5.5*s.board.cell)*b.height/960);
  await p.evaluate(()=>window.advanceTime(1400));assert.equal((await read()).deadlockHint,null);assert.equal((await read()).toolMode,null);
  await p.close();
 }
 assert.deepEqual(errors,[]);console.log('PASS: deadlock, partial move, breakable mechanic, modal/selection suppression, rescue and source/docs');
}finally{await browser.close();}
