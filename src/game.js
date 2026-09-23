import { loadImage, imageLoadStatus } from "./image-loader.js";
import LEVEL_CONFIG from "./level-config.js";
import ART_MANIFEST from "./art-manifest.js";
import { PAUSE_UI, TOOL_MODAL_UI, HOME_SETTINGS_UI, loadPauseArt, drawPauseDialog, drawToolDialog, drawHomeSettings, pauseArtStatus } from "./pause-dialog.js";
import { COMPLETE_UI, loadCompleteArt, drawCompleteDialog, completeArtStatus, completionRewardLayout } from "./complete-dialog.js";
import { HOME_UI, loadHomeArt, drawHomeScreen, homeArtStatus } from "./home-screen.js";

const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const W = 540;
const H = 960;
const BOARD = { x: 60, y: 199, cols: 12, rows: 18, cell: 35 };
const TOY_ART_CELL = 34; // Artwork size stays independent of the 1px wider grid spacing.
const TOY_VISUAL_GAP = 3;
const TOY_DISPLAY_SCALE = 1.44;
const EXIT_DURATION_MS = 900;
const COMBO_WINDOW_MS = 8000;
const IMPACT_DURATION_MS = 460;
const TOOL_LIMIT = 3;
const TOOL_PRICE = 100;
const LEVEL_CLEAR_COINS = 30;
const SAVE_KEY = "toyhouse-economy-v1";
const TOOL_IDS = ["remove", "shuffle", "flip"];
const EMPTY_TOOLS = () => ({ remove: 0, shuffle: 0, flip: 0 });
const TOOL_DESCRIPTIONS = {
  remove: ["选择 2 只玩具，", "直接将它们移出玩具屋。"],
  shuffle: ["随机选中5个玩具，", "重新调整它们的方向"],
  flip: ["选择一个玩具，", "反转它的方向"],
};

function loadProfile() {
  const fresh = { coins: 0, inventory: EMPTY_TOOLS(), levelUses: {}, rewardIds: [], completedLevels: [] };
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!saved || !Number.isSafeInteger(saved.coins) || saved.coins < 0) return fresh;
    fresh.coins = saved.coins;
    for (const id of TOOL_IDS) if (Number.isSafeInteger(saved.inventory?.[id]) && saved.inventory[id] >= 0) fresh.inventory[id] = saved.inventory[id];
    for (const [level, uses] of Object.entries(saved.levelUses || {})) {
      if (!/^L\d{3}$/.test(level)) continue;
      fresh.levelUses[level] = EMPTY_TOOLS();
      for (const id of TOOL_IDS) fresh.levelUses[level][id] = Number.isInteger(uses?.[id]) ? Math.max(0, Math.min(TOOL_LIMIT, uses[id])) : 0;
    }
    fresh.rewardIds = Array.isArray(saved.rewardIds) ? saved.rewardIds.filter(id => typeof id === "string") : [];
    fresh.completedLevels = Array.isArray(saved.completedLevels) ? saved.completedLevels.filter(id => /^L\d{3}$/.test(id)) : [];
  } catch { /* New or invalid local save starts with an empty inventory. */ }
  return fresh;
}

const profile = loadProfile();

function persistProfile() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(profile)); } catch { /* In-memory play remains available when storage is blocked. */ }
}

// Future task/achievement/ad completion adapters call this only after success.
// Stable reward IDs make repeated callbacks idempotent; no reward is auto-granted.
function grantReward({ id, source, coins = 0, tools = {} }) {
  if (typeof id !== "string" || !id || !["task", "achievement", "rewarded_ad"].includes(source)
    || !Number.isSafeInteger(coins) || coins < 0 || !Number.isSafeInteger(profile.coins + coins)) return false;
  if (!tools || typeof tools !== "object" || Object.keys(tools).some(key => !TOOL_IDS.includes(key))) return false;
  for (const key of TOOL_IDS) if (!Number.isSafeInteger(tools[key] ?? 0) || (tools[key] ?? 0) < 0 || !Number.isSafeInteger(profile.inventory[key] + (tools[key] ?? 0))) return false;
  const receipt = `${source}:${id}`;
  if (profile.rewardIds.includes(receipt)) return false;
  profile.coins += coins;
  for (const key of TOOL_IDS) profile.inventory[key] += tools[key] ?? 0;
  profile.rewardIds.push(receipt);
  persistProfile();
  return true;
}
const DIR = {
  LEFT: { x: -1, y: 0, marker: "<" },
  RIGHT: { x: 1, y: 0, marker: ">" },
  UP: { x: 0, y: -1, marker: "^" },
  DOWN: { x: 0, y: 1, marker: "v" },
};
const OPPOSITE_DIRECTION = { LEFT: "RIGHT", RIGHT: "LEFT", UP: "DOWN", DOWN: "UP" };
const TOY_ARCHETYPES = Object.freeze({
  ORDINARY: { name: "兔子", footprint: 2, skinId: "rabbit_default", paletteIndex: 1, exitMode: "MANUAL_STRAIGHT" },
  AUTO_EXIT: { name: "小鸭", footprint: 1, skinId: "duck_default", paletteIndex: 2, exitMode: "AUTO_PATH" },
  LARGE: { name: "大鲸鱼", footprint: 3, skinId: "whale_default", paletteIndex: 6, exitMode: "MANUAL_STRAIGHT" },
});
const CONFIG_DIRECTIONS = { U: "UP", D: "DOWN", L: "LEFT", R: "RIGHT" };
const PALETTES = [
  ["#d88b73", "#fff2d9", "#7d4d47"],
  ["#e8a3bd", "#fff0f5", "#8b536c"],
  ["#efbd58", "#fff0b7", "#8c6631"],
  ["#82b9ca", "#e9fbff", "#3e7181"],
  ["#79b990", "#e8f6df", "#426f50"],
  ["#9dbd84", "#eef6d8", "#587141"],
  ["#8fa9cf", "#edf3ff", "#4d6486"],
];
const TOOL_BUTTONS = [
  { id: "remove", x: 137, y: 847, w: 83, h: 88, slot: "01", icon: "icon_trash_01_instance_01", label: "消除", detail: "选2只" },
  { id: "shuffle", x: 228, y: 847, w: 83, h: 88, slot: "02", icon: "icon_shuffle_01_instance_01", label: "洗牌", detail: "随机5只" },
  { id: "flip", x: 318, y: 847, w: 83, h: 88, slot: "03", icon: "icon_flip_01_instance_01", label: "翻转", detail: "选1只" },
];
// The V3 left navigation tab opens the existing pause/navigation menu.
const PAUSE_BUTTON = { x: 0, y: 22, w: 65, h: 51 };
const SETTINGS_KEY = "toyhouse-settings-v1";
function loadSettings() {
  const settings = { musicEnabled: true, audioEnabled: true, vibrationEnabled: false };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    for (const key of Object.keys(settings)) if (typeof saved?.[key] === "boolean") settings[key] = saved[key];
  } catch { /* Keep usable defaults if browser storage is unavailable. */ }
  return settings;
}

// Keep the source IDs, names, chapter grouping and every footprint unchanged.
const LEVEL_SPECS = LEVEL_CONFIG.levels.map((level) => ({
  id: level.level_id, levelNo: level.level_no, chapterId: level.chapter_id,
  title: level.display_title || level.level_name, count: level.toy_list.length,
  boardWidth: level.board_width, boardHeight: level.board_height,
  difficulty: level.difficulty, cascadeStrength: level.cascade_strength,
}));

const state = {
  mode: "home",
  levelIndex: 0,
  toys: [],
  initialToys: [],
  exiting: [],
  moving: [],
  effects: [],
  combo: 0,
  comboExpiresAt: 0,
  bestCombo: 0,
  moves: 0,
  blockedCount: 0,
  hintedId: null,
  hintUntil: 0,
  time: 0,
  levelCompleteAt: 0,
  levelRunId: null,
  completionRewards: [],
  navigationUntil: 0,
  ...loadSettings(),
  pauseOpen: false,
  toolModal: null,
  toolMode: null,
  toolSelection: [],
  toolUses: { remove: 0, shuffle: 0, flip: 0 },
  lastToolAction: null,
  directionFxIds: [],
  directionFxUntil: 0,
  shuffleSerial: 0,
};

function toolUnavailable(id) {
  if (state.toolUses[id] >= TOOL_LIMIT) return "本关使用次数已达上限";
  const idle = state.toys.filter(t => t.state === "IDLE" && !isToyMoving(t.id));
  if (!(id === "remove" ? idle.length : idle.some(t => t.archetypeId !== "AUTO_EXIT"))) return "当前没有可使用的目标";
  if (profile.inventory[id] === 0 && profile.coins < TOOL_PRICE) return "金币不足";
  return "";
}

function openToolModal(id) {
  if (!TOOL_IDS.includes(id) || state.mode !== "play" || state.pauseOpen || state.levelCompleteAt || state.moving.length || state.exiting.length) return;
  cancelToolMode();
  state.toolModal = id;
  render();
}

function confirmTool() {
  const id = state.toolModal;
  if (!id || toolUnavailable(id)) return;
  if (profile.inventory[id] === 0) {
    profile.coins -= TOOL_PRICE;
    profile.inventory[id] += 1;
    persistProfile();
  }
  state.toolModal = null;
  if (id === "shuffle") shuffleDirections();
  else setToolMode(id);
  render();
}

function consumeTool(id) {
  if (state.mode !== "play" || state.pauseOpen || state.toolModal || state.levelCompleteAt || state.toolUses[id] >= TOOL_LIMIT || profile.inventory[id] < 1) return false;
  profile.inventory[id] -= 1;
  state.toolUses[id] += 1;
  profile.levelUses[LEVEL_SPECS[state.levelIndex].id] = { ...state.toolUses };
  persistProfile();
  return true;
}

