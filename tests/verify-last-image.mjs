import HOME_ART from "../src/home-runtime-manifest.js";
import assert from 'node:assert/strict';
import {chromium} from '../scripts/playwright_system_chrome.mjs';
import {mkdir} from 'node:fs/promises';
await mkdir('test-output/last-image',{recursive:true});
const browser=await chromium.launch({headless:true});
try{for(const entry of ['/', '/docs/']){
 const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];
 page.on('pageerror',e=>errors.push(String(e)));
 const held=[];let block=true;
 await page.route('**/runtime-ui/home-static_0-*.webp*',r=>{if(block)held.push(r);else return r.continue();});
 const start=Date.now();
 await page.goto('http://127.0.0.1:4173'+entry,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(async()=>await window.__toyhouse_art_ready===true,null,{timeout:20000});
 const read=()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
 assert.equal((await read()).homeArt.loaded,HOME_ART.layers.length-1);
 assert.equal((await read()).art.ready,true);
 assert.ok((await read()).art.loading.pending.some(p=>p.includes('/home-static_0-')));
 assert.ok(Date.now()-start<15000,'opens before image timeout retries finish');
 await page.screenshot({path:'test-output/last-image/'+(entry==='/'?'source':'built')+'-partial.png'});
 block=false;await Promise.all(held.map(r=>r.continue()));
 await page.waitForFunction(expected=>JSON.parse(window.render_game_to_text()).homeArt.loaded===expected,HOME_ART.layers.length);
 await page.keyboard.press('Enter');
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='play');
 assert.deepEqual(errors,[]);console.log(entry+' one permanently stalled image does not block home; later fills and play works PASS');
 await page.close();
}}finally{await browser.close();}
