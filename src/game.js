const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const W = 540;
const H = 960;
const BOARD = { x: 53, y: 190, cols: 14, rows: 20, cell: 31 };
const DIR = {
  LEFT: { x: -1, y: 0, marker: "<" },
  RIGHT: { x: 1, y: 0, marker: ">" },
  UP: { x: 0, y: -1, marker: "^" },
  DOWN: { x: 0, y: 1, marker: "v" },
};
const OPPOSITE_DIRECTION = { LEFT: "RIGHT", RIGHT: "LEFT", UP: "DOWN", DOWN: "UP" };
const MARKER_TO_DIR = { "<": "LEFT", ">": "RIGHT", "^": "UP", v: "DOWN" };
const TYPE_NAMES = ["熊熊", "兔兔", "发条鸭", "机器人", "小恐龙", "鳄鱼抱枕", "鲸鱼抱枕"];
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
  { id: "remove", x: 18, y: 842, w: 96, h: 66, icon: "✕", label: "消除", detail: "选2只" },
  { id: "shuffle", x: 120, y: 842, w: 96, h: 66, icon: "⤨", label: "洗牌", detail: "随机5只" },
  { id: "flip", x: 222, y: 842, w: 96, h: 66, icon: "↔", label: "翻转", detail: "选1只" },
  { id: "hint", x: 324, y: 842, w: 96, h: 66, icon: "✦", label: "提示", detail: "找线头" },
  { id: "restart", x: 426, y: 842, w: 96, h: 66, icon: "↻", label: "重开", detail: "恢复盘面" },
];

// Test Level A：来自项目讨论中已验证可全部清空的 14×20 / 70 Toy 实际盘面。
const RAW_BOARD = [
  "01<|01-|01-|09<|09-|09-|....|....|10-|10-|10>|....|02^|....",
  "....|12^|22<|22-|....|....|11-|11-|11-|11-|11>|....|02-|03^",
  "....|12-|23<|23-|23-|24^|25^|13-|13-|13-|13-|13>|02-|03-",
  "....|26^|....|34-|34>|24-|25-|....|14-|14-|14-|14>|....|03-",
  "15^|26-|35<|35-|....|24-|25-|42<|42-|42-|42-|27^|....|....",
  "15-|26-|....|44^|43^|....|57-|57>|....|49^|....|27-|16^|17^",
  "15-|....|....|44-|43-|....|63-|63>|....|49-|58-|27-|16-|17-",
  "....|....|....|44-|....|64-|64-|64>|50^|49-|58-|....|16-|17-",
  "36-|....|....|45<|45-|45-|45-|45-|50-|....|58-|....|....|17-",
  "36-|....|....|....|52^|69^|70^|68-|50-|65-|58v|....|28^|30^",
  "36-|....|....|66-|52-|69-|70-|68-|....|65-|51-|....|28-|30-",
  "36v|....|....|66-|52-|....|70-|68v|....|65v|51-|37^|28-|30-",
  "29-|....|46^|66v|....|....|59-|59-|59-|59>|51v|37-|38^|30-",
  "29-|....|46-|53<|53-|....|60<|60-|....|....|47-|37-|38-|....",
  "29v|61-|....|....|67<|67-|67-|67-|67-|....|47-|....|....|39^",
  "18-|61-|62-|62-|62>|....|31-|....|54-|54>|47-|32-|33-|39-",
  "18v|61v|....|....|....|04-|31-|48-|55-|55>|47v|32-|33-|39-",
  "05-|56-|56-|56-|56>|04-|31-|48v|40-|40-|40>|32v|33v|06-",
  "05-|19<|19-|19-|07-|04v|31v|41<|41-|41-|20-|20-|20>|06v",
  "05v|....|....|....|07v|....|21-|21-|21>|08-|08-|08>|....|....",
];

const LEVEL_SPECS = [
  { id: "1-1", count: 55, transform: "identity", title: "找到线头", note: "看清玩具的脸，它只会朝面对的方向离开。" },
  { id: "1-2", count: 60, transform: "flipX", title: "前方有人", note: "被挡住不会失败，换一只试试。" },
  { id: "1-3", count: 65, transform: "flipY", title: "四面八方", note: "向上、下、左、右寻找通向边缘的路线。" },
  { id: "1-4", count: 68, transform: "rotate180", title: "长短交错", note: "长玩具往往同时锁住多条路线。" },
  { id: "1-5", count: 70, transform: "identity", title: "剥开一层", note: "先清外层，再看新的线头出现。" },
  { id: "1-6", count: 70, transform: "flipX", title: "双区松动", note: "盘面两侧都可能有突破口。" },
  { id: "1-7", count: 70, transform: "flipY", title: "巨型钥匙", note: "找到能打开大片区域的 XL 玩具。" },
  { id: "1-8", count: 70, transform: "rotate180", title: "挤成一团", note: "密集时先沿四条边扫描。" },
  { id: "1-9", count: 70, transform: "identity", title: "深层梦境", note: "耐心拆结，连续离场会越来越快。" },
  { id: "1-10", count: 70, transform: "flipX", title: "第一夜终章", note: "送所有玩具回去睡觉。" },
];

