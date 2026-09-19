import assert from 'node:assert/strict';
import {chromium} from '../scripts/playwright_system_chrome.mjs';
import ALIASES from '../src/image-aliases.js';
const browser=await chromium.launch({headless:true});
try{for(const entry of ['/', '/docs/']){
 const page=await browser.newPage({viewport:{width:540,height:960}});
 const requests=[];const errors=[];
 page.on('request',r=>requests.push(new URL(r.url()).pathname));page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{
  const proto=CanvasRenderingContext2D.prototype,draw=proto.drawImage,clear=proto.clearRect;
  const ids=new WeakMap();let next=0;window.__sharedDraw=[];
  proto.clearRect=function(...args){window.__sharedDraw=[];return clear.apply(this,args);};
  proto.drawImage=function(im,...bounds){if(!ids.has(im))ids.set(im,++next);window.__sharedDraw.push({id:ids.get(im),file:im.src?.split('/').pop(),bounds});return draw.call(this,im,...bounds);};
 });
 await page.goto('http://127.0.0.1:4173'+entry,{waitUntil:'networkidle'});
 await page.evaluate(()=>window.__toyhouse_background_ready);
 for(const [alias,source] of Object.entries(ALIASES)){
  assert.equal(requests.filter(p=>p===entry+alias).length,0,alias);
  assert.equal(requests.filter(p=>p===entry+source).length,1,source);
 }
 await page.keyboard.press('Enter');
 const draw=await page.evaluate(()=>{window.advanceTime(0);return window.__sharedDraw;});
 for(const prefix of ['ui_bottom_button_disc','ui_bottom_label_plate','ui_small_badge']){
  const images=draw.filter(i=>i.file.startsWith(prefix));assert.equal(images.length,3);
  assert.equal(new Set(images.map(i=>i.id)).size,1);
  assert.equal(new Set(images.map(i=>i.bounds[0])).size,3);
 }
 assert.deepEqual(errors,[]);console.log(entry+' 12 aliases avoid duplicate requests; 3 tool buttons reuse same images at distinct positions PASS');
 await page.close();
}}finally{await browser.close();}
