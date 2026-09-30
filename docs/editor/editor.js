import M from '../src/mechanics.js';
import CONFIG from '../src/level-config.js';
const $ = id => document.getElementById(id), canvas = $('board'), ctx = canvas.getContext('2d');
const labels = { BOX: '纸箱', SLEEPING: '睡眠', SPRING: '弹簧', HUG: '抱抱', KEY_LOCK: '钥匙 / 锁盒', PORTAL: '传送门', FROZEN: '冰块', ONE_WAY_EXIT: '单向出口', CONVEYOR: '传送带', ROTATOR: '旋转区域' };
let config, board, selection = null, playing = false, history = [], solution = [], step = 0, task = null, graphMode = false, releaseEdges = [];
for (const l of CONFIG.levels) $('level').add(new Option(`${l.level_no} · ${l.display_title || l.level_name}`, l.level_no));
for (const [id, text] of Object.entries(labels)) {
  const label = document.createElement('label'), input = document.createElement('input'); input.type = 'checkbox'; input.value = id; label.append(input, document.createTextNode(text)); $('pool').append(label);
}
function load(value) {
  config = M.copy(value); board = M.fromConfig(config); selection = null; history = []; step = 0; solution = config.solution || [];
  releaseEdges = [];
  $('summary').textContent = `${board.toys.length} 只玩具 · ${board.entities.length} 个盘面物件`;
  for (const input of $('pool').querySelectorAll('input')) input.checked = (config.mechanic_pool || ['BOX']).includes(input.value);
  $('report').textContent = config.validation ? JSON.stringify(config.validation, null, 2) : '尚未分析';
  $('properties').hidden = true; draw();
  $('entityList').replaceChildren(new Option('选择盘面物件', ''));
  for (const e of board.entities) $('entityList').add(new Option(`${labels[e.kind] || e.kind} · ${e.id}`, e.id));
}
function draw() {
  const cell = canvas.width / board.cols; canvas.height = board.rows * cell;
  ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let y = 0; y < board.rows; y++) for (let x = 0; x < board.cols; x++) { ctx.strokeStyle = '#e1d5df'; ctx.strokeRect(x * cell, y * cell, cell, cell); }
  for (const e of [...board.entities, ...board.toys].filter(M.active)) {
    const maxX = Math.max(...e.cells.map(c => c.x)), maxY = Math.max(...e.cells.map(c => c.y));
    const colors = { BOX: '#d9b286', SPRING: '#bdc5e9', LOCK_BOX: '#f0d287', PORTAL: '#c5ace1', CONVEYOR: '#d0ece1', ROTATOR: '#e4d6f4', ONE_WAY_EXIT: '#a9dcb7', ORDINARY: '#f5d5df', AUTO_EXIT: '#f3dd93', LARGE: '#bcd5e3' };
    ctx.fillStyle = colors[e.kind || e.archetypeId]; ctx.strokeStyle = e.id === selection ? '#754b9c' : '#ad96a9'; ctx.lineWidth = e.id === selection ? 3 : 1;
    ctx.beginPath(); ctx.roundRect(e.x * cell + 3, e.y * cell + 3, (maxX - e.x + 1) * cell - 6, (maxY - e.y + 1) * cell - 6, 9); ctx.fill(); ctx.stroke();
    if (['CONVEYOR', 'ROTATOR'].includes(e.kind)) { ctx.fillStyle = '#817694'; ctx.font = 'bold 11px system-ui'; ctx.fillText(`${labels[e.kind]} ${e.period - e.phase}`, (e.x + 1.5) * cell, e.y * cell + 10); ctx.font = 'bold 14px system-ui'; }
    if (e.ice > 0) { ctx.fillStyle = '#a9ddf4'; ctx.fillRect(e.x * cell + 5, e.y * cell + 5, (maxX - e.x + 1) * cell - 10, (maxY - e.y + 1) * cell - 10); }
    ctx.fillStyle = '#624a62'; const symbol = e.kind === 'BOX' ? `箱${e.hp}` : e.kind === 'SPRING' ? '≋' : e.kind === 'LOCK_BOX' ? '▤' : e.kind === 'PORTAL' ? '◎' : e.sleeping ? `Zz ${e.sleepRemaining}` : e.hugLocked ? '♥' : e.keyId ? '⚿' : { LEFT: '←', RIGHT: '→', UP: '↑', DOWN: '↓' }[e.direction] || '◇';
    ctx.fillText(e.ice > 0 ? `冰${e.ice}` : e.kind === 'ROTATOR' ? e.clockwise ? '↻' : '↺' : symbol, (e.x + (maxX - e.x + 1) / 2) * cell, (e.y + (maxY - e.y + 1) / 2) * cell);
  }
  if (graphMode) drawGraph();
}
function drawGraph() {
  const edges = [...M.graph(board), ...releaseEdges], nodes = [...new Set(edges.flatMap(e => [e.source, e.target]))];
  const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
  const defs = document.createElementNS(NS, 'defs'), marker = document.createElementNS(NS, 'marker'), arrow = document.createElementNS(NS, 'path');
  for (const [k, v] of Object.entries({ id: 'arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' })) marker.setAttribute(k, v);
  arrow.setAttribute('d', 'M0 0L10 5L0 10Z'); arrow.setAttribute('fill', '#a779b9'); marker.append(arrow); defs.append(marker); svg.append(defs);
  svg.setAttribute('viewBox', `0 0 560 ${Math.max(756, Math.ceil(nodes.length / 3) * 70)}`);
  const positions = new Map(nodes.map((id, i) => [id, { x: 20 + (i % 3) * 182, y: 24 + Math.floor(i / 3) * 70 }]));
  for (const e of edges) {
    const a = positions.get(e.source), b = positions.get(e.target), line = document.createElementNS(NS, 'path');
    line.setAttribute('d', `M${a.x + 72},${a.y + 13} L${b.x + 72},${b.y + 13}`); line.setAttribute('stroke', e.type === 'BLOCKS' ? '#bbb0be' : '#a779b9');
    if (e.type === 'ACTION_RELEASES') line.setAttribute('stroke', '#609e88');
    line.setAttribute('marker-end', 'url(#arrow)');
    if (e.type !== 'BLOCKS') line.setAttribute('stroke-dasharray', '5 4');
    if (selection && [e.source, e.target].includes(selection)) line.setAttribute('stroke-width', '3');
    const title = document.createElementNS(NS, 'title'); title.textContent = `${e.source} —${e.type}→ ${e.target}`; line.append(title); svg.append(line);
  }
  for (const [id, p] of positions) {
    const rect = document.createElementNS(NS, 'rect'); for (const [k, v] of Object.entries({ x: p.x, y: p.y, width: 145, height: 27, rx: 8, fill: id === selection ? '#dcc5ed' : '#f2e9f6', stroke: '#baa0c8' })) rect.setAttribute(k, v);
    const text = document.createElementNS(NS, 'text'); text.setAttribute('x', p.x + 72); text.setAttribute('y', p.y + 18); text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', '10'); text.textContent = id;
    svg.append(rect, text);
  }
  $('graph').replaceChildren(svg);
}
function eventsText(events) { return events.map((e, i) => `${i + 1}. ${e.source} → ${e.type}${e.target ? ` → ${e.target}` : ''}`).join('\n') || '本次操作没有可结算事件。'; }
function execute(id) {
  history.push(M.copy(board)); const result = M.click(board, id); $('events').textContent = eventsText(result.events); draw();
  if (board.toys.every(t => !M.active(t))) $('status').textContent = '盘面已清空，障碍物不计入通关数量。';
}
function inspect(id) {
  selection = id; const toy = config.toy_list.find(t => t.toy_id === id), entity = config.board_entities?.find(e => e.entity_id === id), e = toy || entity;
  $('selected').textContent = id; $('properties').hidden = !e; if (!e) return;
  $('x').value = e.grid_position[0]; $('y').value = e.grid_position[1]; $('direction').value = ({ LEFT: 'L', RIGHT: 'R', UP: 'U', DOWN: 'D' }[e.direction] || e.direction || ''); $('modifier').value = e.modifier || '';
  $('source').value = e.hug_source || ''; $('wakeAfterExits').value = e.wake_after_exits || 3; $('pair').value = e.pair_id || ''; $('key').value = e.key_id || ''; $('hp').value = e.hp || 2;
  $('ice').value = e.ice_layers || 1; $('period').value = e.period || 1; $('clockwise').value = String(e.clockwise !== false);
  $('regionWidth').value = e.footprint?.[0] || 1; $('regionHeight').value = e.footprint?.[1] || 1;
  for (const field of ['direction', 'modifier']) $(field).disabled = !toy;
  $('source').disabled = !toy || e.modifier !== 'HUG_LOCKED';
  $('wakeAfterExits').disabled = !toy || e.modifier !== 'SLEEPING';
  $('modifier').onchange = () => { $('source').disabled = $('modifier').value !== 'HUG_LOCKED'; $('wakeAfterExits').disabled = $('modifier').value !== 'SLEEPING'; };
  $('direction').disabled = !toy && !['CONVEYOR', 'ONE_WAY_EXIT'].includes(e.kind);
  $('ice').disabled = !toy;
  for (const field of ['regionWidth', 'regionHeight', 'period', 'clockwise']) $(field).disabled = !['CONVEYOR', 'ROTATOR'].includes(e.kind);
  $('hp').disabled = entity?.kind !== 'BOX';
  $('events').textContent = M.graph(board).filter(e => [e.source, e.target].includes(id)).map(e => `${e.source} —${e.type}→ ${e.target}`).join('\n') || '当前无直接依赖。'; draw();
}
canvas.onclick = event => {
  const rect = canvas.getBoundingClientRect(), x = Math.floor((event.clientX - rect.left) / rect.width * board.cols), y = Math.floor((event.clientY - rect.top) / rect.height * board.rows);
  const e = [...board.toys, ...board.entities].find(e => M.active(e) && e.cells.some(c => c.x === x && c.y === y));
  if (!e) return; inspect(e.id); if (playing && !e.kind) execute(e.id);
};
$('properties').onsubmit = event => {
  event.preventDefault(); const draft = M.copy(config), e = [...draft.toy_list, ...(draft.board_entities || [])].find(e => (e.toy_id || e.entity_id) === selection);
  e.grid_position = [Number($('x').value), Number($('y').value)];
  if (e.toy_id) {
    e.direction = $('direction').value || null; e.modifier = $('modifier').value || undefined;
    e.ice_layers = e.modifier === 'FROZEN' ? Number($('ice').value) : undefined;
    delete e.wake_source;
    e.wake_after_exits = e.modifier === 'SLEEPING' ? Number($('wakeAfterExits').value) : undefined;
    e.hug_source = e.modifier === 'HUG_LOCKED' ? $('source').value : undefined;
    const length = { ORDINARY: 2, LARGE: 3, AUTO_EXIT: 1 }[e.archetype_id]; e.footprint = ['L', 'R'].includes(e.direction) ? [length, 1] : [1, length];
  }
  if (e.kind === 'CONVEYOR' || e.kind === 'ONE_WAY_EXIT') e.direction = $('direction').value;
  if (['CONVEYOR', 'ROTATOR'].includes(e.kind)) { e.footprint = [Number($('regionWidth').value), Number($('regionHeight').value)]; e.period = Number($('period').value); e.phase = 0; e.clockwise = $('clockwise').value === 'true'; }
  e.pair_id = $('pair').value || undefined; e.key_id = $('key').value || undefined; if (e.kind === 'BOX') e.hp = Number($('hp').value);
  const errors = M.validate(M.fromConfig(draft)); if (errors.length) { $('status').textContent = errors.join('\n'); return; }
  delete draft.solution; delete draft.validation; load(draft); $('status').textContent = '修改已应用；需重新求解验证。';
};
function run(type) {
  if (task) { task.terminate(); task = null; }
  $('status').textContent = '正在计算… 再次点击可重新开始；搜索耗尽会明确标记未知。';
  const worker = task = new Worker('./worker.js', { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (worker !== task) return;
    worker.terminate(); task = null;
    if (data.error) { $('status').textContent = data.error; return; }
    if (type !== 'analyze') load(data.result.config);
    const report = data.result.report || data.result; solution = report.actions; step = 0;
    releaseEdges = report.releaseGraph || []; if (graphMode) drawGraph();
    const initialBoard = M.fromConfig(config); M.settle(initialBoard);
    if (report.solvable && M.hash(initialBoard) === M.hash(board)) {
      config.solution = report.actions;
      config.validation = { status: report.status, nodes: report.nodes, initialExitCount: report.initialExitCount, mechanicDensity: report.mechanicDensity };
    }
    $('report').textContent = JSON.stringify({ status: report.status, toyCount: report.toyCount, initialExitCount: report.initialExitCount, occupancy: report.occupancy,
      mechanicDensity: report.mechanicDensity, maxCascade: report.maxCascade, cascadeDepth: report.cascadeDepth, observedDependencyDepth: report.observedDependencyDepth, shiftSafety: report.shiftSafety,
      target: config.generation_targets || null, nodes: report.nodes }, null, 2);
    $('status').textContent = report.status === 'SOLVED' ? '无道具解法已找到。难度/连锁目标请对照实测报告。' : report.status === 'UNKNOWN' ? '搜索预算耗尽，不能认定有解或死锁。' : '存在配置错误或已证实无解。';
  };
  worker.onerror = event => { $('status').textContent = event.message; worker.terminate(); task = null; };
  worker.postMessage({ type, board, config, seed: Number($('seed').value), maxNodes: Number($('limit').value), pool: [...$('pool').querySelectorAll('input:checked')].map(i => i.value), difficulty: $('difficulty').value, cascade: $('cascade').value });
}
$('level').onchange = () => { if (task) { task.terminate(); task = null; } load(CONFIG.levels[Number($('level').value) - 1]); };
  $('reset').onclick = () => { if (task) { task.terminate(); task = null; } load(config); };
$('play').onclick = () => { playing = !playing; $('play').textContent = `试玩：${playing ? '开启' : '关闭'}`; };
$('undo').onclick = () => { if (history.length) { board = history.pop(); solution = []; step = 0; draw(); } };
$('preview').onclick = () => { if (!selection) return; const result = M.click(M.copy(board), selection); $('events').textContent = eventsText(result.events); };
$('next').onclick = () => { if (step < solution.length) execute(solution[step++]); else $('status').textContent = '解法已结束，或当前盘面需要重新分析。'; };
$('boardTab').onclick = () => { graphMode = false; canvas.hidden = false; $('graph').hidden = true; };
$('graphTab').onclick = () => { graphMode = true; canvas.hidden = true; $('graph').hidden = false; drawGraph(); };
$('analyze').onclick = () => run('analyze'); $('generate').onclick = () => run('generate'); $('optimize').onclick = () => run('optimize');
$('export').onclick = () => { const url = URL.createObjectURL(new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `${config.level_id}-v1.4.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
$('import').onchange = async () => {
  try { const value = JSON.parse(await $('import').files[0].text()), errors = M.validate(M.fromConfig(value)); if (errors.length) throw new Error(errors.join(', ')); load(value); $('status').textContent = '导入成功，请重新分析。'; }
  catch (error) { $('status').textContent = `导入失败：${error.message}`; }
};
$('level').value = '21'; load(CONFIG.levels[20] || CONFIG.levels[0]);
$('entityList').onchange = () => { if ($('entityList').value) inspect($('entityList').value); };
$('addEntity').onclick = () => {
  const draft = M.copy(config), kind = $('newKind').value, id = `${config.level_id}_${kind}_${Date.now()}`;
  draft.board_entities ||= [];
  draft.board_entities.push({ entity_id: id, kind, grid_position: [0, 0], footprint: kind === 'PORTAL' ? [2, 2] : kind === 'ONE_WAY_EXIT' ? [1, 1] : [3, 3], direction: 'R', period: 1, clockwise: true });
  delete draft.solution; delete draft.validation; load(draft); inspect(id); $('status').textContent = '请调整位置和尺寸后应用修改；新布局必须重新校验。';
};
