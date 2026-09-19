import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "../scripts/playwright_system_chrome.mjs";

const outputDir = new URL("../test-output/pause-menu/", import.meta.url);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(String(error)));

const readState = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const clickCanvas = async (x, y) => {
  const box = await page.locator("#game").boundingBox();
  assert.ok(box);
  await page.mouse.click(box.x + (x / 540) * box.width, box.y + (y / 960) * box.height);
};
const clickAction = async (id) => {
  const rect = (await readState()).uiHitAreas.pauseMenu[id];
  await clickCanvas(rect.x + rect.w / 2, rect.y + rect.h / 2);
};

try {
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => window.__toyhouse_art_ready);
  await page.evaluate(() => window.__toyhouse_debug.startLevel(0));

  const firstExit = await page.evaluate(() => window.__toyhouse_debug.availableIds()[0]);
  await page.evaluate((id) => window.__toyhouse_debug.clickToy(id), firstExit);
  let state = await readState();
  assert.equal(state.combo, 1);

  const pause = state.uiHitAreas.pause;
  await clickCanvas(pause.x + pause.w / 2, pause.y + pause.h / 2);
  state = await readState();
  assert.equal(state.paused, true);
  assert.equal("hint" in state.controls, false);
  assert.equal(state.controls.restart, "pause modal");
  const frozenComboMs = state.comboRemainingMs;

  await page.evaluate(() => window.advanceTime(3000));
  state = await readState();
  assert.equal(state.paused, true);
  assert.ok(Math.abs(state.comboRemainingMs - frozenComboMs) < 50, "pause must freeze the combo countdown");

  await clickAction("audio");
  state = await readState();
  assert.equal(state.settings.audioEnabled, false);
  await page.locator("#game").screenshot({ path: fileURLToPath(new URL("pause-menu.png", outputDir)) });

  await clickAction("resume");
  state = await readState();
  assert.equal(state.paused, false);
  await page.evaluate(() => window.advanceTime(1000));
  state = await readState();
  assert.ok(state.comboRemainingMs < frozenComboMs - 900, "combo countdown must resume after continuing");

  await page.evaluate(() => window.__toyhouse_debug.openPause());
  await clickAction("restart");
  state = await readState();
  assert.equal(state.paused, false);
  assert.equal(state.moves, 0);
  assert.equal(state.combo, 0);
  assert.equal(state.remaining, state.total);

  await page.evaluate(() => window.__toyhouse_debug.openPause());
  await clickAction("exit");
  state = await readState();
  assert.equal(state.mode, "home");
  assert.deepEqual(errors, []);
  console.log("pause menu regression checks passed");
} finally {
  await browser.close();
}
