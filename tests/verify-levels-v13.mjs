import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "../scripts/playwright_system_chrome.mjs";

const config = JSON.parse(await readFile(new URL("../docs/design/核心玩法系统/晚安玩具屋_关卡配置_1-20_v1.3.json", import.meta.url), "utf8"));
const reference = JSON.parse(await readFile(new URL("../docs/design/核心玩法系统/晚安玩具屋_关卡配置_1-20_v1.3_含验证信息.json", import.meta.url), "utf8"));
const out = new URL("../test-output/levels-v13/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
const errors = [];
page.on("pageerror", (error) => errors.push(String(error)));
page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const reports = [];
try {
  for (const entry of ["/", "/docs/"]) {
    await page.goto(`http://127.0.0.1:4173${entry}`, { waitUntil: "networkidle" });
    const analyses = await page.evaluate(() => window.__toyhouse_debug.levels);
    assert.equal(analyses.length, 20);
    await page.keyboard.press("Enter");
    for (let index = 0; index < 20; index += 1) {
      const expected = config.levels[index];
      const initial = await read();
      assert.equal(initial.level, expected.level_id);
      assert.equal(initial.chapterId, expected.chapter_id);
      assert.equal(initial.remaining, 72);
      assert.equal(initial.hintedToyId, null);
      assert.equal(initial.board.cols, expected.board_width);
      assert.equal(initial.board.rows, expected.board_height);
      const directions = { U: "UP", D: "DOWN", L: "LEFT", R: "RIGHT" };
      const occupied = new Set();
      for (const source of expected.toy_list) {
        const actual = initial.toys.find((toy) => toy.id === source.toy_id);
        assert.ok(actual);
        assert.equal(actual.archetype, source.archetype_id);
        assert.equal(actual.skin, source.skin_id);
        assert.deepEqual([actual.x, actual.y], source.grid_position);
        assert.equal(actual.direction, source.direction === null ? null : directions[source.direction]);
        const cells = [];
        for (let dy = 0; dy < source.footprint[1]; dy += 1) for (let dx = 0; dx < source.footprint[0]; dx += 1) {
          cells.push({ x: source.grid_position[0] + dx, y: source.grid_position[1] + dy });
        }
        assert.deepEqual(actual.cells, cells);
        for (const cell of cells) {
          const key = `${cell.x},${cell.y}`;
          assert.ok(!occupied.has(key)); occupied.add(key);
          assert.ok(cell.x >= 0 && cell.x < 12 && cell.y >= 0 && cell.y < 18);
        }
      }
      const metrics = reference.levels[index].validation;
      assert.equal(analyses[index].analysis.solvable, true);
      assert.equal(analyses[index].analysis.initialExitCount, metrics.initial_manual_exit);
      assert.deepEqual(analyses[index].analysis.layers.map((layer) => layer.length), metrics.layer_curve);
      if (entry === "/" && [0, 10, 15, 19].includes(index)) {
        await page.locator("#game").screenshot({ path: fileURLToPath(new URL(`level-${index + 1}.png`, out)) });
      }
      const duck = initial.toys.find((toy) => toy.archetype === "AUTO_EXIT");
      if (duck) {
        await page.evaluate((id) => { window.__toyhouse_debug.clickToy(id); window.__toyhouse_debug.flipToy(id); }, duck.id);
        assert.deepEqual((await read()).toys, initial.toys, "ducks cannot be manually moved or flipped");
      }
      // Exercise actual pointer hit testing before following the remaining legal exits.
      const target = initial.toys.find((toy) => toy.id === initial.exitReadyToyIds[0]);
      const bounds = await page.locator("#game").boundingBox();
      await page.mouse.click(bounds.x + (initial.board.x + (target.x + 0.5) * initial.board.cell) * bounds.width / 540,
        bounds.y + (initial.board.y + (target.y + 0.5) * initial.board.cell) * bounds.height / 960);
      assert.ok((await read()).remaining < 72);
      const cleared = await page.evaluate(() => {
        const debug = window.__toyhouse_debug;
        for (let step = 0; step < 80; step += 1) {
          const before = JSON.parse(window.render_game_to_text());
          if (!before.remaining) break;
          const id = debug.availableIds()[0];
          if (!id) throw new Error(`No manual exit at ${before.level} with ${before.remaining} remaining`);
          debug.clickToy(id);
          const after = JSON.parse(window.render_game_to_text());
          if (after.remaining >= before.remaining) throw new Error("Legal exit did not advance board");
        }
        window.advanceTime(4000);
        return JSON.parse(window.render_game_to_text());
      });
      assert.equal(cleared.remaining, 0);
      assert.equal(cleared.mode, "level-complete");
      assert.equal(cleared.moves, expected.toy_list.filter((toy) => toy.archetype_id !== "AUTO_EXIT").length);
      assert.equal(cleared.bestCombo, 72, "automatic ducks count as individual valid exits");
      reports.push({ entry, level: expected.level_id, toys: 72, manualMoves: cleared.moves,
        initialExits: metrics.initial_manual_exit, releaseCurve: analyses[index].analysis.layers.map((layer) => layer.length), status: "PASS" });
      await page.keyboard.press("Enter");
      // Completion navigation deliberately ignores rapid repeat input so a
      // double tap cannot hit the newly opened board. Wait before its first tap.
      await page.waitForTimeout(360);
    }
    assert.equal((await read()).completedLevels, 20);
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL("report.json", out), JSON.stringify({ errors, reports }, null, 2));
  console.log("v1.3: exact source matching and complete playthrough passed for 20 levels in both source and published builds");
} finally {
  await browser.close();
}
