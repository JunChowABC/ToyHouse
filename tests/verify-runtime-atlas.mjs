import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from '../scripts/playwright_system_chrome.mjs';
const report=JSON.parse(await readFile('assets/runtime-ui/report.json','utf8'));
const browser=await chromium.launch({headless:true});
try{for(const entry of ['/', '/docs/']){
 const page=await browser.newPage({viewport:{width:390,height:844}});const images=[],errors=[];
 page.on('request',r=>{if(/\.(png|webp)(\?|$)/.test(r.url()))images.push(new URL(r.url()).pathname);});
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
 await page.goto('http://127.0.0.1:4173'+entry,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>Boolean(window.__toyhouse_background_ready));
 await page.evaluate(()=>window.__toyhouse_background_ready);
 assert.equal(images.length,report.runtimeImages);
 assert.equal(new Set(images).size,report.runtimeImages);
 assert.ok(images.every(p=>p.includes('/runtime-ui/')&&p.endsWith('.webp')));
 assert.equal(images.filter(p=>/\/(home-|currency-)/.test(p)).length,5);
 assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).homeArt.loaded),16);
 await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).mode),'play');
 assert.deepEqual(errors,[]);await page.close();console.log(entry+` ${report.runtimeImages} runtime images, 5 homepage images, no source PNG requests PASS`);
}}finally{await browser.close();}
