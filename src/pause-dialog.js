import { loadImage } from "./image-loader.js";
import { paintDialogBackdrop } from "./ui-motion.js";
import PAUSE_ART from "./pause-art-manifest.js";
import SHARED_DIALOG_ART from "./shared-dialog-art-manifest.js";
import TOOL_ART from "./tool-art-manifest.js";

const PAUSE_SCALE = Math.min(540 / PAUSE_ART.canvas.width, 960 / PAUSE_ART.canvas.height);
const PAUSE_OFFSET_Y = (960 - PAUSE_ART.canvas.height * PAUSE_SCALE) / 2;
const pauseImages = new Map();
const toolButtonImages = new Map();
const toolImages = new Map();
const TOOL_SCALE = Math.min(540 / TOOL_ART.canvas.width, 960 / TOOL_ART.canvas.height);
const TOOL_OFFSET_Y = (960 - TOOL_ART.canvas.height * TOOL_SCALE) / 2;
const toolRect = ([x, y, w, h]) => ({ x: x * TOOL_SCALE, y: y * TOOL_SCALE + TOOL_OFFSET_Y, w: w * TOOL_SCALE, h: h * TOOL_SCALE });
const pauseRect = ([x, y, w, h]) => ({ x: x * PAUSE_SCALE, y: y * PAUSE_SCALE + PAUSE_OFFSET_Y, w: w * PAUSE_SCALE, h: h * PAUSE_SCALE });

// The whole settings item is tappable, including its icon, label and switch.
export const PAUSE_UI = Object.freeze({
  music: pauseRect([248, 594, 449, 73]),
  audio: pauseRect([248, 700, 449, 73]),
  vibration: pauseRect([248, 807, 449, 73]),
  resume: pauseRect([223, 1054, 497, 144]),
  restart: pauseRect([248, 940, 446, 112]),
  exit: pauseRect([248, 1202, 446, 114]),
});

export const TOOL_MODAL_UI = Object.freeze({
  close: toolRect(TOOL_ART.assets.close_base.bounds),
  action: toolRect([204, 1122, 254, 143]),
  ad: toolRect([479, 1122, 254, 143]),
});

const HOME_SETTINGS_SHIFT_Y = 180;
const HOME_SETTINGS_FRAME_HEIGHT = 610;
let homeSettingsFrame = null;
function compactSettingsFrame() {
  if (homeSettingsFrame) return homeSettingsFrame;
  const frame = pauseImages.get('panel_base');
  const [,, width, height] = PAUSE_ART.assets.panel_base.bounds;
  const result = document.createElement('canvas');
  result.width = width;
  result.height = HOME_SETTINGS_FRAME_HEIGHT;
  const painter = result.getContext('2d');
  const top = 160, bottom = 150;
  // Assemble at integer pixel boundaries before scaling the completed frame.
  // Separate screen-space draws can leave fractional-pixel alpha seams.
  for (const [sy, sh, dy, dh] of [[0, top, 0, top], [top, height-top-bottom, top, result.height-top-bottom], [height-bottom, bottom, result.height-bottom, bottom]]) {
    painter.drawImage(frame, 0, sy, width, sh, 0, dy, width, dh);
  }
  result.src = frame.src;
  homeSettingsFrame = result;
  return result;
}
const homeSettingsBounds = ([x, y, w, h]) => [x, y + HOME_SETTINGS_SHIFT_Y, w, h];
export const HOME_SETTINGS_UI = Object.freeze({
  close: pauseRect(homeSettingsBounds(TOOL_ART.assets.close_base.bounds)),
  music: pauseRect(homeSettingsBounds([248, 594, 449, 73])),
  audio: pauseRect(homeSettingsBounds([248, 700, 449, 73])),
  vibration: pauseRect(homeSettingsBounds([248, 807, 449, 73])),
});

export async function loadPauseArt() {
  const toolsReady = Promise.all(Object.entries(TOOL_ART.assets).map(async ([id, spec]) => {
    toolImages.set(id, await loadImage(`${TOOL_ART.directory}/${spec.file}`));
  }));
  const toolButtonsReady = Promise.all(["ui_tool_close_v1", "ui_tool_purchase_disabled_v1", "ui_rewarded_ad_v3", "ui_tool_buy_yellow_v3", "ui_tool_ad_pink_v3"].map(async id => {
    const image = await loadImage(`assets/tool-dialog-v1/${id}.png`);
    toolButtonImages.set(id, image);
  }));
  await Promise.all([PAUSE_ART, SHARED_DIALOG_ART].flatMap(art => Object.entries(art.assets).map(async ([id, spec]) => {
    const image = await loadImage(`${art.directory}/${spec.file}`);
    pauseImages.set(id, image);
  })));
  await toolButtonsReady;
  await toolsReady;
}