const state = {
  mode: "home",
  levelIndex: 0,
  toys: [],
  initialToys: [],
  exiting: [],
  moving: [],
  effects: [],
  combo: 0,
  bestCombo: 0,
  moves: 0,
  blockedCount: 0,
  hintedId: null,
  hintUntil: 0,
  message: "",
  messageUntil: 0,
  time: 0,
  levelCompleteAt: 0,
  audioEnabled: true,
  musicEnabled: true,
  tutorialStep: 0,
  toolMode: null,
  toolSelection: [],
  toolUses: { remove: 0, shuffle: 0, flip: 0 },
  lastToolAction: null,
  directionFxIds: [],
  directionFxUntil: 0,
  shuffleSerial: 0,
};

function parseBaseBoard() {
  const map = new Map();
  RAW_BOARD.forEach((row, y) => {
    const cells = row.split("|");
    if (cells.length !== BOARD.cols) throw new Error(`Row ${y} has ${cells.length} cells`);
    cells.forEach((token, x) => {
      if (token === "....") return;
      const id = Number(token.slice(0, 2));
      if (!map.has(id)) map.set(id, { id, cells: [], direction: null });
      const item = map.get(id);
      item.cells.push({ x, y });
      const marker = token[2];
      if (MARKER_TO_DIR[marker]) item.direction = MARKER_TO_DIR[marker];
    });
  });
  const toys = [...map.values()].sort((a, b) => a.id - b.id);
  if (toys.length !== 70 || toys.some((toy) => !toy.direction)) {
    throw new Error("Test A level data is incomplete");
  }
  return toys;
}

const BASE_TOYS = parseBaseBoard();

function transformToy(base, transform) {
  let direction = base.direction;
  const cells = base.cells.map(({ x, y }) => {
    if (transform === "flipX") return { x: BOARD.cols - 1 - x, y };
    if (transform === "flipY") return { x, y: BOARD.rows - 1 - y };
    if (transform === "rotate180") return { x: BOARD.cols - 1 - x, y: BOARD.rows - 1 - y };
    return { x, y };
  });
  if (transform === "flipX" || transform === "rotate180") {
    if (direction === "LEFT") direction = "RIGHT";
    else if (direction === "RIGHT") direction = "LEFT";
  }
  if (transform === "flipY" || transform === "rotate180") {
    if (direction === "UP") direction = "DOWN";
    else if (direction === "DOWN") direction = "UP";
  }
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const typeIndex = (base.id * 5 + Math.floor(base.id / 7)) % TYPE_NAMES.length;
  return {
    id: `T${String(base.id).padStart(2, "0")}`,
    numericId: base.id,
    toyType: TYPE_NAMES[typeIndex],
    typeIndex,
    variant: base.id % 5,
    length: cells.length,
    sizeType: [null, null, "S", "M", "L", "XL"][cells.length],
    direction,
    x: minX,
    y: minY,
    cells,
    state: "IDLE",
    blockedAt: -9999,
  };
}

function buildLevel(index) {
  const spec = LEVEL_SPECS[index];
  const toys = selectBaseToys(spec.count)
    .map((toy) => transformToy(toy, spec.transform));
  const analysis = analyzeLevel(toys);
  if (!analysis.solvable) throw new Error(`${spec.id} is not solvable`);
  return { spec, toys, analysis };
}

