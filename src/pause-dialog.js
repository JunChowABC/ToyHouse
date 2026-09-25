import { loadImage } from "./image-loader.js";
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
  action: toolRect(TOOL_ART.assets.purchase_base.bounds),
});

export const HOME_SETTINGS_UI = Object.freeze({
  close: pauseRect([726, 478, 78, 78]),
  music: pauseRect([180, 656, 582, 90]),
  audio: pauseRect([180, 806, 582, 90]),
  vibration: pauseRect([180, 956, 582, 90]),
});

export async function loadPauseArt() {
  const toolsReady = Promise.all(Object.entries(TOOL_ART.assets).map(async ([id, spec]) => {
    toolImages.set(id, await loadImage(`${TOOL_ART.directory}/${spec.file}`));
  }));
  const toolButtonsReady = Promise.all(["ui_tool_close_v1", "ui_tool_purchase_disabled_v1"].map(async id => {
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
  ctx.fillStyle = "rgba(100,64,85,.48)";
  ctx.fillRect(0, 0, 540, 960);
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

// Home settings shares the same art and saved choices, without in-level actions.
export function drawHomeSettings(ctx, settings, feedback = (id, rect, paint) => paint()) {
  const PAUSE_ART = SHARED_DIALOG_ART;
  ctx.save();
  ctx.fillStyle = "rgba(100,64,85,.48)";
  ctx.fillRect(0, 0, 540, 960);
  ctx.translate(0, PAUSE_OFFSET_Y);
  ctx.scale(PAUSE_SCALE, PAUSE_SCALE);
  const image = (id, bounds = PAUSE_ART.assets[id].bounds) => ctx.drawImage(pauseImages.get(id), ...bounds);
  image("ui_pause_panel_base");
  for (const id of PAUSE_ART.staticLayers) {
    if (/^ui_pause_(header_|frame_star_|balloon_|hanging_star_|bottom_|sparkle_)/.test(id)) image(id);
  }
  paintPauseText(ctx, PAUSE_ART.textLayers.find(t => t.name === "txt_pause_title"), "设置");
  feedback("settings.close", HOME_SETTINGS_UI.close, () => ctx.drawImage(toolButtonImages.get("ui_tool_close_v1"), 726, 478, 78, 78));
  const rows = [
    ["ui_pause_music_icon", "音乐"], ["ui_pause_sound_icon", "音效"], ["ui_pause_vibration_icon", "震动"],
  ];
  PAUSE_ART.controls.forEach((control, index) => {
    const key = ["music", "audio", "vibration"][index];
    feedback(`settings.${key}`, HOME_SETTINGS_UI[key], () => {
    const y = 670 + index * 150;
    const enabled = settings[control.setting];
    image(rows[index][0], [220, y, 56, 58]);
    paintPauseText(ctx, { font_family: "SimSun", font_weight: 700, font_size: 38, color: "#A4675C" }, rows[index][1], [298, y, 140, 60]);
    image(enabled ? control.onTrack : "ui_pause_vibration_track", [586, y + 4, 120, 66]);
    image(control.knob, [enabled ? 647 : 591, y + 8, 55, 57]);
    paintPauseText(ctx, { ...control.label, font_size: 30 }, enabled ? "开" : "关", [enabled ? 599 : 655, y + 20, 37, 35], !enabled);
    });
  });
  ctx.restore();
}

// Shared frame and geometry come from the approved eliminate popup PSD.
export function drawToolDialog(ctx, { toolId, lines, buying, price, reason }, paintArt, feedback = (id, rect, paint) => paint()) {
  ctx.save();
  ctx.fillStyle = "rgba(100,64,85,.48)";
  ctx.fillRect(0, 0, 540, 960);
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
    if (reason) { ctx.filter = "grayscale(1)"; ctx.globalAlpha = .75; }
    if (buying) TOOL_ART.purchase.forEach(image);
    else image("use_base");
    const purchaseSpec = TOOL_ART.textLayers.find(t => t.name === "txt_purchase");
    if (buying) {
      paintPauseText(ctx, purchaseSpec);
      paintPauseText(ctx, TOOL_ART.textLayers.find(t => t.name === "txt_price"), String(price));
    } else paintPauseText(ctx, { ...purchaseSpec, color: "#FFFDFB", stroke: { color: "#D75587", width: 2 } }, "使用", [360, 1158, 220, 65]);
    ctx.restore();
  });
  ctx.restore();
}
