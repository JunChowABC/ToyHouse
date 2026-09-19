import assert from "node:assert/strict";
import { chromium } from "../scripts/playwright_system_chrome.mjs";
import { mkdir, writeFile } from "node:fs/promises";

const browser = await chromium.launch({ headless: true });
const errors = [], results = [];
const measureOnly = process.argv.includes("--measure-only");
try {
  for (const entry of ["/", "/docs/"]) {
    const fixedSizes = new Map();
    const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
    await page.addInitScript(() => {
      window.__toyBoxes = [];
      const p = CanvasRenderingContext2D.prototype, clear = p.clearRect, draw = p.drawImage;
      p.clearRect = function (...args) { if (this.canvas.id === "game") window.__toyBoxes = []; return clear.apply(this, args); };
      p.drawImage = function (image, ...args) {
        if (this.canvas.id === "game" && /\/toy_(rabbit|duck|whale)_/.test(image.src || "")) {
          const [x, y, w, h] = args, m = this.getTransform();
          const corners = [[x,y], [x+w,y], [x,y+h], [x+w,y+h]].map(([px,py]) => ({ x:m.a*px+m.c*py+m.e, y:m.b*px+m.d*py+m.f }));
          window.__toyBoxes.push({ image, drawArgs:args, matrix:[m.a,m.b,m.c,m.d,m.e,m.f], asset: image.src, width:w, height:h, l:Math.min(...corners.map(p=>p.x)), r:Math.max(...corners.map(p=>p.x)), t:Math.min(...corners.map(p=>p.y)), b:Math.max(...corners.map(p=>p.y)) });
        }
        return draw.call(this, image, ...args);
      };
    });
    page.on("pageerror", error => errors.push(String(error)));
    await page.goto(`http://127.0.0.1:4173${entry}`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.__toyhouse_art_ready);
    for (let level = 0; level < 20; level++) {
      await page.evaluate(level => window.__toyhouse_debug.startLevel(level), level);
      for (const stage of ["initial", "after-exits"]) {
        if (stage === "after-exits") await page.evaluate(() => {
          for (let i = 0; i < 3; i++) window.__toyhouse_debug.clickToy(window.__toyhouse_debug.availableIds()[0]);
          window.advanceTime(4000);
        });
        const { boxes, remaining, contacts } = await page.evaluate(() => {
          window.advanceTime(0);
          const boxes = window.__toyBoxes, contacts = [];
          for (let i=0; i<boxes.length; i++) for (let j=i+1; j<boxes.length; j++) {
            const a=boxes[i], b=boxes[j];
            const l=Math.floor(Math.max(a.l,b.l)), t=Math.floor(Math.max(a.t,b.t));
            const r=Math.ceil(Math.min(a.r,b.r)), bottom=Math.ceil(Math.min(a.b,b.b));
            if (r<=l || bottom<=t) continue;
            // Measure actual visible artwork, excluding empty PNG corners.
            const masks = [a,b].map(box => {
              const c=document.createElement("canvas"); c.width=r-l; c.height=bottom-t;
              const ctx=c.getContext("2d", { willReadFrequently:true });
              const m=box.matrix;
              ctx.setTransform(m[0],m[1],m[2],m[3],m[4]-l,m[5]-t);
              ctx.imageSmoothingQuality="high";
              ctx.drawImage(box.image,...box.drawArgs);
              return ctx.getImageData(0,0,c.width,c.height).data;
            });
            let pixels=0;
            for (let p=3;p<masks[0].length;p+=4) if (masks[0][p]>128 && masks[1][p]>128) pixels++;
            contacts.push({ i,j,pixels,area:Math.min(a.width*a.height,b.width*b.height) });
          }
          return { boxes:boxes.map(({image,drawArgs,matrix,...box})=>box), contacts,
            remaining:JSON.parse(window.render_game_to_text()).remaining };
        });
        assert.equal(boxes.length, remaining);
        let minGap = Infinity;
        for (let i = 0; i < boxes.length; i++) for (let j = i+1; j < boxes.length; j++) {
          const a = boxes[i], b = boxes[j];
          const gap = Math.max(b.l-a.r, a.l-b.r, b.t-a.b, a.t-b.b);
          minGap = Math.min(minGap, gap);
        }
        for (const contact of contacts) if (!measureOnly) assert.ok(contact.pixels <= Math.max(4, contact.area*0.02),
          `${entry} level ${level+1} ${stage}: excessive opaque overlap ${JSON.stringify(contact)}`);
        for (const box of boxes) {
          const expected = fixedSizes.get(box.asset);
          if (expected) {
            assert.ok(Math.abs(box.width-expected.width) < 1e-6 && Math.abs(box.height-expected.height) < 1e-6,
              "same artwork must keep a fixed size across positions, directions, levels, and removals");
          } else fixedSizes.set(box.asset, { width:box.width, height:box.height });
          assert.ok(Math.min(box.width,box.height) >= 36, "fixed toys must be enlarged from the prior 31px size");
        }
        results.push({ entry, level:level+1, stage, minGap, opaqueContactPixels:contacts.reduce((sum,c)=>sum+c.pixels,0), maxContactRatio:Math.max(0,...contacts.map(c=>c.pixels/c.area)) });
      }
    }
    await page.close();
  }
  assert.deepEqual(errors, []);
  await mkdir("test-output/toy-spacing", { recursive:true });
  await writeFile("test-output/toy-spacing/report.json", JSON.stringify({ measureOnly, results, errors }, null, 2));
  console.log(measureOnly
    ? "20 levels, source/release: fixed sizes passed; silhouette contact measured for requested size preview (2% limit not enforced)."
    : "20 levels, source/release, initial/after exits: fixed enlarged sizes retained; opaque silhouette contact stays below 2% per pair.");
} finally { await browser.close(); }
