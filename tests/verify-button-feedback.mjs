import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "../scripts/playwright_system_chrome.mjs";
import { HOME_UI } from "../src/home-screen.js";
import { PAUSE_UI, HOME_SETTINGS_UI, TOOL_MODAL_UI } from "../src/pause-dialog.js";
import { COMPLETE_UI } from "../src/complete-dialog.js";
import ART from "../src/art-manifest.js";

const out = "test-output/button-feedback";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [], reports = [];
try {
  for (const [entry, width, height, dpr] of [["/", 540, 960, 1], ["/docs/", 390, 844, 2]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
    page.on("pageerror", e => errors.push(String(e)));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 0;
      const p = CanvasRenderingContext2D.prototype;
      const trace = window.__feedbackTrace = { images: [], text: [], strokes: [] };
      const clear = p.clearRect, image = p.drawImage, text = p.fillText, stroke = p.strokeText;
      p.clearRect = function (...args) { trace.images = []; trace.text = []; trace.strokes = []; return clear.apply(this, args); };
      p.drawImage = function (im, ...bounds) {
        trace.images.push({ file: im.src?.split("/").pop(), bounds, scale: this.getTransform().a });
        return image.call(this, im, ...bounds);
      };
      p.fillText = function (s, ...bounds) { trace.text.push({ s: String(s), bounds, font: this.font, scale: this.getTransform().a }); return text.call(this, s, ...bounds); };
      p.strokeText = function (s, ...bounds) { trace.strokes.push({ s: String(s), color: this.strokeStyle }); return stroke.call(this, s, ...bounds); };
    });
    await page.goto(`http://127.0.0.1:4173${entry}?qa`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.__toyhouse_art_ready);
    const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const trace = () => page.evaluate(() => { window.advanceTime(0); return window.__feedbackTrace; });
    const move = async rect => {
      const b = await page.locator("canvas").boundingBox();
      await page.mouse.move(b.x + (rect.x + rect.w / 2) / 540 * b.width, b.y + (rect.y + rect.h / 2) / 960 * b.height);
    };
    const click = async rect => { await move(rect); await page.mouse.down(); await page.mouse.up(); };
    const shot = name => page.screenshot({ path: `${out}/${width}-${name}.png` });
    let checked = 0;
    async function check(rect, files, label, cancel = false) {
      await page.waitForTimeout(170);
      const before = await trace();
      await move(rect); await page.mouse.down(); await page.waitForTimeout(100);
      const held = await trace();
      for (const file of files) {
        const a = before.images.find(i => i.file === file), b = held.images.find(i => i.file === file);
        assert.ok(a && b, file);
        assert.ok(Math.abs(b.scale / a.scale - .92) < .001, `${file}: entire button should shrink`);
      }
      if (label) {
        const a = before.text.find(t => t.s === label), b = held.text.find(t => t.s === label);
        assert.ok(a && b, label);
        assert.ok(Math.abs(b.scale / a.scale - .92) < .001, `${label}: label must shrink with art`);
      }
      if (checked === 0) await shot("home-held");
      if (cancel) await page.locator("canvas").dispatchEvent("pointercancel", { pointerId: 1 });
      else await move({ x: 539, y: 959, w: 0, h: 0 });
      await page.mouse.up(); await page.waitForTimeout(170);
      const after = await trace();
      for (const file of files) assert.equal(after.images.find(i => i.file === file)?.scale, before.images.find(i => i.file === file)?.scale, `${file}: cancel returns to original scale`);
      checked++;
    }
    assert.ok((await trace()).text.some(t => t.s === "0" && t.bounds[0] === 490 && t.bounds[1] === 54));
    await check(HOME_UI.start, ["ui_sleep_outer.png", "ui_sleep_rabbit.png"], "准备睡觉", true);
    assert.equal((await read()).mode, "home");
    await check(HOME_UI.settings, ["ui_settings_base.png", "ui_settings_gear.png"]);
    await click(HOME_UI.settings);
    for (const [key, label, icon] of [["music", "音乐", "music"], ["audio", "音效", "sound"], ["vibration", "震动", "vibration"]])
      await check(HOME_SETTINGS_UI[key], [`ui_pause_${icon}_icon.png`], label);
    await check(HOME_SETTINGS_UI.close, ["ui_tool_close_v1.png"]);
    await click(HOME_SETTINGS_UI.close); await click(HOME_UI.start);
    let state = await read();
    let drawing = await trace();
    assert.ok(!drawing.images.some(i => i.file?.startsWith("ui_combo_")));
    assert.ok(!drawing.text.some(t => t.s === "COMBO"));
    assert.ok(drawing.text.some(t => t.s === "0" && t.bounds[0] === 490 && t.bounds[1] === 54));
    const title = drawing.text.find(t => t.s === "第01关");
    assert.ok(title.font.includes("15px"));
    const rabbit = drawing.images.find(i => i.file === "ui_title_rabbit_01_instance_01.png");
    const scale = 540 / 941;
    assert.ok(Math.abs(rabbit.bounds[1] - (ART.assets.ui_title_rabbit_01_instance_01.bounds[1] * scale + (960 - 1672 * scale) / 2 + 9)) < .01);
    await shot("combo-zero");
    await check(state.uiHitAreas.pause, ["ui_nav_tab_base_01_instance_01.png", "ui_nav_icon_01_instance_01.png"]);
    for (const b of state.uiHitAreas.tools) await check(b, [`ui_bottom_button_disc_01_instance_${b.slot}.png`, `${b.icon}.png`], b.label);
    await click(state.uiHitAreas.pause);
    for (const [key, part, label] of [["resume", "continue", "继续"], ["restart", "restart", "重新开始"], ["exit", "home", "返回首页"], ["music", "music", "音乐"], ["audio", "sound", "音效"], ["vibration", "vibration", "震动"]])
      await check(PAUSE_UI[key], [`ui_pause_${part}_${["resume", "restart", "exit"].includes(key) ? "base" : "icon"}.png`], label);
    await click(PAUSE_UI.resume);
    await page.evaluate(() => window.toyhouseRewards.grant({ id: "button-test", source: "task", coins: 300 }));
    await click(state.uiHitAreas.tools[0]);
    await check(TOOL_MODAL_UI.close, ["ui_tool_close_v1.png"]);
    await check(TOOL_MODAL_UI.action, ["ui_pause_continue_base.png"], "100 购买");
    await click(TOOL_MODAL_UI.close);
    await page.evaluate(() => { window.__toyhouse_debug.clickToy(window.__toyhouse_debug.availableIds()[0]); window.advanceTime(0); });
    drawing = await trace();
    assert.ok(drawing.images.some(i => i.file === "ui_combo_panel_base_01_instance_01.png"));
    assert.ok(drawing.strokes.some(t => t.s === "COMBO" && t.color === "#ffffff"));
    await shot("combo-active");
    await page.evaluate(() => window.advanceTime(8100));
    assert.equal((await read()).combo, 0);
    assert.ok(!(await trace()).images.some(i => i.file?.startsWith("ui_combo_")));
    await page.evaluate(() => { window.__toyhouse_debug.clearCurrentLevel(); window.advanceTime(4000); });
    await check(COMPLETE_UI.home, ["ui_button_home.png", "ui_icon_home.png"], "回到房间");
    await check(COMPLETE_UI.next, ["ui_button_next.png", "ui_icon_next.png"], "下一关");
    await page.evaluate(() => { window.__toyhouse_debug.startLevel(19); window.__toyhouse_debug.clearCurrentLevel(); window.advanceTime(4000); });
    await click(COMPLETE_UI.next); await page.waitForTimeout(370);
    assert.equal((await read()).mode, "night-complete");
    await check({ x: 110, y: 720, w: 320, h: 72 }, ["ui_title_base_01_instance_01.png"], "回到玩具屋");
    reports.push({ entry, width, dpr, buttons: checked, comboVisibility: "pass", title: "pass", diamondZero: "pass" });
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${out}/report.json`, JSON.stringify({ reports, errors }, null, 2));
  console.log(JSON.stringify(reports));
} finally { await browser.close(); }