export function pauseArtStatus() {
  return { version: PAUSE_ART.version, loaded: Object.keys(PAUSE_ART.assets).filter(id => pauseImages.has(id)).length, expected: Object.keys(PAUSE_ART.assets).length };
}

function paintPauseText(ctx, spec, text = spec.text, bounds = spec.delivery_bounds, off = false) {
  const [x, y, w, h] = bounds;
  const family = spec.font_family === "STHupo"
    ? 'STHupo, "华文琥珀", "Arial Rounded MT Bold", "Microsoft YaHei", sans-serif'
    : spec.font_family === "Microsoft YaHei" ? '"Microsoft YaHei", "Noto Sans CJK SC", sans-serif'
    : 'SimSun, "Songti SC", "Noto Serif CJK SC", serif';
  ctx.font = `${spec.font_weight} ${spec.font_size}px ${family}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const metrics = ctx.measureText(text);
  const ascent = metrics.actualBoundingBoxAscent || spec.font_size * .8;
  const descent = metrics.actualBoundingBoxDescent || 0;
  const baseline = y + (h - ascent - descent) / 2 + ascent;
  ctx.lineJoin = "round";
  if (spec.stroke) {
    ctx.strokeStyle = off ? "#9F99A8" : spec.stroke.color;
    ctx.lineWidth = spec.stroke.width * 2;
    ctx.strokeText(text, x + w / 2, baseline, w - ctx.lineWidth);
  }
  ctx.fillStyle = off ? "#FFFFFF" : spec.color;
  ctx.fillText(text, x + w / 2, baseline, w - (spec.stroke?.width || 0) * 2);
}

export function drawPauseDialog(ctx, settings, feedback = (id, rect, paint) => paint()) {
  ctx.save();
  paintDialogBackdrop(ctx, "rgba(100,64,85,.48)");
  ctx.translate(0, PAUSE_OFFSET_Y);
  ctx.scale(PAUSE_SCALE, PAUSE_SCALE);
  const image = (id, bounds = PAUSE_ART.assets[id].bounds) => {
    ctx.drawImage(pauseImages.get(id), ...bounds);
  };
  const paintPart = (name, paint) => {
    const match = name.match(/^(?:(?:arttext|txt)_)?(continue|restart|exit|music|sound|vibration)(?:_|$)/);
    const key = match && ({ continue: "resume", sound: "audio" }[match[1]] || match[1]);
    if (key) feedback(`pause.${key}`, PAUSE_UI[key], paint);
    else paint();
  };
  PAUSE_ART.staticLayers.forEach(id => paintPart(id, () => image(id)));
  PAUSE_ART.textLayers.forEach(spec => paintPart(spec.name, () => paintPauseText(ctx, spec)));
  for (const control of PAUSE_ART.controls) {
    paintPart(control.id, () => {
      const enabled = settings[control.setting];
      image(enabled ? control.onTrack : control.offTrack, control.trackBounds);
      image(enabled ? control.onThumb : control.offThumb, enabled ? control.onThumbBounds : control.offThumbBounds);
      image(enabled ? control.onStar : control.offStar, enabled ? control.onStarBounds : control.offStarBounds);
    });
  }
  ctx.restore();
}

// Reuse the current pause artwork, with a shorter frame for the three settings.
export function drawHomeSettings(ctx, settings, feedback = (id, rect, paint) => paint()) {
  ctx.save();
  paintDialogBackdrop(ctx, "rgba(100,64,85,.48)");
  ctx.translate(0, PAUSE_OFFSET_Y);
  ctx.scale(PAUSE_SCALE, PAUSE_SCALE);
  const image = (id, bounds = PAUSE_ART.assets[id].bounds) => ctx.drawImage(pauseImages.get(id), ...homeSettingsBounds(bounds));
  // Preserve the frame's top/bottom corners; only shorten its neutral middle.
  const [fx, fy, fw, fh] = PAUSE_ART.assets.panel_base.bounds;
  const height = HOME_SETTINGS_FRAME_HEIGHT;
  ctx.drawImage(compactSettingsFrame(), fx, fy+HOME_SETTINGS_SHIFT_Y, fw, height);
  const rowParts = /^(music|sound|vibration)_icon$/;
  for (const id of PAUSE_ART.staticLayers) {
    if (id === 'panel_base' || rowParts.test(id) || /^(arttext_|restart_|continue_|exit_)/.test(id)) continue;
    const bounds = [...PAUSE_ART.assets[id].bounds];
    if (id.startsWith('star_bottom_')) bounds[1] += height - fh;
    image(id, bounds);
  }
  paintPauseText(ctx, { font_family: 'Microsoft YaHei', font_weight: 700, font_size: 66, color: '#B47BC4', stroke: { color: '#FFF9FE', width: 3 } }, '设置', homeSettingsBounds([384, 416, 178, 79]));
  feedback('settings.close', HOME_SETTINGS_UI.close, () => {
    TOOL_ART.close.forEach(id => ctx.drawImage(toolImages.get(id), ...homeSettingsBounds(TOOL_ART.assets[id].bounds)));
  });
  for (const control of PAUSE_ART.controls) {
    const key = control.id === 'sound' ? 'audio' : control.id;
    feedback(`settings.${key}`, HOME_SETTINGS_UI[key], () => {
      image(`${control.id}_icon`);
      const label = PAUSE_ART.textLayers.find(t => t.name === `txt_${control.id}`);
      paintPauseText(ctx, label, label.text, homeSettingsBounds(label.delivery_bounds));
      const enabled = settings[control.setting];
      image(enabled ? control.onTrack : control.offTrack, control.trackBounds);
      image(enabled ? control.onThumb : control.offThumb, enabled ? control.onThumbBounds : control.offThumbBounds);
      image(enabled ? control.onStar : control.offStar, enabled ? control.onStarBounds : control.offStarBounds);
    });
  }
  ctx.restore();
}

// Shared frame and geometry come from the approved eliminate popup PSD.
export function drawToolDialog(ctx, { toolId, lines, buying, price, reason, adPending, adMessage }, paintArt, feedback = (id, rect, paint) => paint()) {
  ctx.save();
  paintDialogBackdrop(ctx, "rgba(100,64,85,.48)");
  ctx.translate(0, TOOL_OFFSET_Y);
  ctx.scale(TOOL_SCALE, TOOL_SCALE);
  const image = id => ctx.drawImage(toolImages.get(id), ...TOOL_ART.assets[id].bounds);
  TOOL_ART.common.forEach(image);
  TOOL_ART.icons[toolId].forEach(image);
  const title = TOOL_ART.titles[toolId];
  if (title) image(title);
  else paintPauseText(ctx, TOOL_ART.textLayers.find(t => t.name === "txt_title"));
  feedback("tool.close", TOOL_MODAL_UI.close, () => TOOL_ART.close.forEach(image));

  const bodySpec = { font_family: "Microsoft YaHei", font_size: 30, font_weight: 700, color: "#AD76B2" };
  lines.forEach((line, i) => paintPauseText(ctx, bodySpec, line, [227, 1002 + i * 39, 485, 39]));
  if (reason && reason !== "金币不足") paintPauseText(ctx, { ...bodySpec, font_size: 22, color: "#B05D76" }, reason, [225, 1098, 491, 24]);

  feedback("tool.action", TOOL_MODAL_UI.action, () => {
    ctx.save();
    if (reason || adPending) { ctx.filter = "grayscale(1)"; ctx.globalAlpha *= .75; }
    ctx.drawImage(toolButtonImages.get("ui_tool_buy_yellow_v3"), 204, 1122, 254, 143);
    const label = { ...bodySpec, font_size: 33, color: "#AC77AE", stroke: { color: "#FFFCF5", width: 1.5 } };
    if (buying) {
      paintPauseText(ctx, label, "购买", [240, 1148, 180, 43]);
      ctx.drawImage(toolImages.get("purchase_coin"), 270, 1196, 35, 36);
      paintPauseText(ctx, { ...label, font_size: 28 }, String(price), [310, 1193, 80, 40]);
    } else paintPauseText(ctx, label, "使用", [240, 1159, 180, 65]);
    ctx.restore();
  });
  feedback("tool.ad", TOOL_MODAL_UI.ad, () => {
    ctx.save();
    ctx.filter = adPending ? "grayscale(1)" : "none";
    ctx.globalAlpha *= adPending ? .75 : 1;
    ctx.drawImage(toolButtonImages.get("ui_tool_ad_pink_v3"), 479, 1122, 254, 143);
    ctx.filter = "none";
    ctx.drawImage(toolButtonImages.get("ui_rewarded_ad_v3"), 498, 1152, 72, 72);
    const label = { ...bodySpec, color: "#B575A1", font_size: 32, stroke: { color: "#FFF8FC", width: 1.5 } };
    paintPauseText(ctx, label, adPending ? "观看中" : "看广告", [571, 1147, 138, 45]);
    paintPauseText(ctx, { ...label, font_size: 24 }, "获得 1 个", [565, 1195, 150, 35]);
    ctx.restore();
  });
  if (adMessage) paintPauseText(ctx, { ...bodySpec, font_size: 21, color: "#98669F" }, adMessage, [205, 1274, 531, 30]);
  ctx.restore();
}
