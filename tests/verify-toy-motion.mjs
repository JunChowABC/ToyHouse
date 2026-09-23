import assert from 'node:assert/strict';
import { chromium } from '../scripts/playwright_system_chrome.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const browser=await chromium.launch({headless:true});
const samples=[];
await mkdir('test-output/toy-motion',{recursive:true});
try {
 for(const entry of ['/', '/docs/']) {
  const p=await browser.newPage({viewport:{width:540,height:960}}), errors=[];
  p.on('pageerror',e=>errors.push(String(e)));
  await p.addInitScript(()=>{window.requestAnimationFrame=()=>0;window.__poses=[];const proto=CanvasRenderingContext2D.prototype,draw=proto.drawImage;proto.drawImage=function(img,...args){if(this.canvas.id==='game'&&/\/toy_/.test(img.src||'')){const m=this.getTransform();window.__poses.push([m.a,m.b,m.c,m.d,m.e,m.f,this.globalAlpha]);}return draw.call(this,img,...args);};});
  await p.goto(`http://127.0.0.1:4173${entry}`,{waitUntil:'networkidle'});
  await p.evaluate(()=>window.__toyhouse_background_ready);
  const result=await p.evaluate(()=>{
   const d=window.__toyhouse_debug,s=()=>JSON.parse(window.render_game_to_text()),frame=ms=>{window.__poses=[];window.advanceTime(ms);return JSON.stringify(window.__poses);};
   d.startLevel(0);const before=JSON.stringify(s().toys),a=frame(0),b=frame(300);
   if(a===b)throw Error('idle rendering is static');
   if(before!==JSON.stringify(s().toys))throw Error('idle changed board');
   d.openPause();const paused=frame(0);if(paused!==frame(500))throw Error('pause animation moved');d.closePause();
   const samples=[];
   for(const archetypeId of ['ORDINARY','LARGE','AUTO_EXIT'])for(const time of [0,60,180,459,900,2500])for(const exit of [null,0,.25,.6,1]){
    const toy={id:'toy-12',archetypeId,blockedAt:0,impactDy:1};const pose=d.toyAnimationPose(toy,time,exit);
    if(Object.values(pose).some(v=>typeof v==='number'&&!Number.isFinite(v)))throw Error('non-finite pose');
    if(pose.sx<.7||pose.sx>1.1||pose.sy<.7||pose.sy>1.1||Math.abs(pose.rotation)>.1)throw Error('excessive pose');
    if(exit===1&&Math.abs(pose.alpha)>1e-9)throw Error('exit not faded');
    samples.push({toy,time,exit,pose});
   }
   let slide=false,blocked=false;
   for(let level=0;level<20&&(!slide||!blocked);level++){
    d.startLevel(level);
    const t=s().toys.find(t=>t.outcome==='STOP_AT_BLOCKER');
    if(t&&!slide){d.clickToy(t.id);if(s().impactedToys.some(x=>x.id===t.id))throw Error('early collision');const m=s().movingImpacts.find(x=>x.toyId===t.id);window.advanceTime(m.remainingMs+17);if(!s().impactedToys.some(x=>x.id===t.id))throw Error('missing arrival collision');window.advanceTime(500);if(s().impactedToys.length)throw Error('collision never settles');slide=true;}
    d.startLevel(level);const hit=s().toys.find(t=>t.outcome==='BLOCKED');if(hit&&!blocked){d.clickToy(hit.id);if(!s().impactedToys.some(x=>x.id===hit.id))throw Error('missing immediate collision');blocked=true;}
   }
   if(!slide||!blocked)throw Error('collision cases not exercised');
   d.startLevel(0);const n=s().remaining;d.clickToy(d.availableIds()[0]);if(!s().exitingToys.length)throw Error('exit not started');window.advanceTime(2000);if(s().exitingToys.length||s().remaining>=n)throw Error('exit not completed');
   d.startLevel(0);frame(0);return samples;
  });
  samples.push(...result);await p.screenshot({path:`test-output/toy-motion/${entry==='/'?'source':'built'}-idle.png`});
  await p.evaluate(()=>{const s=JSON.parse(window.render_game_to_text());window.__toyhouse_debug.clickToy(s.toys.find(t=>t.outcome==='BLOCKED').id);window.advanceTime(70);});
  await p.screenshot({path:`test-output/toy-motion/${entry==='/'?'source':'built'}-impact.png`});
  await p.evaluate(()=>{window.advanceTime(500);window.__toyhouse_debug.clickToy(window.__toyhouse_debug.availableIds()[0]);window.advanceTime(200);});
  await p.screenshot({path:`test-output/toy-motion/${entry==='/'?'source':'built'}-exit.png`});
  await p.evaluate(()=>{window.__toyhouse_debug.startLevel(19);window.advanceTime(100);});
  await p.screenshot({path:`test-output/toy-motion/${entry==='/'?'source':'built'}-mixed.png`});
  await p.evaluate(()=>{for(let i=0;i<20;i++){window.__toyhouse_debug.startLevel(i);window.__toyhouse_debug.clearCurrentLevel();window.advanceTime(4000);const s=JSON.parse(window.render_game_to_text());if(s.remaining!==0||s.exitingToys.length)throw Error(`level ${i+1} failed to settle`);}});
  assert.deepEqual(errors,[]);await p.close();
 }
 await writeFile('test-output/toy-motion/pose-samples.json',JSON.stringify(samples));
 console.log('PASS: source/build idle transforms, stable cells, pause, immediate/arrival collisions, exits, finite poses, no page errors');
}finally{await browser.close();}