// UI coordinates are read from the actual PSD, whose final edits differ from
// the accompanying draft manifest. Gameplay still uses the original 12x18 grid.
const artImages = new Map();
let artReady = false;
let artError = "";
const ART_SCALE = Math.min(W / ART_MANIFEST.canvas[0], H / ART_MANIFEST.canvas[1]);
const ART_OFFSET_Y = (H - ART_MANIFEST.canvas[1] * ART_SCALE) / 2;
const UI_FONT = 'SimHei, "Microsoft YaHei UI", "PingFang SC", sans-serif';
const RUG_RECT = { x: 3, y: 171, w: 534, h: 534 * ART_MANIFEST.assets.ui_playmat_base_01.size[1] / ART_MANIFEST.assets.ui_playmat_base_01.size[0] };
const RABBIT_ANGLE = Object.freeze({ UP: 0, RIGHT: Math.PI / 2, DOWN: Math.PI, LEFT: -Math.PI / 2 });
const HUD_LAYERS = Object.keys(ART_MANIFEST.assets).filter(id => ART_MANIFEST.assets[id].group === "04_TITLE");
const CURRENCY_LAYERS = Object.keys(ART_MANIFEST.assets).filter(id => ART_MANIFEST.assets[id].group === "06_RESOURCES");

function artRect(id) {
  const [left, top, right, bottom] = ART_MANIFEST.assets[id].bounds;
  return { x: left * ART_SCALE, y: top * ART_SCALE + ART_OFFSET_Y, w: (right - left) * ART_SCALE, h: (bottom - top) * ART_SCALE };
}

