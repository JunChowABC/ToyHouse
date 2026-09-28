import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '../scripts/playwright_system_chrome.mjs';
await mkdir('test-output/loading-screen',{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
const read=p=>p.evaluate(()=>JSON.parse(window.render_game_to_text()));
async function click(p,rect){
 const c=await p.locator('#game').boundingBox();
 await p.mouse.click(c.x+(rect.x+rect.w/2)*c.width/540,c.y+(rect.y+rect.h/2)*c.height/960);
}
try{
 // Cold start: no external artwork has arrived, but the new UI must already render.
 for(const entry of ['/', '/docs/']){
  const cold=await browser.newPage({viewport:{width:390,height:844}}),held=[];
  let hold=true;
  await cold.route('**/assets/**/*.webp*',async r=>{if(hold)held.push(r);else await r.continue();});
  await cold.goto('http://127.0.0.1:4173'+entry,{waitUntil:'domcontentloaded'});
  await cold.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art.loadingScreen.loaded===2);
  const state=await read(cold);
  assert.equal(state.art.loadingScreen.fullResolutionLoaded,0);
  assert.equal(state.art.loadingScreen.visible,true);
  assert.equal(state.art.loading.loaded,0);
  await cold.screenshot({path:`test-output/loading-screen/cold-inline-${entry==='/'?'source':'built'}.png`});
  hold=false;await Promise.all(held.map(r=>r.continue()));
  await cold.waitForFunction(()=>JSON.parse(window.render_game_to_text()).art.ready);
  await cold.waitForFunction(()=>JSON.parse(window.render_game_to_text()).art.loadingScreen.fullResolutionLoaded===2);
  await cold.unrouteAll({behavior:'ignoreErrors'});await cold.close();
 }
 for(const [entry,width,height] of [['/',540,960],['/docs/',390,844],['/docs/',844,390]]){
  const page=await browser.newPage({viewport:{width,height}}),errors=[],home=[],secondary=[];
  let holdHome=true,holdSecondary=true;
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/assets/runtime-ui/*.webp*',async route=>{
   const primary=/\/(home-|currency-)/.test(route.request().url());
   if(primary&&holdHome){home.push(route);return;}
   if(!primary&&holdSecondary){secondary.push(route);return;}
   await route.continue();
  });
  await page.goto('http://127.0.0.1:4173'+entry,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art.loadingScreen.loaded===2);
  let state=await read(page);assert.equal(state.art.loadingScreen.visible,true);assert.equal(state.art.loadingScreen.progress,0);
  await page.screenshot({path:`test-output/loading-screen/${width}-boot-zero.png`});
  assert.ok(home.length);
  const first=home.shift();await first.continue();
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).art.loadingScreen.progress>0);
  state=await read(page);assert.ok(state.art.loadingScreen.progress<1);
  await page.screenshot({path:`test-output/loading-screen/${width}-boot-progress.png`});
  holdHome=false;await Promise.all(home.splice(0).map(r=>r.continue()));
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).art.ready);
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).art.loading.pending.some(p=>/\/play-/.test(p)));
  assert.equal((await read(page)).mode,'home');
  await page.keyboard.press('Enter');
  state=await read(page);assert.ok(state.art.waiting);assert.equal(state.art.loadingScreen.visible,true);
  await page.screenshot({path:`test-output/loading-screen/${width}-pending.png`});
  await click(page,state.art.loadingScreen.cancel);assert.equal((await read(page)).art.waiting,null);
  await page.keyboard.press('Enter');holdSecondary=false;await Promise.all(secondary.splice(0).map(r=>r.continue()));
  await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='play');
  state=await read(page);assert.equal(state.art.loadingScreen.visible,false);assert.equal(state.art.systems.play,true);
  await page.screenshot({path:`test-output/loading-screen/${width}-play.png`});
  assert.deepEqual(errors,[]);results.push({entry,width,height,bootProgress:true,cancelAndReenter:true,play:true,errors});await page.close();
 }
 // Missing loading artwork must not hold a fully loaded home screen hostage.
 const fallback=await browser.newPage();
 await fallback.route('**/assets/loading-v1/*.webp*',r=>r.abort());
 await fallback.goto('http://127.0.0.1:4173/docs/',{waitUntil:'domcontentloaded'});
 await fallback.waitForFunction(()=>window.render_game_to_text&&JSON.parse(window.render_game_to_text()).art.ready);
 assert.equal((await read(fallback)).mode,'home');await fallback.close();
 // Failed secondary resources keep their explicit retry action, with no gameplay entry.
 const failed=await browser.newPage({viewport:{width:540,height:960}});
 await failed.route('**/assets/runtime-ui/play-*.webp*',r=>r.abort());
 await failed.goto('http://127.0.0.1:4173/docs/',{waitUntil:'networkidle'});
 await failed.waitForFunction(()=>JSON.parse(window.render_game_to_text()).art.ready);
 await failed.keyboard.press('Enter');
 await failed.waitForFunction(()=>JSON.parse(window.render_game_to_text()).art.waiting?.error===true);
 assert.equal((await read(failed)).mode,'home');
 await failed.screenshot({path:'test-output/loading-screen/failed-secondary.png'});
 await failed.unroute('**/assets/runtime-ui/play-*.webp*');
 await click(failed,(await read(failed)).art.loadingScreen.retry);
 await failed.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='play');
 await failed.close();
 await writeFile('test-output/loading-screen/report.json',JSON.stringify({valid:true,coldStartWithoutExternalImages:true,scenarios:results,decorativeFailureFallback:true,secondaryFailureRetry:true},null,2));
 console.log('Loading art: 3 viewports; real progress; cancel/reentry; secondary retry; missing-art fallback PASS');
}finally{await browser.close();}
