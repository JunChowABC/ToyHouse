import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "../scripts/playwright_system_chrome.mjs";

const out = new URL("../test-output/tool-economy/", import.meta.url);
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [], reports = [];
try {
  for (const [entry, width, height] of [["/", 540, 960], ["/docs/", 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height } });
    page.on("pageerror", e => errors.push(String(e)));
    page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
    const read = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
    const advance = (ms = 1500) => page.evaluate(ms => window.advanceTime(ms), ms);
    const click = async (x, y) => {
      const b = await page.locator("#game").boundingBox();
      await page.mouse.click(b.x + x / 540 * b.width, b.y + y / 960 * b.height);
    };
    const rect = r => click(r.x + r.w / 2, r.y + r.h / 2);
    const open = async id => { await advance(); const s = await read(); await rect(s.uiHitAreas.tools.find(t => t.id === id)); };
    const confirm = async () => rect((await read()).uiHitAreas.toolModal.action);
    const close = async () => rect((await read()).uiHitAreas.toolModal.close);
    const target = async t => { const s = await read(); await click(s.board.x + (t.x + .5) * s.board.cell, s.board.y + (t.y + .5) * s.board.cell); };
    const reward = r => page.evaluate(r => window.__toyhouse_debug.grantReward(r), r);
    const shot = name => page.screenshot({ path: fileURLToPath(new URL(`${width}-${name}.png`, out)) });
    await page.goto(`http://127.0.0.1:4173${entry}`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.__toyhouse_art_ready);
    await page.keyboard.press("Enter");
    let s = await read();
    assert.deepEqual(s.economy.inventory, { remove: 0, shuffle: 0, flip: 0 });
    assert.equal(s.economy.coins, 0);
    await open("remove");
    assert.equal((await read()).toolDialog.action, "buy");
    assert.equal((await read()).toolDialog.disabledReason, "金币不足");
    await shot("insufficient");
    await confirm();
    assert.equal((await read()).economy.coins, 0);
    await close();
    assert.equal(await reward({ id: "first-99", source: "task", coins: 99 }), true);
    assert.equal(await reward({ id: "first-99", source: "task", coins: 99 }), false);
    await open("flip");
    assert.equal((await read()).toolDialog.disabledReason, "金币不足");
    await close();
    await reward({ id: "one-coin", source: "achievement", coins: 1 });
    await open("flip");
    assert.equal((await read()).toolDialog.disabledReason, "");
    await confirm();
    s = await read();
    assert.equal(s.economy.coins, 0);
    assert.equal(s.economy.inventory.flip, 1);
    assert.equal(s.toolMode, "flip");
    assert.equal(s.toolUses.flip, 0, "target tools are charged only on a successful target");
    await page.keyboard.press("Escape");
    assert.equal((await read()).economy.inventory.flip, 1, "cancel preserves the purchased item");
    await reward({ id: "test-budget", source: "task", coins: 1200 });

    for (const id of ["remove", "shuffle", "flip"]) {
      while ((await read()).toolUses[id] < 3) {
        await open(id);
        s = await read();
        const beforeCoins = s.economy.coins, beforeStock = s.economy.inventory[id], used = s.toolUses[id];
        assert.equal(s.toolDialog.action, beforeStock ? "use" : "buy");
        if (!used) await shot(`${id}-${beforeStock ? "use" : "buy"}`);
        // The modal must freeze the combo and prevent clicks through to toys.
        const comboMs = s.comboRemainingMs;
        await advance(3000);
        assert.equal((await read()).comboRemainingMs, comboMs);
        // Exercise the inert dialog body. A board toy may now lie behind the
        // confirm button, where a click legitimately activates the dialog action.
        await click(270, 450);
        assert.equal((await read()).remaining, s.remaining);
        assert.equal((await read()).toolDialog.id, id);
        await confirm();
        s = await read();
        assert.equal(s.economy.coins, beforeCoins - (beforeStock ? 0 : 100));
        if (id !== "shuffle") {
          await click(45, 480);
          assert.equal((await read()).toolUses[id], used);
          await target(s.toys[0]);
          if (id === "remove") {
            assert.equal((await read()).toolUses[id], used);
            await target(s.toys[1]);
          }
        }
        s = await read();
        assert.equal(s.toolUses[id], used + 1);
        assert.equal(s.economy.inventory[id], Math.max(0, beforeStock - 1));
      }
      await reward({ id: `stock-${id}`, source: "rewarded_ad", tools: { [id]: 2 } });
      await open(id);
      s = await read();
      assert.equal(s.toolDialog.disabledReason, "本关使用次数已达上限");
      await shot(`${id}-limit`);
      await confirm();
      assert.deepEqual((await read()).economy, s.economy);
      await close();
    }
    await page.evaluate(() => window.__toyhouse_debug.restartLevel());
    s = await read();
    assert.deepEqual(s.toolUses, { remove: 3, shuffle: 3, flip: 3 });
    const saved = s.economy;
    await page.reload({ waitUntil: "networkidle" });
    await page.keyboard.press("Enter");
    assert.deepEqual((await read()).economy, saved);
    assert.deepEqual((await read()).toolUses, { remove: 3, shuffle: 3, flip: 3 });
    await page.evaluate(() => window.__toyhouse_debug.startLevel(1));
    assert.deepEqual((await read()).toolUses, { remove: 0, shuffle: 0, flip: 0 });
    await open("shuffle");
    await shot("owned-use");
    await confirm();
    s = await read();
    assert.equal(s.economy.coins, saved.coins);
    assert.equal(s.economy.inventory.shuffle, 1);
    await advance();
    await page.evaluate(() => window.__toyhouse_debug.startLevel(15));
    await open("flip"); await confirm();
    s = await read();
    const duck = s.toys.find(t => t.archetype === "AUTO_EXIT");
    await target(duck);
    assert.equal((await read()).toolUses.flip, 0);
    assert.equal((await read()).economy.inventory.flip, 2, "invalid duck target must not consume inventory");
    await page.keyboard.press("Escape");
    reports.push({ entry, width, status: "PASS", checks: "zero stock, 99/100 coins, buy-and-use, owned use, cancellation, caps for all tools, persistence, new level, invalid targets, reward deduplication" });
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(new URL("report.json", out), JSON.stringify({ reports, errors }, null, 2));
  console.log("Tool economy: source and mobile release scenarios passed");
} finally { await browser.close(); }