function drawArt(id, rect = artRect(id)) {
  const image = artImages.get(id);
  if (!image) return;
  ctx.save();
  ctx.globalAlpha *= ART_MANIFEST.assets[id].opacity;
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function fitArt(id, rect, flip = false, angle = 0) {
  const image = artImages.get(id);
  if (!image) return;
  ctx.save();
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.rotate(angle);
  if (flip) ctx.scale(-1, 1);
  const rotated = Math.abs(Math.sin(angle)) > 0.5;
  const scale = Math.min((rotated ? rect.h : rect.w) / image.width, (rotated ? rect.w : rect.h) / image.height);
  ctx.drawImage(image, -image.width * scale / 2, -image.height * scale / 2, image.width * scale, image.height * scale);
  ctx.restore();
}

function artText(text, x, y, size, color = "#8b5e4d", maxWidth, weight = 400, outline = null) {
  ctx.save();
  ctx.font = `${weight} ${size}px ${UI_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  if (outline) {
    ctx.strokeStyle = outline;
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    if (maxWidth) ctx.strokeText(String(text), x, y, maxWidth);
    else ctx.strokeText(String(text), x, y);
  }
  if (maxWidth) ctx.fillText(String(text), x, y, maxWidth);
  else ctx.fillText(String(text), x, y);
  ctx.restore();
}

function drawCurrencyHud(showAcquisition = true) {
  CURRENCY_LAYERS.forEach(id => drawArt(id));
  artText("0", 490, 54, 17);
  artText(profile.coins, 490, 90, 16, "#8b5e4d", 38);
  // Existing star economy and acquisition entries are not wired up yet.
  if (showAcquisition) {
    artText("+", 520, 53, 21, "#cfb0a3");
    artText("+", 520, 90, 21, "#cfb0a3");
  }
}

function drawArtHud(spec) {
  HUD_LAYERS.forEach(id => {
    const rect = artRect(id);
    if (id === "ui_title_rabbit_01_instance_01") rect.y += 9;
    drawArt(id, rect);
  });
  // Keep the two PSD text positions, but use real level/economy state.
  artText(`第${String(spec.levelNo).padStart(2, "0")}关`, 269, 74, 15, "#b47850", 100, 700);
  artText(spec.title, 270, 97, 21, "#b47850", 172, 700);
  drawCurrencyHud();
  drawPauseButton();
  if (state.combo <= 0) return;
  drawArt("ui_combo_panel_base_01_instance_01");
  drawArt("ui_combo_panel_region_bar_01_instance_01");
  const fill = artRect("ui_combo_bar_fill_01_instance_01");
  ctx.save();
  ctx.beginPath();
  ctx.rect(fill.x, fill.y, fill.w * comboRemainingMs() / COMBO_WINDOW_MS, fill.h);
  ctx.clip();
  drawArt("ui_combo_bar_fill_01_instance_01");
  ctx.restore();
  drawArt("ui_combo_star_01_instance_01");
  artText("COMBO", 260, 145, 13, "#956a4f", undefined, 700, "#ffffff");
  artText(state.combo, 298, 142, 23, "#63345f", 28, 700, "#fff5df");
}

function drawArtRug() {
  drawArt("ui_playmat_base_01", RUG_RECT);
}

const systemAssets = {
  play: { ready: false, promise: null },
  settings: { ready: false, promise: null },
  complete: { ready: false, promise: null },
};
let pendingLoad = null;
const LOAD_UI = { retry: { x: 170, y: 520, w: 200, h: 52 }, cancel: { x: 170, y: 586, w: 200, h: 46 } };
async function loadCoreAssets(ids) {
  await Promise.all(ids.map(async id => {
    const asset = ART_MANIFEST.assets[id];
    const image = await loadImage(`${ART_MANIFEST.directory}/${asset.file}`);
    artImages.set(id, image);
  }));
}
function ensureSystem(key) {
  const group = systemAssets[key];
  if (group.ready) return Promise.resolve(true);
  if (group.promise) return group.promise;
  const load = key === "play" ? () => loadCoreAssets(Object.keys(ART_MANIFEST.assets).filter(id => !CURRENCY_LAYERS.includes(id)))
    : key === "settings" ? loadPauseArt : loadCompleteArt;
  group.promise = load().then(() => { group.ready = true; return true; })
    .catch(() => false).finally(() => { group.promise = null; });
  return group.promise;
}
function requestSystems(keys, action) {
  if (keys.every(key => systemAssets[key].ready)) { action(); return; }
  const request = pendingLoad = { keys, action, error: false };
  Promise.all(keys.map(ensureSystem)).then(results => {
    if (pendingLoad !== request) return;
    if (results.every(Boolean)) { pendingLoad = null; action(); }
    else request.error = true;
    render();
  });
}
let homeRecoveryTimer = null;
function homeAssetsComplete() {
  return homeArtStatus().loaded === homeArtStatus().expected && CURRENCY_LAYERS.every(id => artImages.has(id));
}
function recoverHomeAssets() {
  clearTimeout(homeRecoveryTimer);
  if (homeAssetsComplete()) return;
  Promise.allSettled([loadHomeArt(), loadCoreAssets(CURRENCY_LAYERS)]).then(() => {
    render();
    if (!homeAssetsComplete()) homeRecoveryTimer = setTimeout(recoverHomeAssets, 10000);
  });
}
function loadArt() {
  artError = "";
  return new Promise(resolve => {
    let opened = false;
    const start = performance.now();
    const openHome = () => {
      if (opened) return;
      opened = true;
      clearInterval(progressCheck);
      artReady = true;
      render();
      resolve(true);
      setTimeout(() => {
        window.__toyhouse_background_ready = Promise.all([ensureSystem("play"), ensureSystem("settings"), ensureSystem("complete")]);
      }, 0);
    };
    // A slow decoration or background must not indefinitely block the whole room.
    const progressCheck = setInterval(() => {
      if (performance.now() - start >= 8000 && homeArtStatus().loaded >= homeArtStatus().expected - 1) openHome();
    }, 250);
    Promise.allSettled([loadHomeArt(), loadCoreAssets(CURRENCY_LAYERS)]).then(results => {
      if (results.every(result => result.status === "fulfilled") || homeArtStatus().loaded >= homeArtStatus().expected - 1) openHome();
      else if (!opened) {
        clearInterval(progressCheck);
        artError = "部分图片暂时无法加载";
        render();
        resolve(false);
      }
      if (opened && !homeAssetsComplete()) recoverHomeAssets();
    });
  });
}

function drawPendingLoad() {
  ctx.fillStyle = "rgba(70,40,65,.55)";
  ctx.fillRect(0, 0, W, H);
  fillRoundRect(90, 385, 360, 260, 24, "#fff1eb");
  artText(pendingLoad.error ? "图片加载未完成" : "正在准备，请稍候…", 270, 440, 22);
  const progress = imageLoadStatus();
  artText(`图片 ${progress.loaded} / ${progress.total}`, 270, 482, 16);
  if (pendingLoad.error) paintControl("loading.retry", LOAD_UI.retry, () => {
    fillRoundRect(170, 520, 200, 52, 20, "#f5b8cd");
    artText("重试", 270, 546, 20);
  });
  paintControl("loading.cancel", LOAD_UI.cancel, () => {
    fillRoundRect(170, 586, 200, 46, 20, "#eadcec");
    artText("返回", 270, 609, 18);
  });
}

function buildLevel(index) {
  const config = LEVEL_CONFIG.levels[index];
  if (!config) throw new Error(`Unknown level index: ${index}`);
  const spec = LEVEL_SPECS[index];
  if (config.board_width !== BOARD.cols || config.board_height !== BOARD.rows) {
    throw new Error(`${spec.id}: unsupported board dimensions`);
  }
  const occupied = new Set();
  const ids = new Set();
  const toys = config.toy_list.map((entry, i) => {
    const archetype = TOY_ARCHETYPES[entry.archetype_id];
    const [width, height] = entry.footprint;
    const [x, y] = entry.grid_position;
    const direction = entry.direction === null ? null : CONFIG_DIRECTIONS[entry.direction];
    const auto = entry.archetype_id === "AUTO_EXIT";
    if (!archetype || ids.has(entry.toy_id) || width * height !== archetype.footprint
      || (auto ? direction !== null : !direction)
      || (!auto && ((direction === "LEFT" || direction === "RIGHT") ? height !== 1 : width !== 1))
      || config.archetype_skin_map[entry.archetype_id] !== entry.skin_id) {
      throw new Error(`${spec.id}: invalid toy ${entry.toy_id}`);
    }
    ids.add(entry.toy_id);
    const cells = [];
    for (let dy = 0; dy < height; dy += 1) for (let dx = 0; dx < width; dx += 1) {
      const cell = { x: x + dx, y: y + dy };
      const key = cellKey(cell.x, cell.y);
      if (!Number.isInteger(cell.x) || !Number.isInteger(cell.y) || cell.x < 0 || cell.y < 0
        || cell.x >= BOARD.cols || cell.y >= BOARD.rows || occupied.has(key)) {
        throw new Error(`${spec.id}: overlap or out-of-bounds cell ${key}`);
      }
      occupied.add(key);
      cells.push(cell);
    }
    return {
      id: entry.toy_id, numericId: i + 1, archetypeId: entry.archetype_id,
      skinId: entry.skin_id, exitMode: archetype.exitMode, toyType: archetype.name,
      typeIndex: archetype.paletteIndex, variant: i % 5, length: cells.length,
      sizeType: auto ? "1×1" : entry.archetype_id === "LARGE" ? "1×3" : "1×2",
      direction, x, y, cells, state: "IDLE", blockedAt: -9999,
      impactDx: 0, impactDy: 0, impactRole: null,
    };
  });
  const analysis = analyzeLevel(toys);
  if (!analysis.solvable) throw new Error(`${spec.id} is not solvable`);
  return { spec, toys, analysis };
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function occupancyFor(toys) {
  const occupied = new Map();
  toys.forEach((toy) => toy.cells.forEach((cell) => occupied.set(cellKey(cell.x, cell.y), toy.id)));
  return occupied;
}

// BFS uses four-neighbour empty cells. Other ducks remain obstacles until their
// whole wave is chosen, so a newly opened gap is evaluated in the next wave.
function findDuckPath(toy, toys) {
  const occupied = occupancyFor(toys.filter((item) => item.state === "IDLE" && item.id !== toy.id));
  const queue = [{ x: toy.x, y: toy.y, parent: -1 }];
  const seen = new Set([cellKey(toy.x, toy.y)]);
  for (let i = 0; i < queue.length; i += 1) {
    const cell = queue[i];
    if (cell.x === 0 || cell.y === 0 || cell.x === BOARD.cols - 1 || cell.y === BOARD.rows - 1) {
      const path = [];
      for (let j = i; j !== -1; j = queue[j].parent) path.unshift({ x: queue[j].x, y: queue[j].y });
      const dx = cell.x === 0 ? -1 : cell.x === BOARD.cols - 1 ? 1 : 0;
      const dy = dx ? 0 : cell.y === 0 ? -1 : 1;
      path.push({ x: cell.x + dx, y: cell.y + dy });
      return path;
    }
    for (const { x: dx, y: dy } of Object.values(DIR)) {
      const x = cell.x + dx, y = cell.y + dy, key = cellKey(x, y);
      if (x < 0 || y < 0 || x >= BOARD.cols || y >= BOARD.rows || seen.has(key) || occupied.has(key)) continue;
      seen.add(key);
      queue.push({ x, y, parent: i });
    }
  }
  return null;
}

function settleDuckWaves(toys, onExit = () => {}) {
  let round = 0;
  while (true) {
    const wave = toys.filter((toy) => toy.state === "IDLE" && toy.archetypeId === "AUTO_EXIT")
      .map((toy) => ({ toy, path: findDuckPath(toy, toys) })).filter((item) => item.path);
    if (!wave.length) return round;
    round += 1;
    wave.forEach(({ toy }) => { toy.state = "EXITING"; });
    wave.forEach(({ toy, path }) => onExit(toy, path, round));
  }
}

function settleAutoExits() {
  // All logical waves finish synchronously within the current input event;
  // subsequent input is allowed while the already resolved animations run.
  settleDuckWaves(state.toys, (toy, path) => {
    state.combo = state.combo > 0 && state.time < state.comboExpiresAt ? state.combo + 1 : 1;
    state.comboExpiresAt = state.time + COMBO_WINDOW_MS;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.exiting.push({ toy: cloneToy(toy), path, elapsed: 0, duration: Math.max(500, (path.length - 1) * 110), kind: "auto" });
    const center = toyCenter(toy);
    burst(center.x, center.y, 7, "#ffe49b");
  });
  checkLevelCleared();
}

function headCell(toy) {
  const d = DIR[toy.direction];
  return toy.cells.reduce((best, cell) => {
    if (!best) return cell;
    return cell.x * d.x + cell.y * d.y > best.x * d.x + best.y * d.y ? cell : best;
  }, null);
}

function scanForward(toy, toys = state.toys) {
  if (toy.state !== "IDLE") return { emptySteps: 0, exitsBoard: false, blockerId: null };
  if (toy.archetypeId === "AUTO_EXIT") return { emptySteps: 0, exitsBoard: !!findDuckPath(toy, toys), blockerId: null };
  const occupied = occupancyFor(toys.filter((item) => item.state === "IDLE"));
  const d = DIR[toy.direction];
  const head = headCell(toy);
  let x = head.x + d.x;
  let y = head.y + d.y;
  let emptySteps = 0;
  while (x >= 0 && x < BOARD.cols && y >= 0 && y < BOARD.rows) {
    if (occupied.has(cellKey(x, y))) {
      return { emptySteps, exitsBoard: false, blockerId: occupied.get(cellKey(x, y)) };
    }
    emptySteps += 1;
    x += d.x;
    y += d.y;
  }
  return { emptySteps, exitsBoard: true, blockerId: null };
}

function canExit(toy, toys = state.toys) {
  return scanForward(toy, toys).exitsBoard;
}

function canMove(toy, toys = state.toys) {
  const scan = scanForward(toy, toys);
  return scan.exitsBoard || scan.emptySteps > 0;
}

function availableToys(toys = state.toys) {
  return toys.filter((toy) => toy.state === "IDLE" && toy.archetypeId !== "AUTO_EXIT" && canExit(toy, toys));
}

function movableToys(toys = state.toys) {
  return toys.filter((toy) => toy.state === "IDLE" && toy.archetypeId !== "AUTO_EXIT" && canMove(toy, toys));
}

function analyzeLevel(sourceToys) {
  const working = sourceToys.map((toy) => ({ ...toy, cells: toy.cells.map((cell) => ({ ...cell })) }));
  const layers = [];
  while (working.length) {
    settleDuckWaves(working);
    const exits = availableToys(working);
    if (!exits.length) break;
    layers.push(exits.map((toy) => toy.id));
    const exitIds = new Set(exits.map((toy) => toy.id));
    for (let i = working.length - 1; i >= 0; i -= 1) {
      if (exitIds.has(working[i].id)) working.splice(i, 1);
    }
  }
  const occupiedCells = sourceToys.reduce((sum, toy) => sum + toy.length, 0);
  return {
    solvable: working.every((toy) => toy.state !== "IDLE"),
    layers,
    releaseDepth: layers.length,
    initialExitCount: layers[0]?.length ?? 0,
    occupancy: Math.round((occupiedCells / (BOARD.cols * BOARD.rows)) * 100),
    maxCascade: Math.max(...layers.map((layer) => layer.length)),
  };
}

function cloneToy(toy) {
  return {
    ...toy,
    cells: toy.cells.map((cell) => ({ ...cell })),
    state: "IDLE",
    blockedAt: -9999,
    impactDx: 0,
    impactDy: 0,
    impactRole: null,
  };
}

function beginLevelRun(index) {
  state.levelRunId = `${LEVEL_SPECS[index].id}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  state.completionRewards = [];
}

function settleCompletionReward() {
  const receipt = `level_clear:${state.levelRunId}`;
  if (!profile.rewardIds.includes(receipt)) {
    if (!Number.isSafeInteger(profile.coins + LEVEL_CLEAR_COINS)) return [];
    profile.coins += LEVEL_CLEAR_COINS;
    profile.rewardIds.push(receipt);
    const levelId = LEVEL_SPECS[state.levelIndex].id;
    if (!profile.completedLevels.includes(levelId)) profile.completedLevels.push(levelId);
    // Store the result and wallet together, before showing the dialog.
    persistProfile();
  }
  return [{ type: "coins", amount: LEVEL_CLEAR_COINS }];
}

function startLevel(index = state.levelIndex) {
  const level = buildLevel(index);
  beginLevelRun(index);
  state.mode = "play";
  state.pauseOpen = false;
  state.toolModal = null;
  state.levelIndex = index;
  state.initialToys = level.toys.map(cloneToy);
  state.toys = level.toys.map(cloneToy);
  state.exiting = [];
  state.moving = [];
  state.effects = [];
  state.combo = 0;
  state.comboExpiresAt = 0;
  state.bestCombo = 0;
  state.moves = 0;
  state.blockedCount = 0;
  state.hintedId = null;
  state.hintUntil = 0;
  state.levelCompleteAt = 0;
  state.toolMode = null;
  state.toolSelection = [];
  state.toolUses = { ...EMPTY_TOOLS(), ...profile.levelUses[LEVEL_SPECS[index].id] };
  state.lastToolAction = null;
  state.directionFxIds = [];
  timers.length = 0;
  settleAutoExits();
  tone(392, 0.08, 0.025);
  render();
}

function restartLevel() {
  state.toolModal = null;
  beginLevelRun(state.levelIndex);
  const level = buildLevel(state.levelIndex);
  state.toys = level.toys.map(cloneToy);
  state.initialToys = level.toys.map(cloneToy);
  state.exiting = [];
  state.moving = [];
  state.effects = [];
  state.combo = 0;
  state.comboExpiresAt = 0;
  state.bestCombo = 0;
  state.moves = 0;
  state.blockedCount = 0;
  state.hintedId = null;
  state.levelCompleteAt = 0;
  state.toolMode = null;
  state.toolSelection = [];
  state.lastToolAction = null;
  state.directionFxIds = [];
  state.pauseOpen = false;
  timers.length = 0;
  settleAutoExits();
  tone(330, 0.08, 0.02);
}

const timers = [];
function setTimeoutSafe(callback, delay) {
  timers.push({ at: state.time + delay, callback });
}

function hint() {
  if (state.mode !== "play" || state.levelCompleteAt) return;
  const exits = availableToys();
  const candidates = exits.length ? exits : movableToys();
  if (!candidates.length) return;
  const target = candidates[Math.floor((state.moves + state.levelIndex) % candidates.length)];
  state.hintedId = target.id;
  state.hintUntil = state.time + 2600;
  tone(659, 0.12, 0.025);
}

function toyAtGrid(x, y) {
  return state.toys.find((toy) => toy.state === "IDLE" && toy.cells.some((cell) => cell.x === x && cell.y === y));
}

function activateToy(toy) {
  if (state.toolModal) return;
  if (!toy || toy.archetypeId === "AUTO_EXIT" || state.pauseOpen || state.mode !== "play" || toy.state !== "IDLE" || state.levelCompleteAt || isToyMoving(toy.id)) return;
  state.moves += 1;
  const scan = scanForward(toy);
  if (!scan.exitsBoard && scan.emptySteps === 0) {
    triggerImpact(toy, scan.blockerId, DIR[toy.direction]);
    state.blockedCount += 1;
    state.hintedId = null;
    return;
  }

  if (!scan.exitsBoard) {
    slideToyToBlocker(toy, scan.emptySteps);
    return;
  }

  const before = new Set(availableToys().map((item) => item.id));
  toy.state = "EXITING";
  state.combo = state.combo > 0 && state.time < state.comboExpiresAt ? state.combo + 1 : 1;
  state.comboExpiresAt = state.time + COMBO_WINDOW_MS;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  state.hintedId = null;
  const d = DIR[toy.direction];
  state.exiting.push({ toy: cloneToy(toy), elapsed: 0, duration: EXIT_DURATION_MS, dx: d.x, dy: d.y, kind: "exit" });
  const remaining = state.toys.filter((item) => item.state === "IDLE");
  const after = availableToys(remaining);
  const newlyOpened = after.filter((item) => !before.has(item.id)).length;
  const center = toyCenter(toy);
  burst(center.x, center.y, newlyOpened >= 3 ? 16 : 7, newlyOpened >= 3 ? "#ffd86b" : "#fff3c7");
  if (newlyOpened >= 3) {
    tone(784, 0.1, 0.035);
  } else {
    tone(440 + Math.min(state.combo, 12) * 24, 0.065, 0.025);
  }
  settleAutoExits();

}

function isToyMoving(id) {
  return state.moving.some((motion) => motion.id === id);
}

function slideToyToBlocker(toy, steps) {
  const scan = scanForward(toy);
  const d = DIR[toy.direction];
  toy.cells = toy.cells.map((cell) => ({ x: cell.x + d.x * steps, y: cell.y + d.y * steps }));
  toy.x = Math.min(...toy.cells.map((cell) => cell.x));
  toy.y = Math.min(...toy.cells.map((cell) => cell.y));
  state.moving.push({
    id: toy.id,
    elapsed: 0,
    duration: Math.min(480, 190 + steps * 42),
    fromX: -d.x * steps * BOARD.cell,
    fromY: -d.y * steps * BOARD.cell,
    steps,
    blockerId: scan.blockerId,
  });
  triggerImpact(toy, scan.blockerId, d);
  settleAutoExits();
  state.hintedId = null;
  const center = toyCenter(toy);
  burst(center.x, center.y, 5, "#dff6e5");
  tone(330 + Math.min(steps, 8) * 16, 0.08, 0.02);
}

function triggerImpact(movingToy, blockerId, direction) {
  if (!movingToy) return;
  const blocker = state.toys.find((toy) => toy.id === blockerId && toy.state === "IDLE");
  const impactToy = (toy, dx, dy, role) => {
    toy.blockedAt = state.time;
    toy.impactDx = dx;
    toy.impactDy = dy;
    toy.impactRole = role;
  };
  impactToy(movingToy, -direction.x, -direction.y, "mover");
  if (blocker) impactToy(blocker, direction.x, direction.y, "blocker");

  const head = headCell(movingToy);
  const contactX = BOARD.x + (head.x + 0.5 + direction.x * 0.48) * BOARD.cell;
  const contactY = BOARD.y + (head.y + 0.5 + direction.y * 0.48) * BOARD.cell;
  burst(contactX, contactY, blocker ? 9 : 6, "#fff1a8");
  tone(190, 0.08, 0.025, "square");
}

function setToolMode(mode) {
  if (state.pauseOpen || state.toolModal || state.levelCompleteAt || state.toolUses[mode] >= TOOL_LIMIT || profile.inventory[mode] < 1) return;
  if (state.toolMode === mode) {
    cancelToolMode();
    return;
  }
  state.toolMode = mode;
  state.toolSelection = [];
  state.hintedId = null;
}

function cancelToolMode() {
  state.toolMode = null;
  state.toolSelection = [];
}

function handleToolTarget(toy) {
  if (!toy || toy.state !== "IDLE" || isToyMoving(toy.id)) return;
  if (state.toolMode === "remove") selectToyForRemoval(toy);
  else if (state.toolMode === "flip") flipToy(toy);
}

function selectToyForRemoval(toy) {
  if (!toy || toy.state !== "IDLE" || state.pauseOpen || state.toolModal || state.toolUses.remove >= TOOL_LIMIT || profile.inventory.remove < 1) return;
  const existingIndex = state.toolSelection.indexOf(toy.id);
  if (existingIndex >= 0) {
    state.toolSelection.splice(existingIndex, 1);
    return;
  }
  state.toolSelection.push(toy.id);
  if (state.toolSelection.length < Math.min(2, state.toys.filter((item) => item.state === "IDLE").length)) {
    return;
  }
  const selectedIds = [...state.toolSelection];
  const selectedToys = state.toys.filter((item) => selectedIds.includes(item.id) && item.state === "IDLE");
  if (!selectedToys.length || !consumeTool("remove")) return;
  selectedToys.forEach((item) => removeToyWithEffect(item));
  state.lastToolAction = { type: "remove", toyIds: selectedIds };
  cancelToolMode();
  tone(740, 0.12, 0.03);
  settleAutoExits();
}

function removeToyWithEffect(toy) {
  const center = toyCenter(toy);
  toy.state = "EXITING";
  state.exiting.push({ toy: cloneToy(toy), elapsed: 0, duration: 340, dx: 0, dy: -0.08, kind: "remove" });
  burst(center.x, center.y, 12, "#ff9fcb");
}

function flipToy(toy) {
  if (!toy || toy.archetypeId === "AUTO_EXIT" || state.pauseOpen || state.levelCompleteAt) return;
  if (toy.state !== "IDLE" || isToyMoving(toy.id) || !consumeTool("flip")) return;
  const previousDirection = toy.direction;
  toy.direction = OPPOSITE_DIRECTION[toy.direction];
  state.lastToolAction = { type: "flip", toyIds: [toy.id], from: previousDirection, to: toy.direction };
  state.directionFxIds = [toy.id];
  state.directionFxUntil = state.time + 1000;
  cancelToolMode();
  const center = toyCenter(toy);
  burst(center.x, center.y, 10, "#b9d9ff");
  tone(560, 0.1, 0.025);
}

function shuffleDirections() {
  if (state.pauseOpen || state.toolModal || state.levelCompleteAt || state.toolUses.shuffle >= TOOL_LIMIT || profile.inventory.shuffle < 1) return;
  const idle = state.toys.filter((toy) => toy.state === "IDLE" && toy.archetypeId !== "AUTO_EXIT" && !isToyMoving(toy.id));
  if (!idle.length) return;
  if (!consumeTool("shuffle")) return;
  const random = seededRandom((state.levelIndex + 1) * 1009 + state.shuffleSerial * 9176 + state.moves * 37);
  state.shuffleSerial += 1;
  const pool = [...idle];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const changed = [];
  for (const toy of pool) {
    if (changed.length >= Math.min(5, idle.length)) break;
    if (randomizeToyDirection(toy, random)) changed.push(toy.id);
  }
  state.lastToolAction = { type: "shuffle", toyIds: changed };
  state.directionFxIds = changed;
  state.directionFxUntil = state.time + 1200;
  cancelToolMode();
  changed.forEach((id) => {
    const toy = state.toys.find((item) => item.id === id);
    const center = toyCenter(toy);
    burst(center.x, center.y, 5, "#ffe788");
  });
  settleAutoExits();
  tone(610, 0.13, 0.025);
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomizeToyDirection(toy, random) {
  const candidates = Object.keys(DIR).filter((direction) => direction !== toy.direction);
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const originalDirection = toy.direction;
  const originalCells = toy.cells.map((cell) => ({ ...cell }));
  const currentHead = headCell(toy);
  const occupied = occupancyFor(state.toys.filter((item) => item.state === "IDLE" && item.id !== toy.id));
  for (const direction of candidates) {
    let candidateCells;
    if (direction === OPPOSITE_DIRECTION[originalDirection]) {
      candidateCells = originalCells.map((cell) => ({ ...cell }));
    } else {
      const d = DIR[direction];
      candidateCells = Array.from({ length: toy.length }, (_, index) => ({ x: currentHead.x - d.x * index, y: currentHead.y - d.y * index }));
    }
    const valid = candidateCells.every((cell) => cell.x >= 0 && cell.x < BOARD.cols && cell.y >= 0 && cell.y < BOARD.rows && !occupied.has(cellKey(cell.x, cell.y)));
    if (!valid) continue;
    toy.direction = direction;
    toy.cells = candidateCells;
    toy.x = Math.min(...candidateCells.map((cell) => cell.x));
    toy.y = Math.min(...candidateCells.map((cell) => cell.y));
    return true;
  }
  return false;
}

function checkLevelCleared() {
  if (!state.levelCompleteAt && state.toys.every((item) => item.state !== "IDLE")) {
    const animationMs = Math.max(0, ...state.exiting.map((anim) => anim.duration - anim.elapsed));
    state.levelCompleteAt = state.time + Math.max(650, animationMs + 100);
  }
}

function burst(x, y, count, color) {
  for (let i = 0; i < count; i += 1) {
    const a = (Math.PI * 2 * i) / count + (i % 3) * 0.18;
    state.effects.push({
      x,
      y,
      vx: Math.cos(a) * (25 + (i % 4) * 9),
      vy: Math.sin(a) * (25 + (i % 5) * 7),
      life: 0.65,
      maxLife: 0.65,
      color,
      size: 2 + (i % 3),
    });
  }
}

function toyCenter(toy) {
  const minX = Math.min(...toy.cells.map((cell) => cell.x));
  const maxX = Math.max(...toy.cells.map((cell) => cell.x));
  const minY = Math.min(...toy.cells.map((cell) => cell.y));
  const maxY = Math.max(...toy.cells.map((cell) => cell.y));
  return {
    x: BOARD.x + ((minX + maxX + 1) / 2) * BOARD.cell,
    y: BOARD.y + ((minY + maxY + 1) / 2) * BOARD.cell,
  };
}

function comboRemainingMs() {
  return state.combo > 0 ? Math.max(0, state.comboExpiresAt - state.time) : 0;
}

function update(dt) {
  if (state.pauseOpen || state.toolModal) return;
  state.time += dt * 1000;
  for (let i = timers.length - 1; i >= 0; i -= 1) {
    if (state.time >= timers[i].at) {
      const { callback } = timers.splice(i, 1)[0];
      callback();
    }
  }
  state.exiting.forEach((anim) => { anim.elapsed += dt * 1000; });
  state.exiting = state.exiting.filter((anim) => anim.elapsed < anim.duration);
  state.moving.forEach((motion) => { motion.elapsed += dt * 1000; });
  state.moving = state.moving.filter((motion) => motion.elapsed < motion.duration);
  state.effects.forEach((effect) => {
    effect.life -= dt;
    effect.x += effect.vx * dt;
    effect.y += effect.vy * dt;
    effect.vy += 28 * dt;
  });
  state.effects = state.effects.filter((effect) => effect.life > 0);
  if (state.combo > 0 && state.time >= state.comboExpiresAt) {
    state.combo = 0;
    state.comboExpiresAt = 0;
  }
  if (state.hintedId && state.time > state.hintUntil) state.hintedId = null;
  if (state.directionFxIds.length && state.time > state.directionFxUntil) state.directionFxIds = [];
  if (state.levelCompleteAt && state.time >= state.levelCompleteAt && state.mode === "play") {
    state.completionRewards = settleCompletionReward();
    state.mode = "level-complete";
    requestSystems(["complete"], () => {});
    state.levelCompleteAt = 0;
    tone(523, 0.11, 0.03);
    setTimeoutSafe(() => tone(659, 0.11, 0.03), 120);
    setTimeoutSafe(() => tone(784, 0.18, 0.035), 240);
  }
}

let audioContext = null;
function tone(frequency, duration, volume, wave = "sine") {
  // Haptics follow the vibration switch independently of the sound switch.
  if (state.vibrationEnabled && state.mode === "play" && !state.pauseOpen && !state.toolModal) {
    try { navigator.vibrate?.(12); } catch { /* Unsupported devices keep playing normally. */ }
  }
  if (!state.audioEnabled) return;
  try {
    audioContext ||= new AudioContext();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = wave;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch {
    // Audio is decorative; gameplay stays functional when autoplay is restricted.
  }
}

function roundRect(x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
}

function fillRoundRect(x, y, w, h, r, fill, stroke = null, lineWidth = 1) {
  roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawBackground() {
  const [width, height] = ART_MANIFEST.assets.art_bedroom_bg_01.size;
  const scale = Math.max(W / width, H / height);
  drawArt("art_bedroom_bg_01", { x: (W - width * scale) / 2, y: (H - height * scale) / 2, w: width * scale, h: height * scale });
}

function drawHeader(title, subtitle) {
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff9ef";
  ctx.font = '700 34px Georgia, "Microsoft YaHei UI", serif';
  ctx.fillText(title, W / 2, 62);
  ctx.fillStyle = "rgba(255,249,239,.76)";
  ctx.font = '500 14px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(subtitle, W / 2, 88);
}

function drawHome() {
  ctx.fillStyle = "#fbe6e7";
  ctx.fillRect(0, 0, W, H);
  drawHomeScreen(ctx, homeProgress(), paintControl);
  drawCurrencyHud(false);
  if (!homeAssetsComplete()) {
    fillRoundRect(140, 3, 260, 27, 12, "rgba(255,247,240,.92)");
    artText("少量图片正在补载…", 270, 17, 13);
  }
  if (state.pauseOpen) drawHomeSettings(ctx, state, paintControl);
}

function homeProgress() {
  const index = LEVEL_SPECS.findIndex(spec => !profile.completedLevels.includes(spec.id));
  if (index < 0) return { complete: true, index: null, nextLevel: null, progressLabel: "更多夜晚准备中" };
  const spec = LEVEL_SPECS[index];
  const night = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][spec.chapterId] || spec.chapterId;
  const day = LEVEL_SPECS.slice(0, index + 1).filter(level => level.chapterId === spec.chapterId).length;
  return { complete: false, index, nextLevel: spec.id, progressLabel: `第${night}夜 · 第${day}关` };
}

function startFromHome() {
  if (!artReady || state.pauseOpen) return;
  const progress = homeProgress();
  if (!progress.complete) requestSystems(["play", "settings"], () => startLevel(progress.index));
}

function drawHomeToy(x, y, typeIndex, scale) {
  const id = ["toy_rabbit_white_a", "toy_duck_yellow_a", "toy_whale_blue_a"][typeIndex % 3];
  fitArt(id, { x: x - 36 * scale, y: y - 36 * scale, w: 72 * scale, h: 72 * scale });
}

function drawButton(x, y, w, h, title, subtitle = "", primary = false) {
  paintControl("finale.home", { x, y, w, h }, () => {
  drawArt(primary ? "ui_title_base_01_instance_01" : "ui_title_region_01_instance_01", { x, y: y - (primary ? 15 : 0), w, h: h + (primary ? 15 : 0) });
  artText(title, x + w / 2, y + (subtitle ? h * 0.46 : h * 0.52), subtitle ? 23 : 18, primary ? "#b97921" : "#915e6b", w - 45, 700);
  if (subtitle) artText(subtitle, x + w / 2, y + h * 0.74, 11, "#9b7780", w - 44);
  });
}

function drawPauseButton() {
  paintControl("play.pause", PAUSE_BUTTON, () => {
  drawArt("ui_nav_tab_base_01_instance_01");
  drawArt("ui_nav_icon_01_instance_01");
  });
}

function drawToolModal() {
  const id = state.toolModal;
  const tool = TOOL_BUTTONS.find(item => item.id === id);
  drawToolDialog(ctx, {
    title: id === "flip" ? "反转" : tool.label,
    lines: TOOL_DESCRIPTIONS[id],
    icon: tool.icon,
    buying: profile.inventory[id] === 0,
    price: TOOL_PRICE,
    reason: toolUnavailable(id),
  }, (asset, rect) => fitArt(asset, rect), paintControl);
}

function openPause() {
  if (state.toolModal) return;
  if (state.mode !== "play" || state.levelCompleteAt) return;
  cancelToolMode();
  state.pauseOpen = true;
  render();
}

function closePause() {
  state.pauseOpen = false;
  render();
}

function exitLevel() {
  state.toolModal = null;
  state.pauseOpen = false;
  state.mode = "home";
  state.combo = 0;
  state.comboExpiresAt = 0;
  state.toolMode = null;
  state.toolSelection = [];
  render();
}

function handlePausePointer(point) {
  if (pointInRect(point, PAUSE_UI.music)) state.musicEnabled = !state.musicEnabled;
  else if (pointInRect(point, PAUSE_UI.audio)) state.audioEnabled = !state.audioEnabled;
  else if (pointInRect(point, PAUSE_UI.vibration)) state.vibrationEnabled = !state.vibrationEnabled;
  else if (pointInRect(point, PAUSE_UI.restart)) restartLevel();
  else if (pointInRect(point, PAUSE_UI.resume)) closePause();
  else if (pointInRect(point, PAUSE_UI.exit)) exitLevel();
  saveSettings();
  render();
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ musicEnabled: state.musicEnabled, audioEnabled: state.audioEnabled, vibrationEnabled: state.vibrationEnabled }));
  } catch { /* Settings still work in memory when storage is blocked. */ }
}