function selectBaseToys(count) {
  if (count >= BASE_TOYS.length) return BASE_TOYS;
  const removeCount = BASE_TOYS.length - count;
  const removedIds = new Set();
  for (let i = 0; i < removeCount; i += 1) {
    removedIds.add(Math.floor(((i + 0.5) * BASE_TOYS.length) / removeCount) + 1);
  }
  return BASE_TOYS.filter((toy) => !removedIds.has(toy.id));
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function occupancyFor(toys) {
  const occupied = new Map();
  toys.forEach((toy) => toy.cells.forEach((cell) => occupied.set(cellKey(cell.x, cell.y), toy.id)));
  return occupied;
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
  return toys.filter((toy) => toy.state === "IDLE" && canExit(toy, toys));
}

function movableToys(toys = state.toys) {
  return toys.filter((toy) => toy.state === "IDLE" && canMove(toy, toys));
}

function analyzeLevel(sourceToys) {
  const working = sourceToys.map((toy) => ({ ...toy, cells: toy.cells.map((cell) => ({ ...cell })) }));
  const layers = [];
  while (working.length) {
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
    solvable: working.length === 0,
    layers,
    releaseDepth: layers.length,
    initialExitCount: layers[0]?.length ?? 0,
    occupancy: Math.round((occupiedCells / (BOARD.cols * BOARD.rows)) * 100),
    maxCascade: Math.max(...layers.map((layer) => layer.length)),
  };
}

function cloneToy(toy) {
  return { ...toy, cells: toy.cells.map((cell) => ({ ...cell })), state: "IDLE", blockedAt: -9999 };
}

function startLevel(index = state.levelIndex) {
  const level = buildLevel(index);
  state.mode = "play";
  state.levelIndex = index;
  state.initialToys = level.toys.map(cloneToy);
  state.toys = level.toys.map(cloneToy);
  state.exiting = [];
  state.moving = [];
  state.effects = [];
  state.combo = 0;
  state.bestCombo = 0;
  state.moves = 0;
  state.blockedCount = 0;
  state.hintedId = null;
  state.hintUntil = 0;
  state.levelCompleteAt = 0;
  state.tutorialStep = 0;
  state.toolMode = null;
  state.toolSelection = [];
  state.toolUses = { remove: 0, shuffle: 0, flip: 0 };
  state.lastToolAction = null;
  state.directionFxIds = [];
  showMessage(index === 0 ? "点一下玩具：它会前进，并停在阻挡前。" : level.spec.note, 3600);
  if (index === 0) setTimeoutSafe(() => {
    if (state.moves === 0 && !state.toolMode) hint();
  }, 650);
  tone(392, 0.08, 0.025);
  render();
}

function restartLevel() {
  const level = buildLevel(state.levelIndex);
  state.toys = level.toys.map(cloneToy);
  state.initialToys = level.toys.map(cloneToy);
  state.exiting = [];
  state.moving = [];
  state.effects = [];
  state.combo = 0;
  state.bestCombo = 0;
  state.moves = 0;
  state.blockedCount = 0;
  state.hintedId = null;
  state.levelCompleteAt = 0;
  state.toolMode = null;
  state.toolSelection = [];
  state.lastToolAction = null;
  state.directionFxIds = [];
  showMessage("盘面已经恢复，慢慢找新的线头。", 1800);
  tone(330, 0.08, 0.02);
}

function showMessage(text, duration = 1500) {
  state.message = text;
  state.messageUntil = state.time + duration;
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
  showMessage(exits.length ? `${target.toyType}前方直通出口。` : `${target.toyType}前面还有空间，可以先挪动。`, 2200);
  tone(659, 0.12, 0.025);
}

function toyAtGrid(x, y) {
  return state.toys.find((toy) => toy.state === "IDLE" && toy.cells.some((cell) => cell.x === x && cell.y === y));
}

function activateToy(toy) {
  if (!toy || toy.state !== "IDLE" || state.levelCompleteAt || isToyMoving(toy.id)) return;
  state.moves += 1;
  const scan = scanForward(toy);
  if (!scan.exitsBoard && scan.emptySteps === 0) {
    toy.blockedAt = state.time;
    state.combo = 0;
    state.blockedCount += 1;
    state.hintedId = null;
    showMessage("已经贴住前面的玩具了，换一只试试。", 1300);
    tone(170, 0.07, 0.025, "square");
    return;
  }

  if (!scan.exitsBoard) {
    slideToyToBlocker(toy, scan.emptySteps);
    return;
  }

  const before = new Set(availableToys().map((item) => item.id));
  toy.state = "EXITING";
  state.combo += 1;
  state.bestCombo = Math.max(state.bestCombo, state.combo);
  state.hintedId = null;
  const d = DIR[toy.direction];
  state.exiting.push({ toy: cloneToy(toy), elapsed: 0, duration: 430, dx: d.x, dy: d.y, kind: "exit" });
  const remaining = state.toys.filter((item) => item.state === "IDLE");
  const after = availableToys(remaining);
  const newlyOpened = after.filter((item) => !before.has(item.id)).length;
  const center = toyCenter(toy);
  burst(center.x, center.y, newlyOpened >= 3 ? 16 : 7, newlyOpened >= 3 ? "#ffd86b" : "#fff3c7");
  if (newlyOpened >= 3) {
    showMessage(`啪嗒！一次松开了 ${newlyOpened} 只玩具`, 1500);
    tone(784, 0.1, 0.035);
  } else {
    tone(440 + Math.min(state.combo, 12) * 24, 0.065, 0.025);
  }
  if (state.levelIndex === 0 && state.tutorialStep < 2) {
    state.tutorialStep += 1;
    setTimeoutSafe(() => hint(), 420);
  }
  if (remaining.length === 0) state.levelCompleteAt = state.time + 650;
}

function isToyMoving(id) {
  return state.moving.some((motion) => motion.id === id);
}

function slideToyToBlocker(toy, steps) {
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
  });
  state.hintedId = null;
  showMessage(`${toy.toyType}向前挪了 ${steps} 格，停在阻挡前。`, 1450);
  const center = toyCenter(toy);
  burst(center.x, center.y, 5, "#dff6e5");
  tone(330 + Math.min(steps, 8) * 16, 0.08, 0.02);
}

