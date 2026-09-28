// Export the published web UI manifests for the independent Maker renderer.
import { mkdir, writeFile } from 'node:fs/promises';
import core from '../src/art-manifest.js';
import pause from '../src/pause-art-manifest.js';
import complete from '../src/complete-art-manifest.js';
import tool from '../src/tool-art-manifest.js';
import home from '../src/home-runtime-manifest.js';
import loading from '../src/loading-art-manifest.js';
import aliases from '../src/image-aliases.js';
import atlas from '../src/runtime-atlas-manifest.js';
import { chromium } from './playwright_system_chrome.mjs';
await mkdir('output/maker-ui-sync', { recursive: true });
// Preserve the web's STHupo remove title instead of substituting Maker's MiSans.
const title = tool.textLayers.find(s => s.name === 'txt_title');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const png = await page.evaluate(s => {
    const canvas=document.createElement('canvas');
    canvas.width=s.delivery_bounds[2];canvas.height=s.delivery_bounds[3];
    const c=canvas.getContext('2d');c.font=`${s.font_weight || 400} ${s.font_size}px STHupo, "华文琥珀", "Arial Rounded MT Bold", "Microsoft YaHei", sans-serif`;
    c.textAlign='center';c.textBaseline='alphabetic';c.lineJoin='round';
    const m=c.measureText(s.text), ascent=m.actualBoundingBoxAscent||s.font_size*.8, descent=m.actualBoundingBoxDescent||0;
    const baseline=(canvas.height-ascent-descent)/2+ascent;
    c.strokeStyle=s.stroke.color;c.lineWidth=s.stroke.width*2;c.strokeText(s.text,canvas.width/2,baseline,canvas.width-c.lineWidth);
    c.fillStyle=s.color;c.fillText(s.text,canvas.width/2,baseline,canvas.width-s.stroke.width*2);
    return canvas.toDataURL().split(',')[1];
  }, title);
  await writeFile('output/maker-ui-sync/title_remove.png', Buffer.from(png,'base64'));
} finally { await browser.close(); }
tool.assets.title_remove={file:'title_remove.png',directory:'output/maker-ui-sync',bounds:title.delivery_bounds};
tool.titles.remove='title_remove';
// Match enabled entries and compact placement in home-screen.js.
const enabled=new Set(['start','settings']);
const first=home.assets.ui_task_label.bounds, settings=home.assets.ui_settings_label.bounds;
const dx=first[0]+first[2]/2-settings[0]-settings[2]/2, dy=first[1]-settings[1];
const placed=(b,key)=>key==='settings'?[b[0]+dx,b[1]+dy,b[2],b[3]]:b;
home.assets=Object.fromEntries(Object.entries(home.assets).filter(([,a])=>!a.control||enabled.has(a.control)).map(([id,a])=>[id,{...a,bounds:placed(a.bounds,a.control)}]));
home.layers=home.layers.filter(id=>home.assets[id]);
home.textLayers=home.textLayers.filter(s=>!s.control||enabled.has(s.control)).map(s=>({...s,delivery_bounds:placed(s.delivery_bounds,s.control)}));
home.controls=Object.fromEntries(Object.entries(home.controls).filter(([key])=>enabled.has(key)).map(([key,b])=>[key,placed(b,key)]));
await writeFile('output/maker-ui-sync/web-ui.json', JSON.stringify({ core, pause, complete, tool, home, loading, aliases, atlas }));