function handleHomeSettings(point) {
  if (pointInRect(point, HOME_SETTINGS_UI.close)) state.pauseOpen = false;
  else if (pointInRect(point, HOME_SETTINGS_UI.music)) state.musicEnabled = !state.musicEnabled;
  else if (pointInRect(point, HOME_SETTINGS_UI.audio)) state.audioEnabled = !state.audioEnabled;
  else if (pointInRect(point, HOME_SETTINGS_UI.vibration)) state.vibrationEnabled = !state.vibrationEnabled;
  saveSettings();
  render();
}

function toyMotionOffset(toy) {
  const motion = state.moving.find(item => item.id === toy.id);
  if (!motion) return { x: 0, y: 0 };
  const remaining = (1 - Math.min(1, motion.elapsed / motion.duration)) ** 3;
  return { x: motion.fromX * remaining, y: motion.fromY * remaining };
}

function toyArtLayout(toy) {
  const center = toyCenter(toy);
  const width = (Math.max(...toy.cells.map(c => c.x)) - Math.min(...toy.cells.map(c => c.x)) + 1) * TOY_ART_CELL;
  const height = (Math.max(...toy.cells.map(c => c.y)) - Math.min(...toy.cells.map(c => c.y)) + 1) * TOY_ART_CELL;
  const rabbit = toy.archetypeId === "ORDINARY", duck = toy.archetypeId === "AUTO_EXIT";
  // Keep the approved toy artwork size independent of layout spacing.
  const inset = TOY_VISUAL_GAP;
  const scale = TOY_DISPLAY_SCALE * (rabbit ? 0.9 : 1);
  const displayWidth = (width - inset) * scale;
  const displayHeight = (height - inset) * scale;
  const id = rabbit ? "toy_rabbit_white_a" : duck ? "toy_duck_yellow_a" : "toy_whale_blue_a";
  const angle = rabbit ? RABBIT_ANGLE[toy.direction] : duck ? 0 : toy.direction === "UP" ? Math.PI / 2 : toy.direction === "DOWN" ? -Math.PI / 2 : 0;
  return { id, angle, flip: !rabbit && !duck && toy.direction === "RIGHT",
    rect: { x: center.x - displayWidth / 2, y: center.y - displayHeight / 2, w: displayWidth, h: displayHeight } };
}

