import { loadImage } from "./image-loader.js";
import HOME_ART from "./home-runtime-manifest.js";

const HOME_SCALE = Math.min(540 / HOME_ART.canvas.width, 960 / HOME_ART.canvas.height);
const HOME_OFFSET_Y = (960 - HOME_ART.canvas.height * HOME_SCALE) / 2;
const homeImages = new Map();
const homeRect = ([x, y, w, h]) => ({ x: x * HOME_SCALE, y: y * HOME_SCALE + HOME_OFFSET_Y, w: w * HOME_SCALE, h: h * HOME_SCALE });
const ENABLED_HOME_CONTROLS = new Set(['start', 'settings']);
// Compact each column independently; disabled entries never reserve a slot.
export function homeEntryOffsets(enabled) {
  const offsets = {};
  for (const [order, step] of [[['task', 'event', 'mail', 'settings'], 134], [['signin', 'album', 'dress'], 138]]) {
    const first = HOME_ART.assets[`ui_${order[0]}_label`].bounds;
    let slot = 0;
    for (const key of order) {
      if (!enabled.has(key)) continue;
      const label = HOME_ART.assets[`ui_${key}_label`].bounds;
      offsets[key] = [first[0] + first[2]/2 - label[0] - label[2]/2, first[1] + slot++ * step - label[1]];
    }
  }
  return offsets;
}
const HOME_ENTRY_OFFSETS = homeEntryOffsets(ENABLED_HOME_CONTROLS);
function placedHomeBounds(bounds, control) {
  const [dx, dy] = HOME_ENTRY_OFFSETS[control] || [0, 0];
  return [bounds[0] + dx, bounds[1] + dy, bounds[2], bounds[3]];
}
export const HOME_UI = Object.freeze(Object.fromEntries(Object.entries(HOME_ART.controls)
  .filter(([key]) => ENABLED_HOME_CONTROLS.has(key)).map(([key, bounds]) => [key, homeRect(placedHomeBounds(bounds, key))])));

export async function loadHomeArt() {
  await Promise.all(Object.entries(HOME_ART.assets).map(async ([id, spec]) => {
    const image = await loadImage(`${HOME_ART.directory}/${spec.file}`);
    homeImages.set(id, image);
  }));
}

export function homeArtStatus() {
  return { version: HOME_ART.version, loaded: homeImages.size, expected: HOME_ART.layers.length, currencySource: HOME_ART.currencySource };
}

function paintHomeText(ctx, spec, text) {
  const [x, y, w, h] = spec.delivery_bounds;
  const family = spec.font_family === "SimSun" ? 'SimSun, "Songti SC", "Noto Serif CJK SC", serif'
    : spec.font_family === "Georgia" ? "Georgia, serif" : '"Microsoft YaHei", "PingFang SC", Arial, sans-serif';
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((spec.rotation || 0) * Math.PI / 180);
  ctx.font = `${spec.italic ? "italic " : ""}${spec.font_weight} ${spec.font_size}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || spec.font_size * .8;
  const descent = metrics.actualBoundingBoxDescent || 0;
  const baseline = (ascent - descent) / 2;
  if (spec.stroke) {
    ctx.strokeStyle = spec.stroke.color;
    ctx.lineWidth = spec.stroke.width * 2;
    ctx.lineJoin = "round";
    ctx.strokeText(text, 0, baseline, w - ctx.lineWidth);
  }
  ctx.fillStyle = spec.color;
  ctx.fillText(text, 0, baseline, w - (spec.stroke?.width || 0) * 2);
  ctx.restore();
}

export function drawHomeScreen(ctx, { progressLabel, complete }, feedback = (id, rect, paint) => paint()) {
  ctx.save();
  ctx.translate(0, HOME_OFFSET_Y);
  ctx.scale(HOME_SCALE, HOME_SCALE);
  for (const id of HOME_ART.layers) {
    if (!homeImages.has(id)) continue;
    const spec = HOME_ART.assets[id];
    if (spec.control && !ENABLED_HOME_CONTROLS.has(spec.control)) continue;
    if (complete && id === 'art_start_title') continue;
    ctx.globalAlpha = spec.opacity * (complete && spec.control === 'start' ? .68 : 1);
    const control = spec.control;
    const paint = () => ctx.drawImage(homeImages.get(id), ...placedHomeBounds(spec.bounds, control));
    if (control) feedback(`home.${control}`, HOME_UI[control], paint);
    else paint();
  }
  ctx.globalAlpha = 1;
  for (const spec of HOME_ART.textLayers) {
    if (spec.control && !ENABLED_HOME_CONTROLS.has(spec.control)) continue;
    const text = spec.name === "txt_date" ? progressLabel
      : spec.name === "txt_sleep" && complete ? "今晚好梦" : spec.text;
    const paint = () => paintHomeText(ctx, { ...spec, delivery_bounds: placedHomeBounds(spec.delivery_bounds, spec.control) }, text);
    if (spec.control) feedback(`home.${spec.control}`, HOME_UI[spec.control], paint);
    else paint();
  }
  if (complete) {
    paintHomeText(ctx, { delivery_bounds: [307, 1280, 313, 70], font_size: 55, font_weight: 700, color: '#FFF5BC', stroke: {color:'#EE70A5',width:3} }, '今晚好梦');
    paintHomeText(ctx, { delivery_bounds: [300, 1445, 350, 42], font_size: 25, font_weight: 700, color: '#914963' }, progressLabel);
  }
  ctx.restore();
}
