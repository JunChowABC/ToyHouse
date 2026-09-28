import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from '../scripts/playwright_system_chrome.mjs';
import HOME from '../src/home-runtime-manifest.js';
const report=JSON.parse(await readFile('assets/runtime-ui/report.json','utf8'));
const loadingReport=JSON.parse(await readFile('assets/loading-v1/report.json','utf8'));
const adImages=['ui_rewarded_ad_v3.png','ui_tool_ad_pink_v3.png','ui_tool_buy_yellow_v3.png'];
const expectedImages=report.runtimeImages+loadingReport.runtimeImages.length+adImages.length;
const browser=await chromium.launch({headless:true});
try{for(const entry of ['/', '/docs/']){
 const page=await browser.newPage({viewport:{width:390,height:844}});const images=[],errors=[];
 page.on('request',r=>{if(/\.(png|webp)(\?|$)/.test(r.url()))images.push(new URL(r.url()).pathname);});
 page.on('pageerror',e=>errors.push(String(e)));
 page.on('response',r=>{if(r.status()>=400)errors.push(r.url());});
 await page.goto('http://127.0.0.1:4173'+entry,{waitUntil:'networkidle'});
 await page.waitForFunction(()=>Boolean(window.__toyhouse_background_ready));
 await page.evaluate(()=>window.__toyhouse_background_ready);
 assert.equal(images.length,expectedImages);
 assert.equal(new Set(images).size,expectedImages);
 assert.ok(images.every(p=>((p.includes('/runtime-ui/')||p.includes('/loading-v1/'))&&p.endsWith('.webp'))||adImages.some(n=>p.endsWith('/tool-dialog-v1/'+n))));
 assert.equal(images.filter(p=>p.includes('/tool-dialog-v1/')).length,adImages.length);
 assert.equal(images.filter(p=>p.includes('/loading-v1/')).length,2);
 const homeImageCount=report.staticHomeLayers.length+report.atlasPages.filter(p=>/\/(home-|currency-)/.test(p)).length;
 assert.equal(images.filter(p=>/\/(home-|currency-)/.test(p)).length,homeImageCount);
 assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).homeArt.loaded),HOME.layers.length);
 await page.keyboard.press('Enter');
 assert.equal(await page.evaluate(()=>JSON.parse(window.render_game_to_text()).mode),'play');
 assert.deepEqual(errors,[]);await page.close();console.log(entry+` ${expectedImages} runtime images, ${homeImageCount} homepage images, only 3 declared ad PNGs PASS`);
}}finally{await browser.close();}