function drawGame() {
  drawBackground();
  drawArtRug();
  const spec = LEVEL_SPECS[state.levelIndex];

  const idleToys = state.toys.filter((toy) => toy.state === "IDLE");
  idleToys.forEach((toy) => {
    const offset = toyMotionOffset(toy);
    drawToy(toy, offset.x, offset.y, 1);
  });
  state.exiting.forEach((anim) => {
    if (anim.path) {
      const progress = Math.min(1, anim.elapsed / anim.duration) * (anim.path.length - 1);
      const i = Math.min(Math.floor(progress), anim.path.length - 2);
      const a = anim.path[i], b = anim.path[i + 1], fraction = progress - i;
      drawToy(anim.toy, (a.x + (b.x - a.x) * fraction - anim.toy.x) * BOARD.cell,
        (a.y + (b.y - a.y) * fraction - anim.toy.y) * BOARD.cell,
        1 - Math.max(0, progress - (anim.path.length - 2)));
      return;
    }
    const t = Math.min(1, anim.elapsed / anim.duration);
    // Normal exits accelerate gently; removal retains its short fade animation.
    const eased = anim.kind === "exit" ? t * t * (3 - 2 * t) : 1 - (1 - t) ** 3;
    const alpha = anim.kind === "remove" ? 1 - eased : 1 - eased * 0.12;
    drawToy(anim.toy, anim.dx * eased * 640, anim.dy * eased * 780, alpha);
  });
  drawEffects();

  drawArtHud(spec);
  TOOL_BUTTONS.forEach(drawToolButton);
}

