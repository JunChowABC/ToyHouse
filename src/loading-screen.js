import { fillViewport, drawRoomBackground } from "./viewport.js";
import LOADING_ART from "./loading-art-manifest.js";
import { loadImage } from "./image-loader.js";

const loadingImages = new Map();
let loadingPromise = null;
const fullLoadingImages = new Set();
const inlineLoadingReady = Promise.all(["background", "atlas"].map(key => new Promise(resolve => {
  const image = new Image();
  image.onload = () => {
    if (!fullLoadingImages.has(key)) loadingImages.set(key, image);
    resolve();
  };
  image.onerror = resolve;
  image.src = LOADING_ART[key === "background" ? "fallbackBackground" : "fallbackAtlas"];
})));
const LOADING_SCALE = Math.min(540 / LOADING_ART.canvas[0], 960 / LOADING_ART.canvas[1]);
const LOADING_OFFSET_Y = (960 - LOADING_ART.canvas[1] * LOADING_SCALE) / 2;

export function loadLoadingArt() {
  if (loadingPromise) return inlineLoadingReady;
  loadingPromise = Promise.all(["background", "atlas"].map(async key => {
    loadingImages.set(key, await loadImage(key === "background" ? "assets/runtime-ui/tall-loading-v1.webp" : `${LOADING_ART.directory}/${LOADING_ART[key]}`));
    fullLoadingImages.add(key);
  })).catch(() => { loadingPromise = null; }); // Decorative loading art never blocks the room.
  return inlineLoadingReady;
}

export function loadingArtStatus() {
  return { loaded: loadingImages.size, expected: 2, fullResolutionLoaded: fullLoadingImages.size, version: LOADING_ART.version };
}

export function drawLoadingScreen(ctx, { progress = 0, error = false } = {}) {
  const fraction = Math.max(0, Math.min(1, progress));
  ctx.fillStyle = "#fae7e4";
  fillViewport(ctx);
  drawRoomBackground(ctx, loadingImages.get("background"));
  ctx.save();
  ctx.translate(0, LOADING_OFFSET_Y);
  ctx.scale(LOADING_SCALE, LOADING_SCALE);
  const atlas = loadingImages.get("atlas");
  // Background covers the viewport independently of the foreground artwork.
  const draw = (id, bounds = LOADING_ART.assets[id].bounds) => {
    if (atlas) ctx.drawImage(atlas, ...LOADING_ART.assets[id].rect, ...bounds);
  };
  const track = LOADING_ART.assets.ui_progress_track.bounds;
  const fill = LOADING_ART.assets.ui_progress_fill;
  const [tx, ty, tw, th] = track;
  for (const id of LOADING_ART.layers) {
    if (id === "art_loading_background") continue;
    if (id === "ui_progress_fill") {
      if (!atlas || fraction <= 0) continue;
      ctx.save();
      ctx.beginPath(); ctx.roundRect(tx + 2, ty + 2, tw - 4, th - 4, (th - 4) / 2); ctx.clip();
      ctx.beginPath(); ctx.rect(tx + 2, ty, (tw - 4) * fraction, th); ctx.clip();
      // Remove PNG padding and fit the fill to the slot's inner edges.
      // Keep stripe width unchanged; only expand its height to fill the slot.
      const [sx, sy, sw, sh] = fill.rect;
      ctx.drawImage(atlas, sx + 2, sy + 2, sw - 4, sh - 4,
        tx + 2, ty + 2, sw - 4, th - 4);
      for (let x = tx + 2 + sw - 4; x < tx + tw; x += sw - 36) {
        ctx.drawImage(atlas, sx + 34, sy + 2, sw - 36, sh - 4,
          x, ty + 2, sw - 36, th - 4);
      }
      ctx.restore();
    } else if (id === "ui_progress_star") {
      if (fraction <= 0) continue;
      const [x, y, w, h] = LOADING_ART.assets[id].bounds;
      const center = tx + 2 + (tw - 4) * fraction;
      draw(id, [Math.max(tx + 2, Math.min(tx + tw - w - 2, center - w / 2)), y, w, h]);
    } else draw(id);
  }
  const hint = LOADING_ART.text;
  const [x, y, w, h] = hint.delivery_bounds;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = `700 ${hint.font_size}px "Microsoft YaHei", sans-serif`;
  ctx.lineJoin = "round"; ctx.strokeStyle = hint.stroke.color; ctx.lineWidth = hint.stroke.width * 2;
  const text = error ? "暂时没准备好，请重试一下吧～" : hint.text;
  ctx.strokeText(text, x + w / 2, y + h / 2, w);
  ctx.fillStyle = hint.color; ctx.fillText(text, x + w / 2, y + h / 2, w);
  if (!atlas) {
    ctx.font = '700 34px "Microsoft YaHei", sans-serif';
    ctx.fillText(error ? "暂时没准备好，请重试" : "正在布置玩具屋…", 470.5, 1320);
    ctx.fillStyle = "#efd0e7"; ctx.fillRect(170, 1390, 600, 34);
    ctx.fillStyle = "#eb80b9"; ctx.fillRect(170, 1390, 600 * fraction, 34);
  }
  ctx.restore();
}
