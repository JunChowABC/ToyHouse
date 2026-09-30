import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../scripts/playwright_system_chrome.mjs';
import CONFIG from '../src/level-config.js';

const out = 'test-output/tall-screens';
await mkdir(out, {recursive:true});
const browser = await chromium.launch({headless:true});
const errors = [], reports = [];
try {
  for (const [entry,width,height,safeTop,safeBottom] of [
    ['/',540,960,0,0], ['/',390,844,0,0], ['/',393,852,59,34],
    ['/',360,800,0,24], ['/',360,960,32,24], ['/',1024,768,0,0],
    ['/docs/',393,852,59,34], ['/docs/',360,960,0,24],
  ]) {
    const name = `${entry === '/' ? 'source' : 'release'}-${width}x${height}-${safeTop}`;
    const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:2});
    page.on('pageerror', e => errors.push(`${name}: ${e}`));
    page.on('response', r => { if(r.status()>=400) errors.push(`${name}: ${r.status()} ${r.url()}`); });
    await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
    if (entry === '/') await page.route('**/src/level-config.js', route => {
      // The finale UI test uses a tiny last-board fixture; production levels allow tool-assisted deadlocks.
      const fixture = structuredClone(CONFIG), last = fixture.levels.at(-1);
      last.toy_list = [{ toy_id: 'finale-ui-rabbit', archetype_id: 'ORDINARY', skin_id: 'rabbit', footprint: [2, 1], grid_position: [0, 5], direction: 'L' }];
      last.board_entities = [];
      return route.fulfill({ contentType: 'text/javascript', body: `export default ${JSON.stringify(fixture)};` });
    });
    await page.route('**/tall-home-v1.webp', async route => {
      await new Promise(resolve=>setTimeout(resolve,700)); await route.continue();
    });
    await page.goto(`${process.env.TOYHOUSE_TEST_URL || 'http://127.0.0.1:4173'}${entry}`,{waitUntil:'domcontentloaded'});
    await page.evaluate(([t,b])=>{
      document.documentElement.style.setProperty('--safe-top',`${t}px`);
      document.documentElement.style.setProperty('--safe-bottom',`${b}px`);
    },[safeTop,safeBottom]);
    await page.waitForFunction(()=>typeof window.advanceTime==='function');
    const step = ms => page.evaluate(ms=>window.advanceTime(ms),ms);
    const state = () => page.evaluate(()=>JSON.parse(window.render_game_to_text()));
    const shot = label => page.screenshot({path:`${out}/${name}-${label}.png`});
    await step(20); await shot('loading');
    await page.evaluate(()=>window.__toyhouse_art_ready);
    await page.waitForFunction(()=>Boolean(window.__toyhouse_background_ready));
    await page.evaluate(()=>window.__toyhouse_background_ready);
    await step(500);
    const click = async id => {
      await step(350);
      const v=(await state()).art.viewport;
      const r=v.controls.find(c=>c.id===id); assert.ok(r,`${name}: control ${id}`);
      const bounds=await page.locator('#game').boundingBox();
      const x=bounds.x+(r.x+r.w/2)*bounds.width/540;
      const y=bounds.y+(r.y+r.h/2+v.y)*bounds.height/v.height;
      assert.ok(y>=safeTop && y<=height-safeBottom,`${id} outside safe area: ${y}`);
      await page.mouse.click(x,y);
      await page.waitForTimeout(220); await step(400);
    };
    const bounds=await page.locator('#game').boundingBox();
    assert.ok(Math.abs(bounds.height-height)<1 && Math.abs(bounds.y)<1,'viewport must fill screen height');
    if(width/height<=9/16) assert.ok(Math.abs(bounds.width-width)<1,'portrait must fill screen width');
    await shot('home');
    // Press, drag away and release must cancel without moving/scaling the room.
    const v=(await state()).art.viewport, start=v.controls.find(c=>c.id==='home.start');
    await page.mouse.move(bounds.x+(start.x+start.w/2)*bounds.width/540,(start.y+start.h/2+v.y)*bounds.height/v.height);
    await page.mouse.down(); await page.mouse.move(bounds.x+2,2); await page.mouse.up(); await step(200);
    assert.equal((await state()).mode,'home');
    await click('home.settings'); assert.equal((await state()).settingsOpen,true); await shot('settings');
    await click('settings.music');
    await click('settings.close'); assert.equal((await state()).settingsOpen,false);
    await click('home.start');
    await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='play');
    await step(500); await shot('play');
    await click('play.pause'); assert.equal((await state()).paused,true); await shot('pause');
    await click('pause.resume'); assert.equal((await state()).paused,false);
    for(const id of ['remove','shuffle','flip']) {
      await click(`play.${id}`); assert.equal((await state()).toolDialog.id,id); await shot(id);
      await click('tool.close'); assert.equal((await state()).toolDialog,null);
    }
    if(entry==='/') {
      await page.evaluate(()=>window.__toyhouse_debug.grantReward({id:'tall-tools',source:'task',tools:{flip:1}}));
      await click('play.flip'); await click('tool.action'); await shot('target-selection');
      assert.equal((await state()).toolMode,'flip');
      // Select a real visible toy using board coordinates, verifying the inverse transform.
      const selected=await page.evaluate(()=>JSON.parse(window.render_game_to_text()).toys.find(t=>t.archetype==='ORDINARY'));
      const s=await state(),vp=s.art.viewport;
      const cell=selected.cells[0];
      await page.mouse.click(bounds.x+(60+(cell.x+.5)*35)*bounds.width/540,(199+(cell.y+.5)*35+vp.y)*bounds.height/vp.height);
      await step(500); assert.equal((await state()).toolMode,null);
      await page.evaluate(()=>{window.__toyhouse_debug.startLevel(0);window.__toyhouse_debug.clearCurrentLevel();}); await step(4000); await step(400);
      assert.equal((await state()).mode,'level-complete'); await shot('complete');
      await click('complete.next'); await step(160); await shot('transition'); await step(800);
      assert.equal((await state()).levelNo,2);
      await page.evaluate(()=>{window.__toyhouse_debug.startLevel(window.__toyhouse_debug.levels.length-1);window.__toyhouse_debug.clearCurrentLevel();});
      await step(4000);await step(400);await page.keyboard.press('Enter');await step(1100);
      assert.equal((await state()).mode,'night-complete');await shot('finale');
    } else assert.equal(await page.evaluate(()=>typeof window.__toyhouse_debug),'undefined');
    // Resize in-place, including a landscape round-trip, must not restart the game.
    for(const size of [{width:844,height:390},{width,height}]) {
      await page.setViewportSize(size);await step(50);
      const r=await page.locator('#game').boundingBox(); assert.ok(Math.abs(r.height-size.height)<1);
    }
    reports.push({entry,width,height,safeTop,safeBottom,status:'PASS'});
    await page.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile(`${out}/report.json`,JSON.stringify({reports,errors},null,2));
  console.log(`PASS ${reports.length} tall/standard/landscape, safe-area and source/release flows`);
} finally {await browser.close();}
