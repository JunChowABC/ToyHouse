import {readFile,mkdir} from 'node:fs/promises';
import {chromium} from '../scripts/playwright_system_chrome.mjs';
const data=JSON.parse(await readFile(process.argv[2] || 'output/tall-screen-maker/tall-traces.json','utf8'));
const files={};
for(const [id,path] of Object.entries(data.files)) files[id]='data:image/png;base64,'+(await readFile(path)).toString('base64');
const out=process.argv[3] || 'test-output/tall-maker';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:540,height:960}});
 await page.setContent('<style>body{margin:0}</style><canvas width="540" height="960"></canvas>');
 await page.evaluate(async files=>{
  window.images={};for(const [id,url] of Object.entries(files)){const im=new Image();im.src=url;await im.decode();window.images[id]=im;}
 },files);
 for(const [name,trace] of Object.entries(data.scenes)){
  const size=data.layouts?.[name] || {width:540,height:960};await page.setViewportSize(size);await page.evaluate(size=>{const c=document.querySelector('canvas');c.width=size.width;c.height=size.height;},size);
  await page.evaluate(trace=>{
   const c=document.querySelector('canvas').getContext('2d');c.reset();
   let paint=null,fontSize=16,stack=[];
   const rgba=a=>`rgba(${a[0]},${a[1]},${a[2]},${a[3]/255})`;
   for(const [op,a] of trace){
    switch(op){
     case 'nvgSave':c.save();stack.push({paint,fontSize});break;
     case 'nvgRestore':c.restore();({paint,fontSize}=stack.pop());break;
     case 'nvgTranslate':c.translate(...a);break;
     case 'nvgScale':c.scale(...a);break;
     case 'nvgRotate':c.rotate(...a);break;
     case 'nvgBezierTo':c.bezierCurveTo(...a);break;
     case 'nvgLineCap':c.lineCap=a[0]===1?'round':'butt';break;
     case 'nvgBeginPath':c.beginPath();break;
     case 'nvgRect':c.rect(...a);break;
     case 'nvgRoundedRect':c.roundRect(...a);break;
     case 'nvgEllipse':c.ellipse(...a,0,0,Math.PI*2);break;
     case 'nvgCircle':c.arc(...a,0,Math.PI*2);break;
     case 'nvgFillColor':paint=null;c.fillStyle=rgba(a[0]);break;
     case 'nvgFillPaint':paint=a[0];break;
     case 'nvgFill':if(paint){c.save();c.clip();c.globalAlpha*=paint.alpha;c.drawImage(window.images[paint.image],...paint.bounds);c.restore();}else c.fill();break;
     case 'nvgIntersectScissor':c.beginPath();c.rect(...a);c.clip();break;
     case 'nvgGlobalAlpha':c.globalAlpha=a[0];break;
     case 'nvgFontSize':fontSize=a[0];c.font=`${fontSize}px "Microsoft YaHei"`;break;
     case 'nvgTextAlign':c.textAlign='center';c.textBaseline='middle';break;
     case 'nvgText':c.fillText(String(a[2]),a[0],a[1]);break;
     case 'nvgStrokeColor':c.strokeStyle=rgba(a[0]);break;
     case 'nvgStrokeWidth':c.lineWidth=a[0];break;
     case 'nvgStroke':c.stroke();break;
    }
   }
  },trace);
  await page.screenshot({path:`${out}/${name}.png`});
 }
 console.log(`Rendered ${Object.keys(data.scenes).length} real Lua draw traces (Canvas replay; not engine acceptance)`);
}finally{await browser.close();}
