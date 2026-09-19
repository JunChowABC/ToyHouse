import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "../scripts/playwright_system_chrome.mjs";

const outputDir = new URL("../test-output/first-night-toy-set/", import.meta.url);
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
page.on("pageerror", (error) => errors.push(String(error)));

try {
  await page.goto("http://127.0.0.1:4173", { waitUntil: "domcontentloaded" });
  const levelAnalyses = await page.evaluate(() => window.__toyhouse_debug.levels);
  assert.equal(levelAnalyses.length, 20);
  assert.ok(levelAnalyses.every((level) => level.analysis.solvable));

  for (let levelIndex = 0; levelIndex < 10; levelIndex += 1) {
    const state = await page.evaluate((index) => {
      window.__toyhouse_debug.startLevel(index);
      return JSON.parse(window.render_game_to_text());
    }, levelIndex);
    assert.deepEqual(state.levelToySet, { archetypes: ["ORDINARY"], skins: ["rabbit"] });
    assert.ok(state.toys.every((toy) => toy.archetype === "ORDINARY"));
    assert.ok(state.toys.every((toy) => toy.skin === "rabbit"));
    assert.ok(state.toys.every((toy) => toy.type === "兔子"));
    assert.ok(state.toys.every((toy) => toy.length === 2 && toy.size === "1×2"));
    assert.equal(state.total, 72);
    assert.ok(state.toys.every((toy) => toy.cells.every((cell) => cell.x >= 0 && cell.x < 12 && cell.y >= 0 && cell.y < 18)));
    assert.deepEqual([...new Set(state.toys.map((toy) => toy.direction))].sort(), ["DOWN", "LEFT", "RIGHT", "UP"]);
  }

  await page.evaluate(() => window.__toyhouse_debug.startLevel(0));
  await page.locator("#game").screenshot({ path: fileURLToPath(new URL("rabbit-only-level.png", outputDir)) });
  assert.deepEqual(errors, []);
  console.log("first-night rabbit-only checks passed");
} finally {
  await browser.close();
}
