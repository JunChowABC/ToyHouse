import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "../scripts/playwright_system_chrome.mjs";

const outputDir = new URL("../test-output/impact-combo/", import.meta.url);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
const errors = [];
// Keep simulation time deterministic while screenshots and assertions run.
await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(String(error)));

const readState = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));

try {
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => Boolean(window.__toyhouse_background_ready));
  await page.evaluate(() => window.__toyhouse_background_ready);

  await page.evaluate(() => window.__toyhouse_debug.startLevel(0));
  let state = await readState();
  const blockedToy = state.toys.find((toy) => toy.outcome === "BLOCKED" && toy.blockerId);
  assert.ok(blockedToy);
  await page.evaluate((id) => {
    window.__toyhouse_debug.clickToy(id);
    window.advanceTime(80);
  }, blockedToy.id);
  state = await readState();
  let impactById = Object.fromEntries(state.impactedToys.map((toy) => [toy.id, toy.role]));
  assert.equal(impactById[blockedToy.id], "mover");
  assert.equal(impactById[blockedToy.blockerId], "blocker");
  await page.locator("#game").screenshot({ path: fileURLToPath(new URL("blocked-pair.png", outputDir)) });

  await page.evaluate(() => window.__toyhouse_debug.startLevel(0));
  state = await readState();
  const slidingToy = state.toys.find((toy) => toy.outcome === "STOP_AT_BLOCKER" && toy.blockerId);
  assert.ok(slidingToy);
  await page.evaluate((id) => window.__toyhouse_debug.clickToy(id), slidingToy.id);
  state = await readState();
  assert.deepEqual(state.movingImpacts.map(({ toyId, blockerId }) => ({ toyId, blockerId })), [
    { toyId: slidingToy.id, blockerId: slidingToy.blockerId },
  ]);
  // Impact begins when the slide reaches the blocker, not on pointer down.
  await page.evaluate(ms => window.advanceTime(ms + 1), state.movingImpacts[0].remainingMs);
  state = await readState();
  impactById = Object.fromEntries(state.impactedToys.map((toy) => [toy.id, toy.role]));
  assert.equal(impactById[slidingToy.id], "mover");
  assert.equal(impactById[slidingToy.blockerId], "blocker");
  await page.evaluate(() => window.advanceTime(80));
  await page.locator("#game").screenshot({ path: fileURLToPath(new URL("slide-impact-pair.png", outputDir)) });

  await page.evaluate(() => window.__toyhouse_debug.startLevel(0));
  const firstExit = await page.evaluate(() => window.__toyhouse_debug.availableIds()[0]);
  await page.evaluate((id) => window.__toyhouse_debug.clickToy(id), firstExit);
  state = await readState();
  assert.equal(state.combo, 1);
  assert.ok(state.comboRemainingMs > 7800 && state.comboRemainingMs <= 8000);

  await page.evaluate(() => window.advanceTime(450));
  state = await readState();
  assert.ok(state.exitingToys.some(t => t.id === firstExit && t.remainingMs > 250), "normal exit should still be animated after 450ms");
  await page.evaluate(() => window.__toyhouse_debug.openPause());
  const frozenExit = (await readState()).exitingToys.find(t => t.id === firstExit).remainingMs;
  await page.evaluate(() => window.advanceTime(1200));
  assert.equal((await readState()).exitingToys.find(t => t.id === firstExit).remainingMs, frozenExit);
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.advanceTime(550));
  assert.ok(!(await readState()).exitingToys.some(t => t.id === firstExit), "exit must complete after resuming");

  const comboBlockedToy = state.toys.find((toy) => toy.outcome === "BLOCKED");
  assert.ok(comboBlockedToy);
  await page.evaluate((id) => window.__toyhouse_debug.clickToy(id), comboBlockedToy.id);
  state = await readState();
  assert.equal(state.combo, 1, "blocked clicks must not break a timed combo");

  await page.evaluate(() => window.advanceTime(6000));
  const secondExit = await page.evaluate(() => window.__toyhouse_debug.availableIds()[0]);
  await page.evaluate((id) => window.__toyhouse_debug.clickToy(id), secondExit);
  state = await readState();
  assert.equal(state.combo, 2);
  assert.ok(state.comboRemainingMs > 7800 && state.comboRemainingMs <= 8000);
  await page.locator("#game").screenshot({ path: fileURLToPath(new URL("combo-countdown.png", outputDir)) });

  // advanceTime rounds to 60Hz frames; step clearly beyond the boundary.
  await page.evaluate(() => window.advanceTime(8050));
  state = await readState();
  assert.equal(state.combo, 0);
  assert.equal(state.comboRemainingMs, 0);
  assert.deepEqual(errors, []);
  console.log("impact + combo regression checks passed");
} finally {
  await browser.close();
}
