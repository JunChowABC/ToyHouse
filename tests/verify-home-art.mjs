import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "../scripts/playwright_system_chrome.mjs";
import HOME_ART from "../src/home-runtime-manifest.js";
import CORE_ART from "../src/art-manifest.js";
import LEVELS from "../src/level-config.js";

const out = new URL("../test-output/home-screen2/", import.meta.url);
await mkdir(out, { recursive: true });
assert.equal(Object.keys(HOME_ART.assets).length, HOME_ART.layers.length);
for (const id of HOME_ART.excludedAssets) assert.ok(!HOME_ART.assets[id]);
for (const spec of Object.values(HOME_ART.assets)) {
  assert.deepEqual(await readFile(new URL(`../${HOME_ART.directory}/${spec.file}`, import.meta.url)),
    await readFile(new URL(`../docs/${HOME_ART.directory}/${spec.file}`, import.meta.url)));
}
const browser = await chromium.launch({ headless: true });
const errors = [], badRequests = [], reports = [];
try {
  for (const [entry, width, height, dpr] of [["/", 540, 960, 1], ["/docs/", 390, 844, 2], ["/docs/", 1024, 768, 1]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
    page.on("pageerror", e => errors.push(String(e)));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    page.on("response", r => { if (r.status() >= 400) badRequests.push(r.url()); });
    page.on("requestfailed", r => badRequests.push(r.url()));
    page.on("request", r => {
      if (/\/home-v2\/(ui_star_bar|ui_star_icon|ui_coin_bar|ui_coin_icon)\.png/.test(r.url())) badRequests.push(r.url());
    });
    await page.addInitScript(() => {
      window.requestAnimationFrame = () => 0;
      const p = CanvasRenderingContext2D.prototype;
      const clear = p.clearRect, draw = p.drawImage, text = p.fillText;
      const ids = new WeakMap(); let nextId = 1;
      const trace = window.__homeTrace = { images: [], texts: [] };
      p.clearRect = function (...args) { trace.images = []; trace.texts = []; return clear.apply(this, args); };
      p.drawImage = function (image, ...bounds) {
        if (image.src) {
          if (!ids.has(image)) ids.set(image, nextId++);
          const m = this.getTransform();
          trace.images.push({ id: ids.get(image), file: image.src.split("/").pop(), src: image.src, bounds,
            transform: [m.a, m.b, m.c, m.d, m.e, m.f] });
        }
        return draw.call(this, image, ...bounds);
      };
      p.fillText = function (value, ...args) { trace.texts.push(String(value)); return text.call(this, value, ...args); };
    });
    await page.goto(`http://127.0.0.1:4173${entry}?qa`, { waitUntil: "networkidle" });
    assert.equal(await page.evaluate(() => window.__toyhouse_art_ready), true);
    const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const trace = () => page.evaluate(() => window.__homeTrace);
    const click = async (rect) => {
      const b = await page.locator("#game").boundingBox();
      await page.mouse.click(b.x + (rect.x + rect.w / 2) * b.width / 540, b.y + (rect.y + rect.h / 2) * b.height / 960);
    };
    const capture = name => page.screenshot({ path: fileURLToPath(new URL(`${width}-${name}.png`, out)) });
    let state = await read();
    assert.equal(state.mode, "home"); assert.equal(state.nextLevel, "L001");
    assert.equal(state.progressLabel, "第一夜 · 第1关");
    assert.equal(state.homeArt.loaded, HOME_ART.layers.length); assert.equal(state.economy.coins, 0);
    const homeTrace = await trace();
    const homeImages = homeTrace.images.filter(i => Object.values(HOME_ART.assets).some(a => a.file.split("/").pop() === i.file));
    assert.equal(homeImages.length, HOME_ART.layers.length);
    for (const [id, asset] of Object.entries(HOME_ART.assets)) {
      const drawn = homeImages.find(i => i.file === asset.file.split("/").pop() && JSON.stringify(i.bounds) === JSON.stringify(asset.bounds));
      assert.ok(drawn, id); assert.deepEqual(drawn.bounds, asset.bounds);
      assert.ok(Math.abs(drawn.transform[0] - drawn.transform[3]) < 1e-8);
    }
    const runtimeReport = JSON.parse(await readFile(new URL("../assets/runtime-ui/report.json", import.meta.url), "utf8"));
    for (const artwork of ["bg_room_complete", "ui_hint_plate"]) {
      const merged = runtimeReport.staticHomeLayers.find(layer => layer.sources.includes(artwork));
      assert.ok(merged, artwork);
      assert.ok(homeImages.some(i => i.file === merged.path.split("/").pop()));
    }
    assert.ok(homeImages.some(i => i.file === 'art_start_title.png'));
    const plates = homeImages.filter(i => i.file === 'ui_album_label.png');
    assert.equal(plates.length, 7);
    assert.equal(new Set(plates.map(i => i.id)).size, 1, 'all title plates share one loaded image');
    const badges = homeImages.filter(i => i.file === 'ui_task_notification.png');
    assert.equal(badges.length, 2);
    assert.equal(new Set(badges.map(i => i.id)).size, 1, 'notifications share one loaded image');
    assert.ok(!homeTrace.texts.some(t => /每个玩具|第4天|^120$/.test(t)));
    const currencyFiles = Object.entries(CORE_ART.assets).filter(([, v]) => v.group === "06_RESOURCES").map(([, v]) => v.file);
    const currencies = homeTrace.images.filter(i => currencyFiles.includes(i.file));
    assert.equal(currencies.length, currencyFiles.length);
    await capture("home");
    // Every component follows its own entry; holding/cancelling never scales the room.
    for (const [key, rect] of Object.entries(state.uiHitAreas.home)) {
      await page.waitForTimeout(170);
      await page.evaluate(() => window.advanceTime(0));
      const before = await trace();
      const box = await page.locator('#game').boundingBox();
      await page.mouse.move(box.x+(rect.x+rect.w/2)*box.width/540, box.y+(rect.y+rect.h/2)*box.height/960);
      await page.mouse.down(); await page.waitForTimeout(100);
      await page.evaluate(() => window.advanceTime(0));
      const held = await trace();
      for (const asset of Object.values(HOME_ART.assets)) {
        const find = t => t.images.find(i => i.file === asset.file.split('/').pop() && JSON.stringify(i.bounds) === JSON.stringify(asset.bounds));
        const a = find(before), b = find(held);
        const expected = asset.control === key ? .92 : 1;
        assert.ok(Math.abs(b.transform[0]/a.transform[0]-expected)<.001, `${key}: ${asset.file} press transform`);
      }
      await page.mouse.move(box.x+box.width-1, box.y+box.height-1);
      await page.mouse.up(); await page.waitForTimeout(170);
      await page.evaluate(() => window.advanceTime(0));
      assert.equal((await read()).mode, 'home');
      assert.equal((await read()).settingsOpen, false);
      assert.equal((await read()).message, null);
    }
    for (const [key, label] of Object.entries({task:'任务',event:'活动',mail:'邮箱',signin:'七日签到',album:'图鉴',dress:'装扮'})) {
      await click(state.uiHitAreas.home[key]);
      assert.equal((await read()).message, `${label}功能敬请期待`);
      assert.equal((await read()).mode, 'home');
      assert.equal((await read()).economy.coins, 0);
    }
    await click({ x: 470, y: 42, w: 50, h: 57 });
    assert.equal((await read()).mode, "home"); assert.equal((await read()).economy.coins, 0);
    await click(state.uiHitAreas.home.settings);
    assert.equal((await read()).settingsOpen, true);
    const settingsTrace = await trace();
    for (const value of ["设置", "背景音乐", "游戏音效", "震动反馈"]) assert.ok(settingsTrace.texts.includes(value));
    assert.ok(settingsTrace.images.some(i => i.src.includes('/pause-popup2-v2/') && i.file === 'settings_region.png'));
    assert.ok(!settingsTrace.images.some(i => i.src.includes('/pause-dialog-v2/')), 'home settings must not draw legacy artwork');
    assert.ok(!settingsTrace.images.some(i => /^(restart_|continue_|exit_|arttext_pause)/.test(i.file)), 'no in-level controls in home settings');
    for (const [key, file] of [['music','music_icon.png'], ['audio','sound_icon.png'], ['vibration','vibration_icon.png'], ['close','close_base.png']]) {
      const rect = state.uiHitAreas.settings[key], box = await page.locator('#game').boundingBox();
      await page.waitForTimeout(170); await page.evaluate(() => window.advanceTime(0));
      const before = (await trace()).images.find(i => i.file === file);
      const choicesBefore = (await read()).settings;
      await page.mouse.move(box.x+(rect.x+rect.w/2)*box.width/540, box.y+(rect.y+rect.h/2)*box.height/960);
      await page.mouse.down(); await page.waitForTimeout(100); await page.evaluate(() => window.advanceTime(0));
      const held = (await trace()).images.find(i => i.file === file);
      assert.ok(Math.abs(held.transform[0]/before.transform[0]-.92)<.001, `settings ${key}: press feedback`);
      await page.mouse.move(box.x+box.width-1, box.y+box.height-1); await page.mouse.up();
      assert.equal((await read()).settingsOpen, true);
      assert.deepEqual((await read()).settings, choicesBefore, 'cancel must not toggle a setting');
    }
    assert.ok(!settingsTrace.texts.some(t => ["暂停中", "继续", "重新开始", "返回首页"].includes(t)));
    await click(state.uiHitAreas.home.start); await page.keyboard.press("Enter");
    assert.equal((await read()).mode, "home"); assert.equal((await read()).settingsOpen, true);
    for (const key of ["music", "audio", "vibration"]) await click(state.uiHitAreas.settings[key]);
    const choices = { musicEnabled: false, audioEnabled: false, vibrationEnabled: true };
    assert.deepEqual((await read()).settings, choices);
    await capture("settings");
    await click(state.uiHitAreas.settings.close);
    await click(state.uiHitAreas.home.start);
    state = await read(); assert.equal(state.mode, "play"); assert.equal(state.level, "L001");
    assert.deepEqual(state.settings, choices);
    const playCurrency = (await trace()).images.filter(i => currencyFiles.includes(i.file));
    assert.deepEqual(playCurrency, currencies, "home and gameplay must use identical Image objects, source files, size and position");
    await capture("play");
    await click(state.uiHitAreas.pause); await click(state.uiHitAreas.pauseMenu.exit);
    assert.equal((await read()).nextLevel, "L001");
    await page.keyboard.press("Enter");
    await page.evaluate(() => { window.__toyhouse_debug.clearCurrentLevel(); window.advanceTime(4000); });
    state = await read(); assert.equal(state.mode, "level-complete"); assert.equal(state.economy.coins, 30);
    await click(state.uiHitAreas.completion.home);
    state = await read(); assert.equal(state.mode, "home"); assert.equal(state.nextLevel, "L002");
    assert.equal(state.progressLabel, "第一夜 · 第2关"); assert.equal(state.economy.coins, 30);
    assert.ok((await trace()).texts.includes("30"));
    await capture("after-reward");
    await page.reload({ waitUntil: "networkidle" }); await page.evaluate(() => window.__toyhouse_art_ready);
    state = await read(); assert.equal(state.nextLevel, "L002"); assert.equal(state.economy.coins, 30); assert.deepEqual(state.settings, choices);
    await click(state.uiHitAreas.home.start); assert.equal((await read()).level, "L002");
    await page.evaluate(() => window.__toyhouse_debug.exitLevel());
    assert.equal((await read()).nextLevel, "L002");
    // Existing save data drives the all-complete variant; no fake level 21.
    await page.evaluate(ids => {
      const p = JSON.parse(localStorage.getItem("toyhouse-economy-v1"));
      p.completedLevels = ids; localStorage.setItem("toyhouse-economy-v1", JSON.stringify(p));
    }, LEVELS.levels.map(l => l.level_id));
    await page.reload({ waitUntil: "networkidle" }); await page.evaluate(() => window.__toyhouse_art_ready);
    state = await read(); assert.equal(state.complete, true); assert.equal(state.nextLevel, null);
    assert.ok((await trace()).texts.includes("今晚好梦"));
    await click(state.uiHitAreas.home.start); await page.keyboard.press("Enter"); assert.equal((await read()).mode, "home");
    await capture("all-complete");
    await click(state.uiHitAreas.home.settings); assert.equal((await read()).settingsOpen, true);
    await page.keyboard.press("Escape"); assert.equal((await read()).settingsOpen, false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth), false);
    reports.push({ entry, width, height, dpr, homeAssets: HOME_ART.layers.length, sharedCurrencyImageObjects: currencyFiles.length, sharedTitlePlates: 7, sharedBadges: 2, settings: "pass", progressionAndSave: "pass" });
    await page.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(badRequests, []);
  await writeFile(new URL("report.json", out), JSON.stringify({ reports, errors, badRequests }, null, 2));
  console.log(JSON.stringify(reports));
} finally { await browser.close(); }
