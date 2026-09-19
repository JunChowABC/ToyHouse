import { loadImage } from "./image-loader.js";
import HOME_ART from "./home-art-manifest.js";

const HOME_SCALE = Math.min(540 / HOME_ART.canvas.width, 960 / HOME_ART.canvas.height);
const HOME_OFFSET_Y = (960 - HOME_ART.canvas.height * HOME_SCALE) / 2;
const homeImages = new Map();
const homeRect = ([x, y, w, h]) => ({ x: x * HOME_SCALE, y: y * HOME_SCALE + HOME_OFFSET_Y, w: w * HOME_SCALE, h: h * HOME_SCALE });
export const HOME_UI = Object.freeze({
  start: homeRect(HOME_ART.assets.ui_sleep_outer.bounds),
  settings: homeRect([18, 40, 96, 118]),
});

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
    : spec.font_family === "Georgia" ? "Georgia, serif" : "Arial, sans-serif";
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
    ctx.globalAlpha = spec.opacity * (complete && id.startsWith("ui_sleep_") ? .68 : 1);
    const control = id.startsWith("ui_sleep_") ? "start" : id.startsWith("ui_settings_") ? "settings" : null;
    const paint = () => ctx.drawImage(homeImages.get(id), ...spec.bounds);
    if (control) feedback(`home.${control}`, HOME_UI[control], paint);
    else paint();
  }
  ctx.globalAlpha = 1;
  for (const spec of HOME_ART.textLayers) {
    const text = spec.name === "txt_date" ? progressLabel
      : spec.name === "txt_sleep" && complete ? "今晚好梦" : spec.text;
    const paint = () => paintHomeText(ctx, spec, text);
    if (spec.name === "txt_sleep") feedback("home.start", HOME_UI.start, paint);
    else paint();
  }
  ctx.restore();
}
