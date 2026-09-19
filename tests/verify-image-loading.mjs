import assert from 'node:assert/strict';
import {chromium} from '../scripts/playwright_system_chrome.mjs';
const browser=await chromium.launch({headless:true});
try {
 for(const entry of ['/', '/docs/']) {
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 let requests=0;
 await page.route('**/ui_settings_base.png*',async route=>{requests++;if(requests>1) await route.continue();});
 await page.goto('http://127.0.0.1:4173'+entry,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(async()=>await window.__toyhouse_art_ready===true,null,{timeout:90000});
 await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).homeArt.loaded===89,null,{timeout:90000});
 assert.equal(requests,2,'stalled image automatically retried');
 assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).mode),'home');
 assert.deepEqual(errors,[]);
 await page.close();
 const failed=await browser.newPage({viewport:{width:540,height:960}});
 let failures=0;
 await failed.route('**/home-v2/*.png*',async route=>{failures++;await route.abort();});
 await failed.goto('http://127.0.0.1:4173'+entry,{waitUntil:'networkidle'});
 assert.equal(await failed.evaluate(()=>window.__toyhouse_art_ready),false);
 assert.equal(failures,89*3);
 await failed.unroute('**/home-v2/*.png*');
 await failed.mouse.click(270,546);
 await failed.waitForFunction(async()=>await window.__toyhouse_art_ready===true,null,{timeout:90000});
 assert.equal(await failed.evaluate(()=>JSON.parse(window.render_game_to_text()).mode),'home');
 await failed.close();
 console.log(entry+' stalled request retry and manual recovery PASS');
 }
}finally{await browser.close();}
