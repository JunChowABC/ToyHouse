import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "../scripts/playwright_system_chrome.mjs";

const output = new URL("../test-output/pause-art/", import.meta.url);
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(new URL("../assets/pause-popup2-v2/manifest.json", import.meta.url), "utf8"));
for (const s of Object.values(manifest.assets)) {
  assert.deepEqual(await readFile(new URL(`../assets/pause-popup2-v2/${s.file}`, import.meta.url)), await readFile(new URL(`../docs/assets/pause-popup2-v2/${s.file}`, import.meta.url)));
  assert.deepEqual(await readFile(new URL(`../assets/pause-popup2-v2/${s.file}`, import.meta.url)), await readFile(new URL(`../outputs/pause-popup2-layered-v2-arttext/layers/${s.file}`, import.meta.url)));
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
      window.requestAnimationFrame = () => 0;
      window.__vibrationCalls = [];
      Object.defineProperty(navigator, "vibrate", { configurable: true, value: pattern => { window.__vibrationCalls.push(pattern); return true; } });
      const trace = window.__pauseTrace = { images: [], texts: [] };
      const proto = CanvasRenderingContext2D.prototype, clear = proto.clearRect, draw = proto.drawImage, text = proto.fillText;
      proto.clearRect = function (...args) { trace.images = []; trace.texts = []; return clear.apply(this, args); };
      proto.drawImage = function (image, ...args) {
        if (image.src?.includes("/pause-popup2-v2/")) trace.images.push({ src: image.src.split("/").pop(), bounds: args, scale: this.getTransform().a });
        return draw.call(this, image, ...args);
      };
      proto.fillText = function (value, ...args) { trace.texts.push(String(value)); return text.call(this, value, ...args); };
    });
    await page.goto(`http://127.0.0.1:4173${entry}`, { waitUntil: "networkidle" });
    assert.equal(await page.evaluate(() => window.__toyhouse_art_ready), true);
    await page.waitForFunction(() => Boolean(window.__toyhouse_background_ready));
    await page.evaluate(() => window.__toyhouse_background_ready);
    const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const click = async (x, y) => { const b = await page.locator("#game").boundingBox(); await page.mouse.click(b.x + x / 540 * b.width, b.y + y / 960 * b.height); };
    const action = async id => { const r = (await read()).uiHitAreas.pauseMenu[id]; await click(r.x + r.w / 2, r.y + r.h / 2); };
    await page.keyboard.press("Enter");
    const pause = (await read()).uiHitAreas.pause;
    await click(pause.x + pause.w / 2, pause.y + pause.h / 2);
    let state = await read();
    assert.equal(state.paused, true);
    assert.deepEqual(state.settings, { musicEnabled: true, audioEnabled: true, vibrationEnabled: false });
    assert.deepEqual(await page.evaluate(() => window.__vibrationCalls), []);
    assert.equal(state.pauseArt.loaded, 46);
    assert.equal(state.pauseArt.version, "pause-popup2-v2-arttext");
    const trace = await page.evaluate(() => { window.advanceTime(0); return window.__pauseTrace; });
    assert.equal(trace.images.length, 46, "must render individual resources, not a flattened reference");
    for (const [id, spec] of Object.entries(manifest.assets)) {
      assert.deepEqual(trace.images.find(i => i.src === spec.file)?.bounds, spec.bounds, id + " default placement matches PSD");
    }
    for (const label of ["背景音乐", "游戏音效", "震动反馈"]) assert.ok(trace.texts.includes(label), label);
    for (const label of ["暂停", "重新开始", "继续游戏", "退出关卡"]) assert.ok(!trace.texts.includes(label), label + " must use artistic lettering");
    // Every action's artwork and caption press together; dragging out cancels.
    for (const [key, ids] of [["resume", ["continue_base", "continue_icon", "arttext_continue"]], ["restart", ["restart_base", "restart_icon", "arttext_restart"]], ["exit", ["exit_base", "exit_icon", "arttext_exit"]], ["music", ["music_icon", "music_thumb"]], ["audio", ["sound_icon", "sound_thumb"]], ["vibration", ["vibration_icon", "vibration_thumb"]]]) {
      await page.waitForTimeout(170);
      const r=(await read()).uiHitAreas.pauseMenu[key],b=await page.locator('#game').boundingBox();
      await page.mouse.move(b.x+(r.x+r.w/2)*b.width/540,b.y+(r.y+r.h/2)*b.height/960);
      await page.mouse.down();await page.waitForTimeout(100);
      const held=await page.evaluate(() => { window.advanceTime(0); return window.__pauseTrace; });
      for (const id of ids) assert.ok(Math.abs(held.images.find(i=>i.src===id+'.png').scale/trace.images.find(i=>i.src===id+'.png').scale-.92)<.001,id+' pressed');
      await page.mouse.move(b.x+2,b.y+2);await page.mouse.up();
      assert.equal((await read()).paused,true);
      assert.deepEqual((await read()).settings,state.settings);
    }
    await page.waitForTimeout(170);await page.evaluate(() => window.advanceTime(0));
    await page.screenshot({ path: fileURLToPath(new URL(`${width}-default.png`, output)) });
    await click(510, 860);
    await page.keyboard.press("1");
    assert.equal((await read()).paused, true);
    assert.equal((await read()).moves, state.moves);
    for (const id of ["music", "audio", "vibration"]) await action(id);
    state = await read();
    assert.deepEqual(state.settings, { musicEnabled: false, audioEnabled: false, vibrationEnabled: true });
    const toggled = await page.evaluate(() => { window.advanceTime(0); return window.__pauseTrace; });
    assert.ok(toggled.images.some(i => i.src === "music_track.png" && i.bounds[1]===810));
    assert.ok(toggled.images.some(i => i.src === "music_thumb.png" && i.bounds[0]===621 && i.bounds[1]===809));
    assert.equal(toggled.images.filter(i => i.src === "vibration_thumb.png" && i.bounds[0]===560).length,2);
    await page.screenshot({ path: fileURLToPath(new URL(`${width}-toggled.png`, output)) });
    await page.keyboard.press("Escape");assert.equal((await read()).paused, false);
    await page.keyboard.press("p");assert.equal((await read()).paused, true);
    await action("resume");assert.equal((await read()).paused, false);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForFunction(() => Boolean(window.__toyhouse_background_ready));
    await page.evaluate(() => window.__toyhouse_background_ready);
    await page.keyboard.press("Enter");
    assert.deepEqual((await read()).settings, state.settings, "settings survive reload");
    assert.ok((await page.evaluate(() => window.__vibrationCalls)).length > 0, "vibration works while audio is muted");
    await page.keyboard.press("p");await action("vibration");
    const pulses = await page.evaluate(() => window.__vibrationCalls.length);
    await action("restart");
    assert.equal(await page.evaluate(() => window.__vibrationCalls.length), pulses, "off state suppresses haptics");
    assert.equal((await read()).paused, false);assert.equal((await read()).moves, 0);
    await page.keyboard.press("p");await action("exit");assert.equal((await read()).mode, "home");
    const home=(await read()).uiHitAreas.home.settings;
    await click(home.x+home.w/2,home.y+home.h/2);
    assert.equal((await read()).settingsOpen,true);
    await page.screenshot({ path: fileURLToPath(new URL(`${width}-home-settings.png`, output)) });
    await page.keyboard.press('Escape');assert.equal((await read()).settingsOpen,false);
    results.push({ entry, viewport: [width, height], dpr, status: "PASS", resourcesDrawn: 46, artisticLabels: 4, settingsPersisted: true, pressedAndCancelled: 6 });
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL("report.json", output), JSON.stringify({ results, errors }, null, 2));
  console.log(JSON.stringify(results));
} finally { await browser.close(); }