function drawToolButton(button) {
  paintControl(`play.${button.id}`, button, () => {
  const active = state.toolMode === button.id;
  const disc = artRect(`ui_bottom_button_disc_01_instance_${button.slot}`);
  ctx.save();
  if (active) {
    ctx.shadowColor = "#ffc648";
    ctx.shadowBlur = 16;
    fillRoundRect(disc.x + 5, disc.y + 5, disc.w - 10, disc.h - 10, disc.w / 2, "rgba(255,228,150,.75)", "#ffdb83", 3);
  }
  drawArt(`ui_bottom_button_disc_01_instance_${button.slot}`);
  ctx.shadowBlur = 0;
  drawArt(button.icon);
  const badge = artRect(`ui_small_badge_01_instance_${button.slot}`);
  drawArt(`ui_small_badge_01_instance_${button.slot}`);
  artText(profile.inventory[button.id], badge.x + badge.w / 2, badge.y + badge.h / 2, 14, "#fff", badge.w - 4);
  const plateId = `ui_bottom_label_plate_01_instance_${button.slot}`;
  const plate = artRect(plateId);
  drawArt(plateId);
  artText(button.label, plate.x + plate.w / 2, plate.y + plate.h / 2, 16, active ? "#b67923" : "#ca666b", undefined, 700);
  ctx.restore();
  });
}

function drawRugPattern() {
  ctx.save();
  ctx.globalAlpha = 0.13;
  ctx.strokeStyle = "#b992aa";
  ctx.lineWidth = 1;
  for (let x = 1; x < BOARD.cols; x += 1) {
    const px = BOARD.x + x * BOARD.cell;
    ctx.beginPath(); ctx.moveTo(px, BOARD.y + 18); ctx.lineTo(px, BOARD.y + BOARD.rows * BOARD.cell - 18); ctx.stroke();
  }
  for (let y = 1; y < BOARD.rows; y += 1) {
    const py = BOARD.y + y * BOARD.cell;
    ctx.beginPath(); ctx.moveTo(BOARD.x + 18, py); ctx.lineTo(BOARD.x + BOARD.cols * BOARD.cell - 18, py); ctx.stroke();
  }
  ctx.restore();
}

