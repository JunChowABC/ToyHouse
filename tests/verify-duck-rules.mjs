import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ART_MANIFEST from "../src/art-manifest.js";

const config = JSON.parse(await readFile(new URL("../docs/design/核心玩法系统/晚安玩具屋_关卡配置_1-20_v1.3.json", import.meta.url), "utf8"));
let source = await readFile(new URL("../src/game.js", import.meta.url), "utf8");
source = source.replace('import LEVEL_CONFIG from "./level-config.js";', "const LEVEL_CONFIG = config;");
source = source.replace('import ART_MANIFEST from "./art-manifest.js";', 'const ART_MANIFEST = artManifest;');
source = source.slice(0, source.indexOf('canvas.addEventListener("pointerup"'));
const sandbox = { config, artManifest: ART_MANIFEST, document: { querySelector: () => ({ getContext: () => ({}) }) } };
vm.createContext(sandbox);
vm.runInContext(source + "\nglobalThis.qa = { findDuckPath, settleDuckWaves, settleAutoExits, buildLevel, state, activateToy, restartLevel, selectToyForRemoval, shuffleDirections, grantReward };", sandbox);
const q = sandbox.qa;
const duck = (id, x, y) => ({ id, x, y, cells: [{ x, y }], state: "IDLE", archetypeId: "AUTO_EXIT" });
const obstacle = (id, cells) => ({ id, cells, state: "IDLE", archetypeId: "ORDINARY" });
const d1 = duck("edge", 0, 4);
assert.equal(q.findDuckPath(d1, [d1]).length, 2, "a duck already on an edge needs only the outward step");
const d2 = duck("corner", 2, 2);
const enclosure = obstacle("walls", [{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 1 }, { x: 2, y: 3 }]);
assert.equal(q.findDuckPath(d2, [d2, enclosure]), null, "diagonal openings do not count");
const leading = duck("lead", 0, 1), following = duck("follow", 1, 1);
const corridor = obstacle("walls", [{ x: 1, y: 0 }, { x: 1, y: 2 }, { x: 2, y: 1 }]);
const waves = [];
assert.equal(q.settleDuckWaves([leading, following, corridor], (toy, path, round) => waves.push([toy.id, round])), 2);
assert.deepEqual(waves, [["lead", 1], ["follow", 2]], "the second duck waits until the preceding wave releases its cell");

// Exercise every available initial SHIFT in the mixed levels. Whenever it opens
// a duck route, the actual click handler must settle all eligible ducks.
let cascadeShifts = 0;
for (let index = 10; index < 20; index += 1) {
  const initial = q.buildLevel(index).toys;
  for (const original of initial.filter((toy) => toy.archetypeId !== "AUTO_EXIT")) {
    q.state.levelIndex = index;
    q.state.mode = "play";
    q.state.audioEnabled = false;
    q.restartLevel();
    const toy = q.state.toys.find((item) => item.id === original.id);
    q.activateToy(toy);
    const moved = toy.x !== original.x || toy.y !== original.y;
    const ducks = q.state.toys.filter((item) => item.archetypeId === "AUTO_EXIT");
    if (moved && ducks.some((item) => item.state !== "IDLE")) cascadeShifts += 1;
    for (const waiting of ducks.filter((item) => item.state === "IDLE")) {
      assert.equal(q.findDuckPath(waiting, q.state.toys), null, "no eligible duck may remain after occupancy changes");
    }
    for (const animation of q.state.exiting.filter((item) => item.path)) {
      const path = animation.path;
      for (let i = 1; i < path.length; i += 1) {
        assert.equal(Math.abs(path[i].x - path[i - 1].x) + Math.abs(path[i].y - path[i - 1].y), 1);
      }
    }
  }
}
assert.ok(cascadeShifts > 0, "mixed source levels exercise SHIFT-triggered automatic exits");
q.state.levelIndex = 15;
q.restartLevel();
const before = JSON.stringify(q.state.toys);
q.grantReward({ id: "duck-test-tools", source: "task", tools: { remove: 1, shuffle: 1 } });
q.selectToyForRemoval(q.state.toys[0]);
q.selectToyForRemoval(q.state.toys[1]);
assert.equal(q.state.toys.filter((toy) => toy.state !== "IDLE").length >= 2, true);
q.restartLevel();
assert.equal(JSON.stringify(q.state.toys), before, "restart restores the exact imported board");
q.shuffleDirections();
assert.equal(q.state.lastToolAction.toyIds.length, 5);
assert.ok(q.state.toys.filter((toy) => toy.archetypeId === "AUTO_EXIT").every((toy) => toy.direction === null));
console.log(`Duck BFS, wave order, restart, tools and ${cascadeShifts} SHIFT-triggered cascades passed`);
