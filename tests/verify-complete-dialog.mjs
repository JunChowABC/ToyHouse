import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "../scripts/playwright_system_chrome.mjs";

const output = new URL("../test-output/complete-dialog/", import.meta.url);
await mkdir(output, { recursive: true });
const manifest = JSON.parse(await readFile(new URL("../assets/level-complete-v1/manifest.json", import.meta.url), "utf8"));
for (const asset of Object.values(manifest.assets)) {
  assert.deepEqual(await readFile(new URL(`../assets/level-complete-v1/${asset.file}`, import.meta.url)),
    await readFile(new URL(`../docs/assets/level-complete-v1/${asset.file}`, import.meta.url)));
}
const browser = await chromium.launch({ headless: true });
const errors = [], reports = [];
try {
  for (const [entry, width, height, dpr] of [["/", 540, 960, 1], ["/docs/", 390, 844, 2], ["/docs/", 1024, 768, 1]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: dpr });
    page.on("pageerror", error => errors.push(String(error)));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    page.on("response", response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    await page.addInitScript(() => {
      // Deterministic updates: test the exact final-animation boundary and draw calls.
      window.requestAnimationFrame = () => 0;
      const trace = window.__completeTrace = { images: [], texts: [] };
      const proto = CanvasRenderingContext2D.prototype;
      const clear = proto.clearRect, draw = proto.drawImage, text = proto.fillText;
      proto.clearRect = function (...args) { trace.images = []; trace.texts = []; return clear.apply(this, args); };
      proto.drawImage = function (image, ...args) {
        if (image.src?.includes("/level-complete-v1/")) trace.images.push({ file: image.src.split("/").pop(), bounds: args });
        return draw.call(this, image, ...args);
      };
      proto.fillText = function (value, ...args) { trace.texts.push({ value: String(value), bounds: args }); return text.call(this, value, ...args); };
    });
    await page.goto(`http://127.0.0.1:4173${entry}`, { waitUntil: "networkidle" });
    assert.equal(await page.evaluate(() => window.__toyhouse_art_ready), true);
    const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const advance = ms => page.evaluate(ms => window.advanceTime(ms), ms);
    const start = index => page.evaluate(index => window.__toyhouse_debug.startLevel(index), index);
    const clear = () => page.evaluate(() => window.__toyhouse_debug.clearCurrentLevel());
    const click = async rect => {
      const box = await page.locator("#game").boundingBox();
      await page.mouse.click(box.x + (rect.x + rect.w / 2) / 540 * box.width, box.y + (rect.y + rect.h / 2) / 960 * box.height);
    };
    const shot = name => page.screenshot({ path: fileURLToPath(new URL(`${width}-${name}.png`, output)) });
    await start(11);
    await page.evaluate(() => window.__toyhouse_debug.restartLevel());
    await page.evaluate(() => window.__toyhouse_debug.exitLevel());
    assert.equal((await read()).economy.coins, 0, "unfinished restart/exit must not grant coins");
    await start(11);
    await clear();
    assert.equal((await read()).economy.coins, 0, "must wait until departure animations finish");
    await advance(4000);
    let state = await read();
    assert.equal(state.mode, "level-complete");
    assert.equal(state.levelNo, 12);
    assert.equal(state.economy.coins, 30);
    assert.deepEqual(state.completion.rewards, [{ type: "coins", amount: 30 }]);
    assert.equal(state.completion.art.loaded, 66);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("toyhouse-economy-v1")));
    assert.equal(saved.coins, 30);
    assert.ok(saved.completedLevels.includes("L012"));
    assert.equal(saved.rewardIds.filter(id => id.startsWith("level_clear:")).length, 1);
    const trace = await page.evaluate(() => window.__completeTrace);
    const card = trace.images.find(image => image.file === "ui_reward_card_coin.png");
    const icon = trace.images.find(image => image.file === "ui_coin.png");
    assert.equal(trace.images.length, 64, "render separate art; only one reward card/icon pair");
    assert.equal(card.bounds[0] + card.bounds[2] / 2, 941 / 2);
    assert.ok(Math.abs(icon.bounds[0] + icon.bounds[2] / 2 - 941 / 2) < 1);
    assert.ok(!trace.images.some(image => /ui_reward_card_star|ui_rainbow_star/.test(image.file)));
    for (const value of ["关卡完成", `第12关 ${state.levelTitle}`, "×30", "回到房间", "下一关"]) assert.ok(trace.texts.some(text => text.value === value), value);
    assert.ok(!trace.texts.some(text => ["×50", "×2", "这一屋安静了"].includes(text.value)));
    const count = trace.texts.find(text => text.value === "×30");
    assert.ok(Math.abs(count.bounds[0] - 941 / 2) < 1);
    await shot("single-coin");
    await advance(60000);
    assert.equal((await read()).mode, "level-complete", "waits for player choice");
    assert.equal((await read()).economy.coins, 30, "repeated updates cannot settle twice");
    // Non-button body taps must not advance or click through to the board.
    await click({ x: 250, y: 560, w: 40, h: 40 });
    assert.equal((await read()).mode, "level-complete");
    const next = state.uiHitAreas.completion.next;
    await click(next); await click(next);
    state = await read();
    assert.equal(state.levelNo, 13);
    assert.equal(state.mode, "play");
    assert.equal(state.moves, 0, "double tap cannot interact with the next board");
    assert.equal(state.economy.coins, 30);
    await page.waitForTimeout(360);
    await start(11); await clear(); await advance(4000);
    assert.equal((await read()).economy.coins, 60, "a new completed run grants its own reward");
    const home = (await read()).uiHitAreas.completion.home;
    await click(home); await click(home);
    assert.equal((await read()).mode, "home", "double tap cannot immediately start a new game");
    assert.equal((await read()).economy.coins, 60);
    await page.reload({ waitUntil: "networkidle" });
    assert.equal((await read()).economy.coins, 60, "wallet survives reload without a second grant");
    await start(19); await clear(); await advance(4000);
    state = await read();
    assert.equal(state.economy.coins, 90);
    assert.ok(state.completion.isLastLevel);
    await click(state.uiHitAreas.completion.next);
    assert.equal((await read()).mode, "night-complete", "last level retains the existing finale route");

    // Render the component with alternate payloads without awarding test currencies.
    await page.evaluate(async () => {
      window.__completeComponent = await import("/src/complete-dialog.js");
      await window.__completeComponent.loadCompleteArt();
    });
    const preview = rewards => page.evaluate(rewards => {
      const ctx = document.querySelector("#game").getContext("2d");
      ctx.clearRect(0, 0, 540, 960);
      window.__completeComponent.drawCompleteDialog(ctx, { levelNo: 12, title: "甜梦巡游", rewards, isLastLevel: false });
      return window.__completeTrace;
    }, rewards);
    const dual = await preview([{ type: "coins", amount: 50 }, { type: "stars", amount: 2 }]);
    const cards = dual.images.filter(image => image.file.startsWith("ui_reward_card_"));
    assert.equal(cards.length, 2);
    assert.equal(cards.reduce((sum, image) => sum + image.bounds[0] + image.bounds[2] / 2, 0) / 2, 941 / 2);
    assert.ok(cards[0].bounds[0] + cards[0].bounds[2] < cards[1].bounds[0]);
    await shot("two-rewards-component");
    const star = await preview([{ type: "coins", amount: 0 }, { type: "stars", amount: 2 }]);
    const starCard = star.images.filter(image => image.file.startsWith("ui_reward_card_"));
    assert.equal(starCard.length, 1);
    assert.equal(starCard[0].bounds[0] + starCard[0].bounds[2] / 2, 941 / 2);
    await shot("single-star-component");
    const empty = await preview([{ type: "coins", amount: 0 }, { type: "stars", amount: -1 }]);
    assert.ok(!empty.images.some(image => image.file.startsWith("ui_reward_card_")));
    assert.ok(empty.texts.some(text => text.value === "本关已完成"));
    reports.push({ entry, viewport: [width, height], dpr, status: "PASS", singleRewardCentered: true, dualRewardCentered: true, realReward: 30, persistenceAndDeduplication: true, navigation: "home/next/finale/double-tap" });
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL("report.json", output), JSON.stringify({ reports, errors }, null, 2));
  console.log(JSON.stringify(reports));
} finally { await browser.close(); }
