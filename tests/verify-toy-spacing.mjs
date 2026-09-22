import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {chromium} from '../scripts/playwright_system_chrome.mjs';


await mkdir('test-output/toy-spacing',{recursive:true});
const browser=await chromium.launch({headless:true});
try { for(const entry of ['http://127.0.0.1:4173/','http://127.0.0.1:4173/docs/']) {
 const page=await browser.newPage({viewport:{width:540,height:960}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.addInitScript(()=>{
  const proto=CanvasRenderingContext2D.prototype,draw=proto.drawImage;
  window.toyDrawBounds=[];
  proto.drawImage=function(image,...a){
   if(a.length===4&&/\/toy_(rabbit|whale|duck)_/.test(image.src||'')){
    const [x,y,w,h]=a,m=this.getTransform();
    const pts=[[x,y],[x+w,y],[x,y+h],[x+w,y+h]].map(([px,py])=>({x:m.a*px+m.c*py+m.e,y:m.b*px+m.d*py+m.f}));
    window.toyDrawBounds.push({l:Math.min(...pts.map(p=>p.x)),r:Math.max(...pts.map(p=>p.x)),t:Math.min(...pts.map(p=>p.y)),b:Math.max(...pts.map(p=>p.y))});
   }return draw.call(this,image,...a);
  };
 });
 await page.goto(entry,{waitUntil:'networkidle'});await page.evaluate(()=>window.__toyhouse_background_ready);await page.keyboard.press('Enter');await page.waitForFunction(()=>JSON.parse(window.render_game_to_text()).mode==='play');
 for(let level=0;level<20;level++){
  const bounds=await page.evaluate(level=>{window.__toyhouse_debug.startLevel(level);window.toyDrawBounds=[];window.advanceTime(0);return window.toyDrawBounds},level);
  assert.equal(bounds.length,72,`level ${level+1} draws`);
  for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){
   const a=bounds[i],b=bounds[j];assert.ok(Math.min(a.r,b.r)-Math.max(a.l,b.l)<=0.01||Math.min(a.b,b.b)-Math.max(a.t,b.t)<=0.01,`level ${level+1} overlap ${i},${j}`);
  }
  if(level===0||level===19)await page.screenshot({path:`test-output/toy-spacing/${entry.endsWith('docs/')?'built':'source'}-${level+1}.png`});
 }
 assert.deepEqual(errors,[]);console.log(entry+' all 20 levels: 72 sprites each, zero overlapping sprite bounds');await page.close();
}}finally{await browser.close()}