function setToolMode(mode) {
  if (state.toolMode === mode) {
    cancelToolMode();
    showMessage("已取消道具选择。", 1000);
    return;
  }
  state.toolMode = mode;
  state.toolSelection = [];
  state.hintedId = null;
  if (mode === "remove") showMessage("消除道具：请选择两个玩具。", 3000);
  if (mode === "flip") showMessage("翻转道具：请选择一个玩具。", 3000);
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
  const existingIndex = state.toolSelection.indexOf(toy.id);
  if (existingIndex >= 0) {
    state.toolSelection.splice(existingIndex, 1);
    showMessage("已取消选择，请再选两个玩具。", 1600);
    return;
  }
  state.toolSelection.push(toy.id);
  if (state.toolSelection.length < Math.min(2, state.toys.filter((item) => item.state === "IDLE").length)) {
    showMessage(`已选 ${toy.toyType}，再选一个。`, 2200);
    return;
  }
  const selectedIds = [...state.toolSelection];
  const selectedToys = state.toys.filter((item) => selectedIds.includes(item.id) && item.state === "IDLE");
  selectedToys.forEach((item) => removeToyWithEffect(item));
  state.toolUses.remove += 1;
  state.lastToolAction = { type: "remove", toyIds: selectedIds };
  state.combo = 0;
  cancelToolMode();
  showMessage(`消除了 ${selectedToys.length} 只玩具。`, 1700);
  tone(740, 0.12, 0.03);
  checkLevelCleared();
}

function removeToyWithEffect(toy) {
  const center = toyCenter(toy);
  toy.state = "EXITING";
  state.exiting.push({ toy: cloneToy(toy), elapsed: 0, duration: 340, dx: 0, dy: -0.08, kind: "remove" });
  burst(center.x, center.y, 12, "#ff9fcb");
}

function flipToy(toy) {
  const previousDirection = toy.direction;
  toy.direction = OPPOSITE_DIRECTION[toy.direction];
  state.toolUses.flip += 1;
  state.lastToolAction = { type: "flip", toyIds: [toy.id], from: previousDirection, to: toy.direction };
  state.directionFxIds = [toy.id];
  state.directionFxUntil = state.time + 1000;
  cancelToolMode();
  const center = toyCenter(toy);
  burst(center.x, center.y, 10, "#b9d9ff");
  showMessage(`${toy.toyType}已经转身。`, 1500);
  tone(560, 0.1, 0.025);
}