function drawExitMarkers() {
  ctx.save();
  ctx.fillStyle = "rgba(255,248,213,.72)";
  const cx = BOARD.x + (BOARD.cols * BOARD.cell) / 2;
  const cy = BOARD.y + (BOARD.rows * BOARD.cell) / 2;
  ctx.beginPath(); ctx.arc(cx, BOARD.y - 3, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, BOARD.y + BOARD.rows * BOARD.cell + 3, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(BOARD.x - 3, cy, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(BOARD.x + BOARD.cols * BOARD.cell + 3, cy, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawToy(toy, offsetX, offsetY, alpha) {
  const minX = Math.min(...toy.cells.map((cell) => cell.x));
  const maxX = Math.max(...toy.cells.map((cell) => cell.x));
  const minY = Math.min(...toy.cells.map((cell) => cell.y));
  const maxY = Math.max(...toy.cells.map((cell) => cell.y));
  let x = BOARD.x + minX * BOARD.cell + 2 + offsetX;
  let y = BOARD.y + minY * BOARD.cell + 2 + offsetY;
  const w = (maxX - minX + 1) * BOARD.cell - 4;
  const h = (maxY - minY + 1) * BOARD.cell - 4;
  const isSelected = state.toolSelection.includes(toy.id);
  const isHinted = state.hintedId === toy.id;
  const directionChanged = state.directionFxIds.includes(toy.id);
  const age = state.time - toy.blockedAt;
  const impact = age >= 0 && age < IMPACT_DURATION_MS;
  const shake = impact ? Math.sin(age / IMPACT_DURATION_MS * Math.PI * 4) * (1 - age / IMPACT_DURATION_MS) * 7 : 0;
  x += (toy.impactDx || 0) * shake;
  y += (toy.impactDy || 0) * shake;
  ctx.save();
  ctx.globalAlpha = alpha;
  const accent = impact ? "#fff3a1" : isSelected ? "#ed75aa" : directionChanged ? "#83bed7" : "#cda998";
  const highlighted = impact || isSelected || isHinted || directionChanged;
  ctx.shadowColor = "rgba(116,64,81,.55)";
  ctx.shadowBlur = 2;
  ctx.shadowOffsetY = 1;
  if (highlighted) { ctx.shadowColor = accent; ctx.shadowBlur = 14; }
  // Feedback follows the sprite alpha silhouette; no rectangular tile or arrow.
  const art = toyArtLayout(toy);
  art.rect.x += offsetX + (toy.impactDx || 0) * shake;
  art.rect.y += offsetY + (toy.impactDy || 0) * shake;
  fitArt(art.id, art.rect, art.flip, art.angle);
  ctx.shadowBlur = 0;
  if (isSelected) artText("✓", x + w / 2, y + h / 2, 19, "#ba497c", undefined, 700);
  ctx.restore();
}

function headPixel(toy, x, y, w, h) {
  if (toy.archetypeId === "AUTO_EXIT") return { x: x + w / 2, y: y + h / 2 };
  if (toy.direction === "LEFT") return { x: x + 12, y: y + h / 2 };
  if (toy.direction === "RIGHT") return { x: x + w - 12, y: y + h / 2 };
  if (toy.direction === "UP") return { x: x + w / 2, y: y + 12 };
  return { x: x + w / 2, y: y + h - 12 };
}

function drawToyFace(toy, x, y, face, stroke) {
  if (toy.archetypeId === "AUTO_EXIT") {
    ctx.fillStyle = face;
    ctx.beginPath(); ctx.arc(x, y - 1, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = stroke;
    ctx.beginPath(); ctx.arc(x - 4, y - 4, 1.4, 0, Math.PI * 2); ctx.arc(x + 4, y - 4, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e79a35";
    ctx.beginPath(); ctx.ellipse(x, y + 3, 5, 2.7, 0, 0, Math.PI * 2); ctx.fill();
    return;
  }
  if (toy.archetypeId === "ORDINARY") {
    const d = DIR[toy.direction];
    const angle = Math.atan2(d.y, d.x);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.ellipse(-7, -5, 7, 3.2, -0.2, 0, Math.PI * 2);
    ctx.ellipse(-7, 5, 7, 3.2, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(232,163,189,.6)";
    ctx.beginPath();
    ctx.ellipse(-8, -5, 4, 1.25, -0.2, 0, Math.PI * 2);
    ctx.ellipse(-8, 5, 4, 1.25, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = face;
  ctx.beginPath(); ctx.arc(x, y, 9.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = stroke;
  const horizontal = toy.direction === "LEFT" || toy.direction === "RIGHT";
  const eyeShift = toy.direction === "LEFT" || toy.direction === "UP" ? -1.2 : 1.2;
  if (horizontal) {
    ctx.beginPath(); ctx.arc(x + eyeShift, y - 3.2, 1.35, 0, Math.PI * 2); ctx.arc(x + eyeShift, y + 3.2, 1.35, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.beginPath(); ctx.arc(x - 3.2, y + eyeShift, 1.35, 0, Math.PI * 2); ctx.arc(x + 3.2, y + eyeShift, 1.35, 0, Math.PI * 2); ctx.fill();
  }
}

function drawDirectionNose(direction, x, y, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  if (direction === "LEFT") { ctx.moveTo(x - 10, y); ctx.lineTo(x - 4, y - 4); ctx.lineTo(x - 4, y + 4); }
  if (direction === "RIGHT") { ctx.moveTo(x + 10, y); ctx.lineTo(x + 4, y - 4); ctx.lineTo(x + 4, y + 4); }
  if (direction === "UP") { ctx.moveTo(x, y - 10); ctx.lineTo(x - 4, y - 4); ctx.lineTo(x + 4, y - 4); }
  if (direction === "DOWN") { ctx.moveTo(x, y + 10); ctx.lineTo(x - 4, y + 4); ctx.lineTo(x + 4, y + 4); }
  ctx.closePath();
  ctx.fill();
}

function drawHintStars(toy, x, y) {
  const d = DIR[toy.direction];
  ctx.fillStyle = "#fff3a6";
  for (let i = 1; i <= 3; i += 1) {
    const pulse = 0.7 + 0.3 * Math.sin(state.time / 130 + i);
    ctx.globalAlpha = pulse;
    drawStar(x + d.x * (15 + i * 9), y + d.y * (15 + i * 9), 2.8 + i * 0.45);
  }
  ctx.globalAlpha = 1;
}

function drawStar(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i += 1) {
    const radius = i % 2 === 0 ? r : r * 0.35;
    const angle = -Math.PI / 2 + (i * Math.PI) / 4;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

function drawEffects() {
  state.effects.forEach((effect) => {
    ctx.save();
    ctx.globalAlpha = effect.life / effect.maxLife;
    ctx.fillStyle = effect.color;
    drawStar(effect.x, effect.y, effect.size);
    ctx.restore();
  });
}

function drawComplete() {
  drawGame();
  if (!systemAssets.complete.ready) return;
  const spec = LEVEL_SPECS[state.levelIndex];
  drawCompleteDialog(ctx, { levelNo: spec.levelNo, title: spec.title,
    rewards: state.completionRewards, isLastLevel: state.levelIndex === LEVEL_SPECS.length - 1 }, paintControl);
}

function drawFinale() {
  drawBackground();
  const night = ctx.createRadialGradient(270, 320, 30, 270, 320, 420);
  night.addColorStop(0, "rgba(92,91,144,.05)");
  night.addColorStop(1, "rgba(25,23,58,.72)");
  ctx.fillStyle = night;
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffe9a9";
  ctx.beginPath(); ctx.arc(270, 190, 68, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#3b3967";
  ctx.beginPath(); ctx.arc(296, 170, 65, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#fff7ec";
  ctx.font = '700 20px "Microsoft YaHei UI", sans-serif';
  ctx.fillText("20 关全部完成", W / 2, 342);
  ctx.font = '700 52px Georgia, "Microsoft YaHei UI", serif';
  ctx.fillText("晚安", W / 2, 414);
  ctx.fillStyle = "rgba(255,247,236,.7)";
  ctx.font = '500 16px "Microsoft YaHei UI", sans-serif';
  ctx.fillText("灯暗下来，玩具们终于都睡着了。", W / 2, 460);
  for (let i = 0; i < 5; i += 1) drawHomeToy(105 + i * 82, 592 + (i % 2) * 15, i, 0.88);
  drawButton(110, 720, 320, 72, "回到玩具屋", "明晚再见", true);
}

function lighten(hex, amount) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + 255 * amount);
  const g = Math.min(255, ((n >> 8) & 255) + 255 * amount);
  const b = Math.min(255, (n & 255) + 255 * amount);
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

function render() {
  // Keep source-resolution detail on high-DPI devices without changing input coordinates.
  const ratio = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== W * ratio || canvas.height !== H * ratio) {
    canvas.width = W * ratio;
    canvas.height = H * ratio;
  }
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.clearRect(0, 0, W, H);
  if (!artReady) {
    ctx.fillStyle = "#fae7e4";
    ctx.fillRect(0, 0, W, H);
    const progress = imageLoadStatus();
    artText(artError || "正在布置玩具屋…", W / 2, H / 2 - 25, 21);
    artText(`图片 ${progress.loaded} / ${progress.total}`, W / 2, H / 2 + 10, 16);
    if (artError) {
      fillRoundRect(170, 520, 200, 52, 20, "#f5b8cd");
      artText("点击重试", 270, 546, 20);
    }
    return;
  }
  if (state.mode === "home") drawHome();
  else if (state.mode === "play") {
    drawGame();
    if (state.pauseOpen) drawPauseDialog(ctx, state, paintControl);
    if (state.toolModal) drawToolModal();
  }
  else if (state.mode === "level-complete") drawComplete();
  else drawFinale();
  if (pendingLoad) drawPendingLoad();
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: ((event.clientX - rect.left) / rect.width) * W, y: ((event.clientY - rect.top) / rect.height) * H };
}

function pointInRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

// A shared transform keeps each button's art, icon and label moving together.
const controlMotion = new Map();
let pointerGesture = null;
function controlScale(id) {
  const motion = controlMotion.get(id);
  if (!motion) return 1;
  const t = Math.min(1, (performance.now() - motion.start) / motion.duration);
  return motion.from + (motion.to - motion.from) * (1 - (1 - t) ** 3);
}
function animateControl(id, down) {
  controlMotion.set(id, { from: controlScale(id), to: down ? .92 : 1, start: performance.now(), duration: down ? 80 : 150 });
}
function paintControl(id, rect, paint) {
  const scale = controlScale(id);
  if (scale === 1) { paint(); return; }
  ctx.save();
  const matrix = ctx.getTransform();
  const ratio = canvas.width / W;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
  ctx.scale(scale, scale);
  ctx.translate(-rect.x - rect.w / 2, -rect.y - rect.h / 2);
  ctx.transform(matrix.a / ratio, matrix.b / ratio, matrix.c / ratio, matrix.d / ratio, matrix.e / ratio, matrix.f / ratio);
  paint();
  ctx.restore();
}
function activeControls() {
  if (!artReady || performance.now() < state.navigationUntil) return [];
  if (pendingLoad) return [{ id: "loading.cancel", ...LOAD_UI.cancel }, ...(pendingLoad.error ? [{ id: "loading.retry", ...LOAD_UI.retry }] : [])];
  const group = (prefix, rects) => Object.entries(rects).map(([key, rect]) => ({ id: `${prefix}.${key}`, ...rect }));
  if (state.toolModal) return group("tool", TOOL_MODAL_UI).filter(b => b.id !== "tool.action" || !toolUnavailable(state.toolModal));
  if (state.mode === "home") return state.pauseOpen ? group("settings", HOME_SETTINGS_UI)
    : group("home", HOME_UI).filter(b => b.id !== "home.start" || !homeProgress().complete);
  if (state.mode === "level-complete") return group("complete", COMPLETE_UI);
  if (state.mode === "finale") return [{ id: "finale.home", x: 110, y: 720, w: 320, h: 72 }];
  if (state.pauseOpen) return group("pause", PAUSE_UI);
  if (state.levelCompleteAt) return [];
  return [{ id: "play.pause", ...PAUSE_BUTTON }, ...TOOL_BUTTONS.map(b => ({ ...b, id: `play.${b.id}` }))];
}
function cancelPointerGesture() {
  if (pointerGesture?.button) animateControl(pointerGesture.button.id, false);
  pointerGesture = null;
}
canvas.addEventListener("pointerdown", event => {
  if (event.button !== 0 || pointerGesture) return;
  const point = canvasPoint(event);
  const button = activeControls().find(b => pointInRect(point, b));
  pointerGesture = { pointerId: event.pointerId, button, inside: true };
  if (button) animateControl(button.id, true);
  canvas.setPointerCapture(event.pointerId);
  render();
});
canvas.addEventListener("pointermove", event => {
  if (pointerGesture?.pointerId !== event.pointerId || !pointerGesture.button) return;
  const inside = pointInRect(canvasPoint(event), pointerGesture.button);
  if (inside !== pointerGesture.inside) {
    pointerGesture.inside = inside;
    animateControl(pointerGesture.button.id, inside);
  }
});
canvas.addEventListener("pointercancel", cancelPointerGesture);
canvas.addEventListener("lostpointercapture", cancelPointerGesture);
window.addEventListener("blur", cancelPointerGesture);

canvas.addEventListener("pointerup", (event) => {
  event.preventDefault();
  if (pointerGesture?.pointerId !== event.pointerId) return;
  const pressed = pointerGesture.button;
  const released = activeControls().find(b => pointInRect(canvasPoint(event), b));
  cancelPointerGesture();
  if (pressed?.id !== released?.id) { render(); return; }
  if (!artReady) {
    if (artError && pointInRect(canvasPoint(event), { x: 170, y: 520, w: 200, h: 52 })) {
      window.__toyhouse_art_ready = loadArt();
      render();
    }
    return;
  }
  if (performance.now() < state.navigationUntil) return;
  const point = canvasPoint(event);
  if (pendingLoad) {
    if (pendingLoad.error && pointInRect(point, LOAD_UI.retry)) requestSystems(pendingLoad.keys, pendingLoad.action);
    else if (pointInRect(point, LOAD_UI.cancel)) {
      pendingLoad = null;
      if (state.mode === "level-complete") exitLevel();
    }
    render();
    return;
  }
  if (state.toolModal) {
    if (pointInRect(point, TOOL_MODAL_UI.close)) state.toolModal = null;
    else if (pointInRect(point, TOOL_MODAL_UI.action)) confirmTool();
    render();
    return;
  }
  if (state.mode === "home") {
    if (state.pauseOpen) handleHomeSettings(point);
    else if (pointInRect(point, HOME_UI.settings)) { requestSystems(["settings"], () => { state.pauseOpen = true; render(); }); }
    else if (pointInRect(point, HOME_UI.start)) startFromHome();
    return;
  }
  if (state.mode === "level-complete") {
    if (pointInRect(point, COMPLETE_UI.home)) {
      state.navigationUntil = performance.now() + 350;
      exitLevel();
    } else if (pointInRect(point, COMPLETE_UI.next)) advanceAfterComplete();
    return;
  }
  if (state.mode === "finale") {
    if (pointInRect(point, { x: 110, y: 720, w: 320, h: 72 })) {
      exitLevel();
    }
    return;
  }
  if (state.pauseOpen) {
    handlePausePointer(point);
    return;
  }
  if (pointInRect(point, PAUSE_BUTTON)) {
    openPause();
    return;
  }
  const toolButton = TOOL_BUTTONS.find((button) => pointInRect(point, button));
  if (toolButton) {
    openToolModal(toolButton.id);
    return;
  }
  const gx = Math.floor((point.x - BOARD.x) / BOARD.cell);
  const gy = Math.floor((point.y - BOARD.y) / BOARD.cell);
  if (gx >= 0 && gx < BOARD.cols && gy >= 0 && gy < BOARD.rows) {
    const toy = toyAtGrid(gx, gy);
    if (state.toolMode) handleToolTarget(toy);
    else activateToy(toy);
  }
});

function advanceAfterComplete() {
  if (state.mode !== "level-complete") return;
  state.navigationUntil = performance.now() + 350;
  if (state.levelIndex === LEVEL_SPECS.length - 1) {
    state.mode = "finale";
  } else {
    state.levelIndex += 1;
    startLevel(state.levelIndex);
  }
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (!artReady) return;
  if (pendingLoad) {
    if (key === "escape") { pendingLoad = null; if (state.mode === "level-complete") exitLevel(); render(); }
    event.preventDefault();
    return;
  }
  if (performance.now() < state.navigationUntil || (event.repeat && (key === "enter" || key === " "))) return;
  if (state.mode === "home" && state.pauseOpen) {
    if (key === "escape") closePause();
    event.preventDefault();
    return;
  }
  if (state.toolModal) {
    if (key === "escape") state.toolModal = null;
    else if (key === "enter" || key === " ") confirmTool();
    event.preventDefault();
    render();
    return;
  }
  if (key === "f") {
    if (document.fullscreenElement) document.exitFullscreen();
    else canvas.requestFullscreen?.();
  } else if ((key === "p" || key === "escape") && state.mode === "play" && state.pauseOpen) closePause();
  else if (key === "p" && state.mode === "play") openPause();
  else if (key === "escape" && state.mode === "play" && state.toolMode) cancelToolMode();
  else if (key === "escape" && state.mode === "play") openPause();
  else if (key === "1" && state.mode === "play" && !state.pauseOpen) openToolModal("remove");
  else if (key === "2" && state.mode === "play" && !state.pauseOpen) openToolModal("shuffle");
  else if (key === "3" && state.mode === "play" && !state.pauseOpen) openToolModal("flip");
  else if (key === "a" && state.mode === "play" && !state.pauseOpen && new URLSearchParams(location.search).has("qa")) autoClearForQa();
  else if ((key === "enter" || key === " ") && state.mode === "home") startFromHome();
  else if ((key === "enter" || key === " ") && state.mode === "level-complete") advanceAfterComplete();
});

function renderGameToText() {
  const economy = { coins: profile.coins, inventory: { ...profile.inventory }, price: TOOL_PRICE, perLevelLimit: TOOL_LIMIT };
  const art = { loading: imageLoadStatus(), systems: Object.fromEntries(Object.entries(systemAssets).map(([key, value]) => [key, value.ready])), waiting: pendingLoad ? { systems: pendingLoad.keys, error: pendingLoad.error } : null, version: ART_MANIFEST.version, ready: artReady, loaded: artImages.size, expected: Object.keys(ART_MANIFEST.assets).length, error: artError || null, rabbitPose: "head-follows-direction", rug: { ...RUG_RECT, scaling: "uniform" }, currencies: "coins", toolStock: "persistent-inventory" };
  if (state.mode === "home") {
    const progress = homeProgress();
    return JSON.stringify({ mode: "home", art, homeArt: homeArtStatus(), economy, title: "晚安，玩具屋",
      action: progress.complete ? "今晚好梦；更多夜晚准备中" : "click 准备睡觉 or press Enter",
      ...progress, settingsOpen: state.pauseOpen,
      settings: { musicEnabled: state.musicEnabled, audioEnabled: state.audioEnabled, vibrationEnabled: state.vibrationEnabled },
      uiHitAreas: { home: HOME_UI, settings: HOME_SETTINGS_UI },
      currencyAssets: CURRENCY_LAYERS, coordinateSystem: "540x960 canvas; origin top-left; x right, y down" });
  }
  if (state.mode === "finale") {
    return JSON.stringify({ mode: "night-complete", chapter: LEVEL_SPECS[state.levelIndex].chapterId, completedLevels: LEVEL_SPECS.length, action: "click 回到玩具屋" });
  }
  const remaining = state.toys.filter((toy) => toy.state === "IDLE");
  const scans = new Map(remaining.map((toy) => [toy.id, scanForward(toy, remaining)]));
  const exits = remaining.filter((toy) => toy.archetypeId !== "AUTO_EXIT" && scans.get(toy.id).exitsBoard);
  const movable = remaining.filter((toy) => {
    const scan = scans.get(toy.id);
    return toy.archetypeId !== "AUTO_EXIT" && (scan.exitsBoard || scan.emptySteps > 0);
  });
  return JSON.stringify({
    mode: state.mode,
    art,
    economy,
    completion: state.mode === "level-complete" ? {
      rewards: state.completionRewards, rewardLayout: completionRewardLayout(state.completionRewards),
      art: completeArtStatus(), isLastLevel: state.levelIndex === LEVEL_SPECS.length - 1,
    } : null,
    toolDialog: state.toolModal ? { id: state.toolModal, action: profile.inventory[state.toolModal] > 0 ? "use" : "buy", disabledReason: toolUnavailable(state.toolModal) } : null,
    uiHitAreas: { pause: PAUSE_BUTTON, tools: TOOL_BUTTONS, pauseMenu: PAUSE_UI, toolModal: TOOL_MODAL_UI, completion: COMPLETE_UI },
    coordinateSystem: "12x18 grid; origin top-left; x right; y down; each toy x/y is top-left occupied cell",
    board: { ...BOARD },
    levelNo: LEVEL_SPECS[state.levelIndex].levelNo,
    chapterId: LEVEL_SPECS[state.levelIndex].chapterId,
    level: LEVEL_SPECS[state.levelIndex].id,
    levelTitle: LEVEL_SPECS[state.levelIndex].title,
    levelToySet: { archetypes: [...new Set(remaining.map((toy) => toy.archetypeId))], skins: [...new Set(remaining.map((toy) => toy.skinId))] },
    goal: "click a toy to move forward; it exits when the route reaches the edge, otherwise it stops immediately before the first blocker",
    remaining: remaining.length,
    total: state.initialToys.length,
    paused: state.pauseOpen || Boolean(state.toolModal),
    settings: { musicEnabled: state.musicEnabled, audioEnabled: state.audioEnabled, vibrationEnabled: state.vibrationEnabled },
    pauseArt: pauseArtStatus(),
    combo: state.combo,
    comboWindowMs: COMBO_WINDOW_MS,
    comboRemainingMs: Math.round(comboRemainingMs()),
    bestCombo: state.bestCombo,
    moves: state.moves,
    blockedClicks: state.blockedCount,
    exitReadyToyIds: exits.map((toy) => toy.id),
    movableToyIds: movable.map((toy) => toy.id),
    hintedToyId: state.hintedId,
    toolMode: state.toolMode,
    toolSelection: [...state.toolSelection],
    toolUses: { ...state.toolUses },
    lastToolAction: state.lastToolAction,
    exitingToys: state.exiting.map(anim => ({ id: anim.toy.id, kind: anim.kind, remainingMs: Math.max(0, Math.round(anim.duration - anim.elapsed)) })),
    movingImpacts: state.moving.map((motion) => ({ toyId: motion.id, blockerId: motion.blockerId, remainingMs: Math.max(0, Math.round(motion.duration - motion.elapsed)) })),
    impactedToys: remaining
      .filter((toy) => state.time - toy.blockedAt >= 0 && state.time - toy.blockedAt < IMPACT_DURATION_MS)
      .map((toy) => ({ id: toy.id, role: toy.impactRole })),
    message: null,
    controls: { removeTwo: "button 1", shuffleFive: "button 2", flipOne: "button 3", pause: "top-left navigation tab or P", resume: "pause modal or Esc", restart: "pause modal", fullscreen: "F" },
    toys: remaining.map((toy) => {
      const scan = scans.get(toy.id);
      return { id: toy.id, archetype: toy.archetypeId, skin: toy.skinId, type: toy.toyType, size: toy.sizeType, length: toy.length, x: toy.x, y: toy.y, direction: toy.direction, cells: toy.cells.map((cell) => ({ ...cell })), forwardSpaces: scan.emptySteps, blockerId: scan.blockerId, outcome: toy.archetypeId === "AUTO_EXIT" ? "AUTO_WAIT" : scan.exitsBoard ? "EXIT" : scan.emptySteps > 0 ? "STOP_AT_BLOCKER" : "BLOCKED", canMove: toy.archetypeId !== "AUTO_EXIT" && (scan.exitsBoard || scan.emptySteps > 0) };
    }),
  });
}

function autoClearForQa() {
  let guard = 0;
  while (state.mode === "play" && state.toys.some((toy) => toy.state === "IDLE") && guard < 100) {
    settleAutoExits();
    const exits = availableToys();
    if (!exits.length) break;
    exits.forEach(activateToy);
    guard += 1;
  }
}

window.render_game_to_text = renderGameToText;
window.toyhouseRewards = Object.freeze({ grant: grantReward });
window.__toyhouse_art_ready = loadArt();
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) update(1 / 60);
  render();
};
window.__toyhouse_debug = {
  grantReward,
  openToolModal,
  confirmTool,
  levels: LEVEL_SPECS.map((_, index) => ({ ...LEVEL_SPECS[index], analysis: buildLevel(index).analysis })),
  startLevel,
  availableIds: () => availableToys().map((toy) => toy.id),
  movableIds: () => movableToys().map((toy) => toy.id),
  clickToy: (id) => activateToy(state.toys.find((toy) => toy.id === id)),
  shuffleDirections,
  flipToy: (id) => flipToy(state.toys.find((toy) => toy.id === id)),
  clearCurrentLevel: autoClearForQa,
  openPause,
  closePause,
  restartLevel,
  exitLevel,
};

let lastFrame = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastFrame) / 1000);
  lastFrame = now;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

render();
requestAnimationFrame(frame);
