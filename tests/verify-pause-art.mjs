import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "../scripts/playwright_system_chrome.mjs";

const output = new URL("../test-output/pause-art/", import.meta.url);
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(new URL("../assets/pause-dialog-v2/manifest.json", import.meta.url), "utf8"));
for (const s of Object.values(manifest.assets)) {
  assert.deepEqual(await readFile(new URL(`../assets/pause-dialog-v2/${s.file}`, import.meta.url)), await readFile(new URL(`../docs/assets/pause-dialog-v2/${s.file}`, import.meta.url)));
}
const browser = await chromium.launch({ headless: true });
const results = [], errors = [];
try {
  for (const [entry, width, height, dpr] of [["/", 540, 960, 1], ["/docs/", 390, 844, 2], ["/docs/", 1024, 768, 1]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
    page.on("pageerror", e => errors.push(String(e)));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    page.on("response", r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.addInitScript(() => {
      window.__vibrationCalls = [];
      Object.defineProperty(navigator, "vibrate", { configurable: true, value: pattern => { window.__vibrationCalls.push(pattern); return true; } });
      const trace = window.__pauseTrace = { images: [], texts: [] };
      const proto = CanvasRenderingContext2D.prototype, clear = proto.clearRect, draw = proto.drawImage, text = proto.fillText;
      proto.clearRect = function (...args) { trace.images = []; trace.texts = []; return clear.apply(this, args); };
      proto.drawImage = function (image, ...args) {
        if (image.src?.includes("/pause-dialog-v2/")) trace.images.push({ src: image.src.split("/").pop(), bounds: args });
        return draw.call(this, image, ...args);
      };
      proto.fillText = function (value, ...args) { trace.texts.push(String(value)); return text.call(this, value, ...args); };
    });
    await page.goto(`http://127.0.0.1:4173${entry}`, { waitUntil: "networkidle" });
    assert.equal(await page.evaluate(() => window.__toyhouse_art_ready), true);
    const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const click = async (x, y) => { const b = await page.locator("#game").boundingBox(); await page.mouse.click(b.x + x / 540 * b.width, b.y + y / 960 * b.height); };
    const action = async id => { const r = (await read()).uiHitAreas.pauseMenu[id]; await click(r.x + r.w / 2, r.y + r.h / 2); };
    await click(270, 785);
    const pause = (await read()).uiHitAreas.pause;
    await click(pause.x + pause.w / 2, pause.y + pause.h / 2);
    let state = await read();
    assert.equal(state.paused, true);
    assert.deepEqual(state.settings, { musicEnabled: true, audioEnabled: true, vibrationEnabled: false });
    assert.deepEqual(await page.evaluate(() => window.__vibrationCalls), []);
    assert.equal(state.pauseArt.loaded, 50);
    const trace = await page.evaluate(() => { window.advanceTime(0); return window.__pauseTrace; });
    assert.equal(trace.images.length, 49, "must render individual resources, not a flattened reference");
    for (const label of ["暂停中", "继续", "重新开始", "返回首页", "音乐", "音效", "震动", "关"]) assert.ok(trace.texts.includes(label), label);
    const knob = trace.images.find(s => s.src === "ui_pause_vibration_knob.png");
    assert.ok(knob.bounds[0] < 720, "off thumb must be on the left");
    await page.screenshot({ path: fileURLToPath(new URL(`${width}-default.png`, output)) });
    await click(510, 860);
    await page.keyboard.press("1");
    assert.equal((await read()).paused, true);
    assert.equal((await read()).moves, state.moves);
    for (const id of ["music", "audio", "vibration"]) await action(id);
    state = await read();
    assert.deepEqual(state.settings, { musicEnabled: false, audioEnabled: false, vibrationEnabled: true });
    const toggled = await page.evaluate(() => { window.advanceTime(0); return window.__pauseTrace; });
    assert.ok(toggled.images.some(i => i.src === "ui_pause_vibration_track_on.png"));
    assert.ok(toggled.images.find(i => i.src === "ui_pause_vibration_knob.png").bounds[0] > 730);
    await page.screenshot({ path: fileURLToPath(new URL(`${width}-toggled.png`, output)) });
    await page.keyboard.press("Escape");assert.equal((await read()).paused, false);
    await page.keyboard.press("p");assert.equal((await read()).paused, true);
    await action("resume");assert.equal((await read()).paused, false);
    await page.reload({ waitUntil: "networkidle" });
    await click(270, 785);
    assert.deepEqual((await read()).settings, state.settings, "settings survive reload");
    assert.ok((await page.evaluate(() => window.__vibrationCalls)).length > 0, "vibration works while audio is muted");
    await page.keyboard.press("p");await action("vibration");
    const pulses = await page.evaluate(() => window.__vibrationCalls.length);
    await action("restart");
    assert.equal(await page.evaluate(() => window.__vibrationCalls.length), pulses, "off state suppresses haptics");
    assert.equal((await read()).paused, false);assert.equal((await read()).moves, 0);
    await page.keyboard.press("p");await action("exit");assert.equal((await read()).mode, "home");
    results.push({ entry, viewport: [width, height], dpr, status: "PASS", resourcesDrawn: 49, settingsPersisted: true });
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL("report.json", output), JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