function shuffleDirections() {
  const idle = state.toys.filter((toy) => toy.state === "IDLE" && !isToyMoving(toy.id));
  if (!idle.length) return;
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
  state.toolUses.shuffle += 1;
  state.lastToolAction = { type: "shuffle", toyIds: changed };
  state.directionFxIds = changed;
  state.directionFxUntil = state.time + 1200;
  state.combo = 0;
  cancelToolMode();
  changed.forEach((id) => {
    const toy = state.toys.find((item) => item.id === id);
    const center = toyCenter(toy);
    burst(center.x, center.y, 5, "#ffe788");
  });
  showMessage(`重新调整了 ${changed.length} 只玩具的方向。`, 1800);
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
  if (state.toys.filter((item) => item.state === "IDLE").length === 0) state.levelCompleteAt = state.time + 650;
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

function update(dt) {
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
  if (state.hintedId && state.time > state.hintUntil) state.hintedId = null;
  if (state.directionFxIds.length && state.time > state.directionFxUntil) state.directionFxIds = [];
  if (state.levelCompleteAt && state.time >= state.levelCompleteAt && state.mode === "play") {
    state.mode = "level-complete";
    state.levelCompleteAt = 0;
    tone(523, 0.11, 0.03);
    setTimeoutSafe(() => tone(659, 0.11, 0.03), 120);
    setTimeoutSafe(() => tone(784, 0.18, 0.035), 240);
  }
}

let audioContext = null;
function tone(frequency, duration, volume, wave = "sine") {
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
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#3b3569");
  gradient.addColorStop(0.36, "#756b9e");
  gradient.addColorStop(1, "#f8cfd5");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(255,255,255,.08)";
  for (let i = 0; i < 18; i += 1) {
    const x = (i * 97) % W;
    const y = 36 + ((i * 131) % 650);
    ctx.beginPath();
    ctx.arc(x, y, 1.3 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
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
  drawBackground();
  drawHeader("晚安，玩具屋", "第一夜 · 月亮升起来了");

  // 剖面式娃屋
  ctx.save();
  ctx.shadowColor = "rgba(37,28,68,.32)";
  ctx.shadowBlur = 26;
  fillRoundRect(54, 126, 432, 562, 36, "#fff2e7", "#e8b6c3", 5);
  ctx.restore();
  fillRoundRect(72, 145, 396, 246, 25, "#f7d7dd");
  fillRoundRect(72, 408, 396, 252, 25, "#dcebd9");
  ctx.fillStyle = "#d69bab";
  ctx.fillRect(68, 391, 404, 18);

  // 窗与月亮
  fillRoundRect(187, 169, 166, 150, 76, "#47466f", "#f6dfc7", 7);
  const moon = ctx.createRadialGradient(296, 212, 2, 296, 212, 42);
  moon.addColorStop(0, "#fffbe3");
  moon.addColorStop(1, "#f5df93");
  ctx.fillStyle = moon;
  ctx.beginPath();
  ctx.arc(296, 218, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#47466f";
  ctx.beginPath();
  ctx.arc(311, 205, 33, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#ffe9a9";
  for (const [x, y, r] of [[225, 208, 3], [335, 250, 2], [253, 267, 2], [321, 182, 2]]) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  // 帷幔
  ctx.fillStyle = "#c9829e";
  ctx.beginPath(); ctx.moveTo(95, 145); ctx.quadraticCurveTo(170, 190, 205, 165); ctx.lineTo(185, 145); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(445, 145); ctx.quadraticCurveTo(370, 190, 335, 165); ctx.lineTo(355, 145); ctx.closePath(); ctx.fill();

  // 楼下地毯与家具
  ctx.fillStyle = "#f1c5cb";
  ctx.beginPath(); ctx.ellipse(270, 592, 152, 45, 0, 0, Math.PI * 2); ctx.fill();
  fillRoundRect(103, 472, 142, 92, 25, "#d99aaa", "#ac7083", 3);
  fillRoundRect(112, 452, 124, 55, 22, "#efbdc8", "#ac7083", 3);
  fillRoundRect(336, 470, 91, 121, 18, "#f1d5a7", "#b98f65", 3);
  ctx.fillStyle = "#b98f65";
  ctx.fillRect(350, 486, 5, 86);
  ctx.fillRect(380, 486, 5, 86);
  ctx.fillRect(410, 486, 5, 86);

  drawHomeToy(154, 531, 0, 1.22);
  drawHomeToy(224, 576, 1, 1.05);
  drawHomeToy(301, 575, 2, 0.96);
  drawHomeToy(382, 552, 3, 1.05);

  ctx.textAlign = "center";
  ctx.fillStyle = "#5b4770";
  ctx.font = '700 18px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(`第一夜 · 第 ${state.levelIndex + 1} 关`, W / 2, 716);
  drawButton(100, 744, 340, 82, "准备睡觉", "把挤成一团的玩具送回床上", true);
  ctx.fillStyle = "rgba(255,255,255,.72)";
  ctx.font = '500 13px "Microsoft YaHei UI", sans-serif';
  ctx.fillText("点击玩具前进 · 三种道具辅助解局 · F 全屏", W / 2, 875);
  ctx.fillStyle = "rgba(255,255,255,.5)";
  ctx.font = '500 12px "Microsoft YaHei UI", sans-serif';
  ctx.fillText("高密度方向释放 Puzzle · GDD V1.3 原型", W / 2, 906);
}

function drawHomeToy(x, y, typeIndex, scale) {
  const [base, face, stroke] = PALETTES[typeIndex];
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = base;
  ctx.beginPath(); ctx.arc(-13, -18, 11, 0, Math.PI * 2); ctx.arc(13, -18, 11, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(0, 5, 31, 36, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = face;
  ctx.beginPath(); ctx.ellipse(0, 7, 18, 15, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = stroke;
  ctx.beginPath(); ctx.arc(-7, 0, 2.6, 0, Math.PI * 2); ctx.arc(7, 0, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 7, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawButton(x, y, w, h, title, subtitle = "", primary = false) {
  ctx.save();
  ctx.shadowColor = primary ? "rgba(98,61,105,.34)" : "rgba(52,43,86,.16)";
  ctx.shadowBlur = primary ? 18 : 7;
  ctx.shadowOffsetY = 7;
  const gradient = ctx.createLinearGradient(x, y, x, y + h);
  gradient.addColorStop(0, primary ? "#f3a8be" : "#fff8ef");
  gradient.addColorStop(1, primary ? "#d77c9e" : "#f2e1dc");
  fillRoundRect(x, y, w, h, h / 2, gradient, primary ? "#ffcfda" : "#d9bdc4", 2);
  ctx.restore();
  ctx.textAlign = "center";
  ctx.fillStyle = primary ? "#fff" : "#594a68";
  ctx.font = `700 ${subtitle ? 23 : 17}px "Microsoft YaHei UI", sans-serif`;
  ctx.fillText(title, x + w / 2, y + (subtitle ? 34 : h / 2 + 6));
  if (subtitle) {
    ctx.fillStyle = primary ? "rgba(255,255,255,.78)" : "#8d7687";
    ctx.font = '500 12px "Microsoft YaHei UI", sans-serif';
    ctx.fillText(subtitle, x + w / 2, y + 57);
  }
}

function drawGame() {
  drawBackground();
  const spec = LEVEL_SPECS[state.levelIndex];
  const remaining = state.toys.filter((toy) => toy.state === "IDLE").length;
  const total = state.initialToys.length;
  drawHeader(`第一夜 · ${spec.id}`, `${spec.title}  ·  ${remaining}/${total} 只还没睡`);

  // 顶部进度与 Combo
  fillRoundRect(53, 108, 434, 52, 26, "rgba(255,249,239,.88)", "rgba(255,255,255,.55)", 2);
  fillRoundRect(67, 129, 240, 12, 6, "#eadce4");
  const clearedRatio = total ? (total - remaining) / total : 1;
  const progressGradient = ctx.createLinearGradient(67, 0, 367, 0);
  progressGradient.addColorStop(0, "#ed9bb7");
  progressGradient.addColorStop(1, "#ffd36f");
  fillRoundRect(67, 129, Math.max(12, 240 * clearedRatio), 12, 6, progressGradient);
  ctx.textAlign = "left";
  ctx.fillStyle = "#6c5975";
  ctx.font = '700 12px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(`${Math.round(clearedRatio * 100)}%`, 337, 140);
  ctx.textAlign = "right";
  ctx.fillStyle = state.combo >= 5 ? "#c8678b" : "#7a6880";
  ctx.font = '800 18px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(state.combo > 1 ? `连击 ${state.combo}` : "晚安", 471, 141);

  // 盘面地毯
  ctx.save();
  ctx.shadowColor = "rgba(41,35,80,.27)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 9;
  fillRoundRect(BOARD.x - 12, BOARD.y - 12, BOARD.cols * BOARD.cell + 24, BOARD.rows * BOARD.cell + 24, 32, "#f9eee6", "#efc7c9", 4);
  ctx.restore();
  const rug = ctx.createLinearGradient(BOARD.x, BOARD.y, BOARD.x, BOARD.y + BOARD.rows * BOARD.cell);
  rug.addColorStop(0, "#f4dfda");
  rug.addColorStop(1, "#e9d7dc");
  fillRoundRect(BOARD.x, BOARD.y, BOARD.cols * BOARD.cell, BOARD.rows * BOARD.cell, 22, rug);
  drawRugPattern();
  drawExitMarkers();

  const idleToys = state.toys.filter((toy) => toy.state === "IDLE");
  idleToys.forEach((toy) => {
    const motion = state.moving.find((item) => item.id === toy.id);
    if (!motion) {
      drawToy(toy, 0, 0, 1);
      return;
    }
    const t = Math.min(1, motion.elapsed / motion.duration);
    const eased = 1 - (1 - t) ** 3;
    drawToy(toy, motion.fromX * (1 - eased), motion.fromY * (1 - eased), 1);
  });
  state.exiting.forEach((anim) => {
    const t = Math.min(1, anim.elapsed / anim.duration);
    const eased = 1 - (1 - t) ** 3;
    const alpha = anim.kind === "remove" ? 1 - eased : 1 - eased * 0.12;
    drawToy(anim.toy, anim.dx * eased * 640, anim.dy * eased * 780, alpha);
  });
  drawEffects();

  if (state.message && state.time < state.messageUntil) drawToast(state.message);
  TOOL_BUTTONS.forEach(drawToolButton);
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(255,255,255,.7)";
  ctx.font = '500 12px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(state.toolMode ? "点击盘面选择目标 · 再点同一道具可取消" : "点击即前进 · 遇到阻挡会停下，不会回位", W / 2, 934);
}

function drawToolButton(button) {
  const active = state.toolMode === button.id;
  ctx.save();
  ctx.shadowColor = active ? "rgba(255,220,111,.5)" : "rgba(52,43,86,.2)";
  ctx.shadowBlur = active ? 14 : 6;
  ctx.shadowOffsetY = 4;
  const gradient = ctx.createLinearGradient(button.x, button.y, button.x, button.y + button.h);
  gradient.addColorStop(0, active ? "#fff0a8" : "#fff8ef");
  gradient.addColorStop(1, active ? "#f3c768" : "#f0dfe1");
  fillRoundRect(button.x, button.y, button.w, button.h, 22, gradient, active ? "#fff3bc" : "#d7bac4", 2);
  ctx.restore();
  ctx.textAlign = "center";
  ctx.fillStyle = active ? "#805a36" : "#594a68";
  ctx.font = '800 17px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(`${button.icon} ${button.label}`, button.x + button.w / 2, button.y + 27);
  ctx.fillStyle = active ? "#9b7447" : "#9a8291";
  ctx.font = '600 10px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(button.detail, button.x + button.w / 2, button.y + 48);
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
  const [base, face, stroke] = PALETTES[toy.typeIndex];
  const isHinted = state.hintedId === toy.id;
  const isSelected = state.toolSelection.includes(toy.id);
  const directionChanged = state.directionFxIds.includes(toy.id);
  const blockedAge = state.time - toy.blockedAt;
  const shake = blockedAge >= 0 && blockedAge < 460 ? Math.sin(blockedAge * 0.09) * (1 - blockedAge / 460) * 5 : 0;
  if (toy.direction === "LEFT" || toy.direction === "RIGHT") x += shake;
  else y += shake;

  ctx.save();
  ctx.globalAlpha = alpha;
  if (isHinted || isSelected || directionChanged) {
    ctx.shadowColor = isSelected ? "#ff72b6" : directionChanged ? "#8bd8ff" : "#ffe276";
    ctx.shadowBlur = 18 + Math.sin(state.time / 120) * 5;
  }
  const bodyGradient = ctx.createLinearGradient(x, y, x + w, y + h);
  bodyGradient.addColorStop(0, lighten(base, 0.16));
  bodyGradient.addColorStop(1, base);
  fillRoundRect(x, y, w, h, Math.min(13, Math.min(w, h) / 2), bodyGradient, blockedAge < 460 ? "#fff" : stroke, blockedAge < 460 ? 3 : 1.4);
  ctx.shadowBlur = 0;

  // 缝线与补丁让重复玩具有轻微变体。
  ctx.strokeStyle = "rgba(255,255,255,.34)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  if (w > h) {
    ctx.beginPath(); ctx.moveTo(x + 14, y + h - 5); ctx.lineTo(x + w - 14, y + h - 5); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(x + w - 5, y + 14); ctx.lineTo(x + w - 5, y + h - 14); ctx.stroke();
  }
  ctx.setLineDash([]);
  if (toy.length >= 4) {
    ctx.fillStyle = "rgba(255,244,220,.32)";
    ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, 6 + toy.variant, 0, Math.PI * 2); ctx.fill();
  }

  const head = headPixel(toy, x, y, w, h);
  drawToyFace(toy, head.x, head.y, face, stroke);
  drawDirectionNose(toy.direction, head.x, head.y, stroke);
  if (isHinted) drawHintStars(toy, head.x, head.y);
  if (isSelected) {
    ctx.strokeStyle = "#fff4fa";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(head.x, head.y, 12, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}

function headPixel(toy, x, y, w, h) {
  if (toy.direction === "LEFT") return { x: x + 12, y: y + h / 2 };
  if (toy.direction === "RIGHT") return { x: x + w - 12, y: y + h / 2 };
  if (toy.direction === "UP") return { x: x + w / 2, y: y + 12 };
  return { x: x + w / 2, y: y + h - 12 };
}

function drawToyFace(toy, x, y, face, stroke) {
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

function drawToast(text) {
  ctx.save();
  ctx.font = '600 14px "Microsoft YaHei UI", sans-serif';
  const width = Math.min(430, Math.max(260, ctx.measureText(text).width + 42));
  const x = (W - width) / 2;
  fillRoundRect(x, 798, width, 38, 19, "rgba(65,54,90,.9)", "rgba(255,255,255,.22)", 1);
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff9eb";
  ctx.fillText(text, W / 2, 823);
  ctx.restore();
}

function drawComplete() {
  drawGame();
  ctx.fillStyle = "rgba(43,35,71,.6)";
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.shadowColor = "rgba(22,17,48,.35)";
  ctx.shadowBlur = 30;
  fillRoundRect(64, 267, 412, 390, 36, "#fff7ee", "#efc3cd", 4);
  ctx.restore();
  ctx.textAlign = "center";
  ctx.fillStyle = "#d88aa7";
  ctx.font = '700 20px "Microsoft YaHei UI", sans-serif';
  ctx.fillText("✦  好 梦  ✦", W / 2, 324);
  ctx.fillStyle = "#554668";
  ctx.font = '700 42px Georgia, "Microsoft YaHei UI", serif';
  ctx.fillText("这一屋安静了", W / 2, 382);
  ctx.fillStyle = "#8c798d";
  ctx.font = '500 15px "Microsoft YaHei UI", sans-serif';
  ctx.fillText(`操作 ${state.moves} 次 · 最佳连击 ${state.bestCombo}`, W / 2, 428);
  ctx.fillText(`误点 ${state.blockedCount} 次 · 没有任何惩罚`, W / 2, 455);
  if (state.levelIndex < LEVEL_SPECS.length - 1) {
    drawButton(105, 510, 330, 76, "继续下一关", `前往 ${LEVEL_SPECS[state.levelIndex + 1].id}`, true);
  } else {
    drawButton(105, 510, 330, 76, "看看玩具屋", "第一夜完成", true);
  }
  ctx.fillStyle = "#b096a4";
  ctx.font = '500 12px "Microsoft YaHei UI", sans-serif';
  ctx.fillText("Enter / Space 继续", W / 2, 619);
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
  ctx.fillText("第一夜", W / 2, 342);
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
  ctx.clearRect(0, 0, W, H);
  if (state.mode === "home") drawHome();
  else if (state.mode === "play") drawGame();
  else if (state.mode === "level-complete") drawComplete();
  else drawFinale();
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return { x: ((event.clientX - rect.left) / rect.width) * W, y: ((event.clientY - rect.top) / rect.height) * H };
}

function pointInRect(point, rect) {
  return point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

canvas.addEventListener("pointerup", (event) => {
  event.preventDefault();
  const point = canvasPoint(event);
  if (state.mode === "home") {
    if (pointInRect(point, { x: 100, y: 720, w: 340, h: 126 })) startLevel(state.levelIndex);
    return;
  }
  if (state.mode === "level-complete") {
    if (pointInRect(point, { x: 90, y: 480, w: 360, h: 140 })) advanceAfterComplete();
    return;
  }
  if (state.mode === "finale") {
    if (pointInRect(point, { x: 90, y: 690, w: 360, h: 130 })) {
      state.levelIndex = 0;
      state.mode = "home";
    }
    return;
  }
  const toolButton = TOOL_BUTTONS.find((button) => pointInRect(point, button));
  if (toolButton) {
    if (toolButton.id === "remove" || toolButton.id === "flip") setToolMode(toolButton.id);
    else if (toolButton.id === "shuffle") shuffleDirections();
    else if (toolButton.id === "hint") { cancelToolMode(); hint(); }
    else if (toolButton.id === "restart") restartLevel();
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
  if (state.levelIndex === LEVEL_SPECS.length - 1) {
    state.mode = "finale";
  } else {
    state.levelIndex += 1;
    startLevel(state.levelIndex);
  }
}

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (key === "f") {
    if (document.fullscreenElement) document.exitFullscreen();
    else canvas.requestFullscreen?.();
  } else if (key === "h" && state.mode === "play") hint();
  else if (key === "r" && state.mode === "play") restartLevel();
  else if (key === "1" && state.mode === "play") setToolMode("remove");
  else if (key === "2" && state.mode === "play") shuffleDirections();
  else if (key === "3" && state.mode === "play") setToolMode("flip");
  else if (key === "escape" && state.mode === "play") cancelToolMode();
  else if (key === "a" && state.mode === "play" && new URLSearchParams(location.search).has("qa")) autoClearForQa();
  else if ((key === "enter" || key === " ") && state.mode === "home") startLevel(state.levelIndex);
  else if ((key === "enter" || key === " ") && state.mode === "level-complete") advanceAfterComplete();
});

function renderGameToText() {
  if (state.mode === "home") {
    return JSON.stringify({ mode: "home", title: "晚安，玩具屋", action: "click 准备睡觉 or press Enter", nextLevel: LEVEL_SPECS[state.levelIndex].id });
  }
  if (state.mode === "finale") {
    return JSON.stringify({ mode: "night-complete", chapter: "第一夜", action: "click 回到玩具屋" });
  }
  const remaining = state.toys.filter((toy) => toy.state === "IDLE");
  const scans = new Map(remaining.map((toy) => [toy.id, scanForward(toy, remaining)]));
  const exits = remaining.filter((toy) => scans.get(toy.id).exitsBoard);
  const movable = remaining.filter((toy) => {
    const scan = scans.get(toy.id);
    return scan.exitsBoard || scan.emptySteps > 0;
  });
  return JSON.stringify({
    mode: state.mode,
    coordinateSystem: "14x20 grid; origin top-left; x right; y down; each toy x/y is top-left occupied cell",
    level: LEVEL_SPECS[state.levelIndex].id,
    goal: "click a toy to move forward; it exits when the route reaches the edge, otherwise it stops immediately before the first blocker",
    remaining: remaining.length,
    total: state.initialToys.length,
    combo: state.combo,
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
    message: state.time < state.messageUntil ? state.message : null,
    controls: { removeTwo: "button 1", shuffleFive: "button 2", flipOne: "button 3", hint: "H", restart: "R", cancelTool: "Esc", fullscreen: "F" },
    toys: remaining.map((toy) => {
      const scan = scans.get(toy.id);
      return { id: toy.id, type: toy.toyType, size: toy.sizeType, length: toy.length, x: toy.x, y: toy.y, direction: toy.direction, forwardSpaces: scan.emptySteps, outcome: scan.exitsBoard ? "EXIT" : scan.emptySteps > 0 ? "STOP_AT_BLOCKER" : "BLOCKED", canMove: scan.exitsBoard || scan.emptySteps > 0 };
    }),
  });
}

function autoClearForQa() {
  let guard = 0;
  while (state.mode === "play" && state.toys.some((toy) => toy.state === "IDLE") && guard < 100) {
    const exits = availableToys();
    if (!exits.length) break;
    exits.forEach(activateToy);
    guard += 1;
  }
}

window.render_game_to_text = renderGameToText;
window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i += 1) update(1 / 60);
  render();
};
window.__toyhouse_debug = {
  levels: LEVEL_SPECS.map((_, index) => ({ ...LEVEL_SPECS[index], analysis: buildLevel(index).analysis })),
  startLevel,
  availableIds: () => availableToys().map((toy) => toy.id),
  movableIds: () => movableToys().map((toy) => toy.id),
  clickToy: (id) => activateToy(state.toys.find((toy) => toy.id === id)),
  shuffleDirections,
  flipToy: (id) => flipToy(state.toys.find((toy) => toy.id === id)),
  clearCurrentLevel: autoClearForQa,
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
