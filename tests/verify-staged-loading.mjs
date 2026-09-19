import HOME_ART from "../src/home-runtime-manifest.js";
import assert from 'node:assert/strict';
import { chromium } from '../scripts/playwright_system_chrome.mjs';
import { mkdir } from 'node:fs/promises';
await mkdir('test-output/staged-loading',{recursive:true});
const browser=await chromium.launch({headless:true});
try {
for (const entry of ['/', '/docs/']) {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 const held=[];let hold=true;let premature=false;
 await page.route('**/assets/runtime-ui/*.webp*',async route=>{
   const path=new URL(route.request().url()).pathname;
   const essential=/\/(home-|currency-)/.test(path);
   if(!essential){
     const ready=await page.evaluate(()=>JSON.parse(window.render_game_to_text()).art.ready);
     if(!ready) premature=true;
     if(hold){held.push(route);return;}
   }
   await route.continue();
 });
 await page.goto('http://127.0.0.1:4173'+entry,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(async()=>await window.__toyhouse_art_ready===true);
 const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
 let state=await read();
 assert.equal(state.homeArt.loaded,HOME_ART.layers.length);assert.equal(state.art.loaded,4);
 assert.equal(state.art.systems.play,false);assert.equal(state.art.systems.complete,false);
 assert.equal(premature,false);
 await page.screenshot({path:'test-output/staged-loading/'+(entry==='/'?'source':'built')+'-home-first.png'});
 await page.keyboard.press('Enter');
 state=await read();assert.equal(state.mode,'home');assert.deepEqual(state.art.waiting.systems,['play','settings']);
 await page.keyboard.press('Escape');assert.equal((await read()).art.waiting,null);
 await page.keyboard.press('Enter');
 hold=false;await Promise.all(held.map(route=>route.continue()));
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='play');
 assert.equal((await read()).art.systems.play,true);
 await page.evaluate(()=>window.__toyhouse_background_ready);
 assert.equal((await read()).art.systems.complete,true);
 await page.screenshot({path:'test-output/staged-loading/'+(entry==='/'?'source':'built')+'-play.png'});
 assert.deepEqual(errors,[]);
 console.log(entry+' home usable with all secondary assets blocked; queued start/cancel/background completion PASS');
 await page.close();
}
}finally{await browser.close();}
