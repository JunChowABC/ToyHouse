import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from '../scripts/playwright_system_chrome.mjs';
import ART from '../src/tool-art-manifest.js';

const out = 'test-output/tool-popup2';
await mkdir(out, { recursive: true });
for (const spec of Object.values(ART.assets)) {
  assert.deepEqual(await readFile(`${ART.directory}/${spec.file}`), await readFile(`docs/${ART.directory}/${spec.file}`));
}
const browser = await chromium.launch({ headless: true });
const errors = [], checks = [];
try {
  for (const [entry, width, height] of [['/',540,960], ['/docs/',390,844], ['/docs/',1024,768]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
    page.on('response', r => { if(r.status()>=400) errors.push(r.url()); });
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 0;
      window.__toolTrace = [];
      const proto = CanvasRenderingContext2D.prototype, clear = proto.clearRect, draw = proto.drawImage;
      proto.clearRect = function(...a) { if(this.canvas.id==='game') window.__toolTrace=[]; return clear.apply(this,a); };
      proto.drawImage = function(im,...a) {
        if(this.canvas.id==='game' && im.src?.includes('/tool-popup2-v1/')) window.__toolTrace.push({file:im.src.split('/').pop(), bounds:a, filter:this.filter, scale:this.getTransform().a});
        return draw.call(this,im,...a);
      };
    });
    await page.goto(`http://127.0.0.1:4173${entry}`,{waitUntil:'networkidle'});
    await page.evaluate(()=>window.__toyhouse_background_ready);
    await page.keyboard.press('Enter');
    const state = ()=>page.evaluate(()=>JSON.parse(window.render_game_to_text()));
    const click = async r => {
      const box = await page.locator('#game').boundingBox();
      await page.mouse.click(box.x+(r.x+r.w/2)*box.width/540,box.y+(r.y+r.h/2)*box.height/960);
    };
    await page.evaluate(()=>window.__toyhouse_debug.grantReward({id:'visual-coins',source:'task',coins:1000}));
    for (const action of ['buy','use']) {
      if(action==='use') await page.evaluate(()=>window.__toyhouse_debug.grantReward({id:'visual-tools',source:'task',tools:{remove:1,shuffle:1,flip:1}}));
      for (const id of ['remove','shuffle','flip']) {
        await page.evaluate(()=>window.advanceTime(1500));
        await click((await state()).uiHitAreas.tools.find(t=>t.id===id));
        assert.equal((await state()).toolDialog.action,action);
        const trace = await page.evaluate(()=>window.__toolTrace);
        const files = trace.map(t=>t.file);
        for(const name of [...ART.common,...ART.close,...ART.icons[id], ...(ART.titles[id]?[ART.titles[id]]:[])]) {
          const item=trace.find(t=>t.file===ART.assets[name].file);
          assert.ok(item,`${id}: missing ${name}`);
          assert.deepEqual(item.bounds,ART.assets[name].bounds);
        }
        assert.ok(files.includes(action==='buy'?'purchase_base.png':'use_base.png'));
        assert.ok(!files.includes(action==='buy'?'use_base.png':'purchase_base.png'));
        await page.screenshot({path:`${out}/${width}-${id}-${action}.png`});
        // Press and drag away must leave the dialog and economy intact.
        const before=(await state()).economy, r=(await state()).uiHitAreas.toolModal.action;
        const box=await page.locator('#game').boundingBox();
        await page.mouse.move(box.x+(r.x+r.w/2)*box.width/540,box.y+(r.y+r.h/2)*box.height/960);
        await page.mouse.down();
        await page.mouse.move(box.x+5,box.y+5); await page.mouse.up();
        assert.deepEqual((await state()).economy,before);
        assert.equal((await state()).toolDialog.id,id);
        await click((await state()).uiHitAreas.toolModal.close);
        assert.equal((await state()).toolDialog,null);
        checks.push({entry,width,id,action,status:'PASS'});
      }
    }
    await page.close();
  }
  assert.deepEqual(errors,[]);
  await writeFile(`${out}/report.json`,JSON.stringify({checks,errors},null,2));
  console.log('Tool popup art: 18 viewport/tool/state combinations passed');
} finally { await browser.close(); }
