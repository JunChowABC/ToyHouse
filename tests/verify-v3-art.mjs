import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "../scripts/playwright_system_chrome.mjs";

const out = new URL("../test-output/v3-art/", import.meta.url);
await mkdir(out, { recursive: true });
const manifest = JSON.parse(await readFile(new URL("../assets/toyhouse-ui-v3/manifest.json", import.meta.url), "utf8"));
assert.ok(!Object.keys(manifest.assets).some(id => /rabbit_lie|reference|skin_/.test(id)));
const browser = await chromium.launch({ headless: true });
const errors = [], failedRequests = [], results = [];
try {
  for (const [entry, width, height, dpr] of [["/", 540, 960, 1], ["/docs/", 390, 844, 2], ["/docs/", 1024, 768, 1]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
    // Observe actual drawing transforms/text rather than trusting debug labels.
    await page.addInitScript(() => {
      const trace = window.__artDrawTrace = { rabbits: [], texts: [], rugs: [], artScales: [], roundRects: 0 };
      const p = CanvasRenderingContext2D.prototype;
      const clear = p.clearRect, draw = p.drawImage, text = p.fillText, round = p.roundRect;
      p.clearRect = function (...args) {
        trace.rabbits = []; trace.texts = []; trace.rugs = []; trace.roundRects = 0; trace.artScales = [];
        return clear.apply(this, args);
      };
      p.drawImage = function (image, ...args) {
        if (/toy_(rabbit|duck|whale)|ui_title_rabbit/.test(image.src || "")) {
          const m = this.getTransform();
          const [x, y, w, h] = args;
          trace.artScales.push({ src: image.src, uniform: Math.abs(w / image.width - h / image.height) < 1e-8,
            transformUniform: Math.abs(Math.hypot(m.a, m.b) - Math.hypot(m.c, m.d)) < 1e-8, x, y, w, h });
        }
        if (image.src?.endsWith("toy_rabbit_white_a.png")) {
          const m = this.getTransform();
          trace.rabbits.push({ x: -m.c, y: -m.d });
        }
        if (image.src?.endsWith("ui_playmat_base_01.png")) trace.rugs.push(args);
        return draw.call(this, image, ...args);
      };
      p.fillText = function (value, ...args) { trace.texts.push(String(value)); return text.call(this, value, ...args); };
      p.roundRect = function (...args) { trace.roundRects += 1; return round.apply(this, args); };
    });
    page.on("request", r => { if (r.url().includes("toyhouse-v5")) failedRequests.push(r.url()); });
    page.on("pageerror", e => errors.push(String(e)));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    page.on("response", r => { if (r.status() >= 400) failedRequests.push(r.url()); });
    await page.goto(`http://127.0.0.1:4173${entry}`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.__toyhouse_background_ready);
    assert.equal(await page.evaluate(() => window.__toyhouse_art_ready), true);
    const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const click = async (x, y) => {
      const b = await page.locator("#game").boundingBox();
      await page.mouse.click(b.x + x * b.width / 540, b.y + y * b.height / 960);
    };
    const clickRect = r => click(r.x + r.w / 2, r.y + r.h / 2);
    const clickToy = (t, board) => click(board.x + (t.x + .5) * board.cell, board.y + (t.y + .5) * board.cell);
    const capture = name => page.screenshot({ path: fileURLToPath(new URL(`${width}-${name}.png`, out)) });
    await capture("home");
    await click(270, 785);
    let state = await read();
    assert.equal(state.mode, "play");
    assert.equal(state.art.loaded, Object.keys(manifest.assets).length);
    assert.equal(state.art.rabbitPose, "head-follows-direction");
    assert.equal(state.levelTitle, "月光敲敲窗");
    assert.equal(state.art.rug.visible, false);
    assert.equal(state.remaining, 72);
    const trace = await page.evaluate(() => { window.advanceTime(0); return window.__artDrawTrace; });
    assert.equal(state.art.version, "toyhouse-ui-v3");
    assert.ok(trace.artScales.length > 0);
    assert.ok(trace.artScales.every(a => a.uniform && a.transformUniform), "all toys and title rabbit must retain source proportions");
    const rabbitTitle = trace.artScales.find(a => a.src.includes("ui_title_rabbit"));
    assert.ok(rabbitTitle);
    assert.ok(Math.abs(rabbitTitle.x - 426 * 540 / 941) < 1e-8, "title rabbit must retain the PSD position");
    assert.equal(trace.rugs.length, 0, "the separate gameplay rug must not be drawn");
    assert.equal(trace.roundRects, 0, "no default rectangular toy frames");
    assert.ok(!trace.texts.some(t => /待归位|选2只|随机5只|选1只/.test(t)));
    assert.ok(trace.texts.includes("月光敲敲窗"));
    const vectors = { UP: [0, -1], RIGHT: [1, 0], DOWN: [0, 1], LEFT: [-1, 0] };
    const rabbits = state.toys.filter(t => t.archetype === "ORDINARY");
    assert.equal(trace.rabbits.length, rabbits.length);
    rabbits.forEach((toy, index) => {
      const ears = trace.rabbits[index], length = Math.hypot(ears.x, ears.y);
      const expected = vectors[toy.direction];
      assert.ok(Math.abs(ears.x / length - expected[0]) < 1e-6 && Math.abs(ears.y / length - expected[1]) < 1e-6, `${toy.id}: ears must match travel direction`);
    });
    await capture("level-1");
    for (const id of Object.keys(manifest.assets)) {
      const bytes = await readFile(new URL(`../assets/toyhouse-ui-v3/${manifest.assets[id].file}`, import.meta.url));
      const release = await readFile(new URL(`../docs/assets/toyhouse-ui-v3/${manifest.assets[id].file}`, import.meta.url));
      assert.deepEqual(bytes, release);
    }
    const remove = state.uiHitAreas.tools.find(t => t.id === "remove");
    await page.evaluate(() => window.__toyhouse_debug.grantReward({ id: "v3-art-fixture", source: "task", tools: { remove: 1, flip: 1, shuffle: 1 } }));
    await clickRect(remove);
    await clickRect(state.uiHitAreas.toolModal.action);
    await clickToy(state.toys[0], state.board);
    state = await read();
    assert.equal(state.toolSelection.length, 1);
    await capture("selected");
    await clickToy(state.toys[1], state.board);
    assert.equal((await read()).remaining, 70);
    await page.evaluate(() => window.advanceTime(1000));
    await clickRect(state.uiHitAreas.pause);
    state = await read();
    assert.equal(state.paused, true);
    await capture("pause");
    await clickRect(state.uiHitAreas.pauseMenu.restart);
    state = await read();
    assert.equal(state.remaining, 72);
    await clickRect(state.uiHitAreas.tools.find(t => t.id === "flip"));
    await clickRect(state.uiHitAreas.toolModal.action);
    const target = state.toys[0];
    await clickToy(target, state.board);
    state = await read();
    assert.notEqual(state.toys.find(t => t.id === target.id).direction, target.direction);
    await clickRect(state.uiHitAreas.tools.find(t => t.id === "shuffle"));
    await clickRect(state.uiHitAreas.toolModal.action);
    state = await read();
    assert.equal(state.toolUses.shuffle, 1);
    await page.evaluate(() => window.__toyhouse_debug.restartLevel());
    state = await read();
    await clickToy(state.toys.find(t => t.id === state.exitReadyToyIds[0]), state.board);
    state = await read();
    assert.equal(state.combo, 1);
    await clickRect(state.uiHitAreas.pause);
    state = await read();
    const ms = state.comboRemainingMs;
    await page.evaluate(() => window.advanceTime(3000));
    assert.equal((await read()).comboRemainingMs, ms);
    await clickRect(state.uiHitAreas.pauseMenu.resume);
    await page.evaluate(() => window.advanceTime(500));
    assert.ok((await read()).comboRemainingMs < ms - 450);
    await capture("combo");
    await page.evaluate(() => window.__toyhouse_debug.startLevel(15));
    state = await read();
    assert.ok(state.toys.some(t => t.archetype === "LARGE"));
    assert.ok(state.toys.some(t => t.archetype === "AUTO_EXIT"));
    const mixedTrace = await page.evaluate(() => { window.advanceTime(0); return window.__artDrawTrace; });
    assert.ok(mixedTrace.artScales.every(a => a.uniform && a.transformUniform));
    assert.ok(mixedTrace.artScales.some(a => a.src.includes("whale")));
    assert.ok(mixedTrace.artScales.some(a => a.src.includes("duck")));
    await capture("level-16");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight);
    assert.equal(overflow, false);
    results.push({ entry, width, height, dpr, loaded: state.art.loaded, controls: "pass", screenshots: "captured" });
    await page.close();
  }
  assert.deepEqual(errors, []);
  assert.deepEqual(failedRequests, []);
  await writeFile(new URL("report.json", out), JSON.stringify({ results, errors, failedRequests }, null, 2));
  console.log("V3 assets: source/release parity, mobile/tablet layouts, tool hit targets, pause and combo passed");
} finally {
  await browser.close();
}
