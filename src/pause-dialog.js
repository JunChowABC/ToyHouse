import { loadImage } from "./image-loader.js";
import PAUSE_ART from "./pause-art-manifest.js";

const PAUSE_SCALE = Math.min(540 / PAUSE_ART.canvas.width, 960 / PAUSE_ART.canvas.height);
const PAUSE_OFFSET_Y = (960 - PAUSE_ART.canvas.height * PAUSE_SCALE) / 2;
const pauseImages = new Map();
const toolButtonImages = new Map();
const pauseRect = ([x, y, w, h]) => ({ x: x * PAUSE_SCALE, y: y * PAUSE_SCALE + PAUSE_OFFSET_Y, w: w * PAUSE_SCALE, h: h * PAUSE_SCALE });

// The whole settings item is tappable, including its icon, label and switch.
export const PAUSE_UI = Object.freeze({
  music: pauseRect([160, 1054, 205, 72]),
  audio: pauseRect([380, 1054, 195, 72]),
  vibration: pauseRect([595, 1054, 200, 72]),
  resume: pauseRect([239, 746, 466, 124]),
  restart: pauseRect([186, 891, 280, 108]),
  exit: pauseRect([480, 891, 281, 108]),
});

export const TOOL_MODAL_UI = Object.freeze({
  close: pauseRect([706, 476, 96, 96]),
  action: pauseRect([239, 990, 466, 110]),
});

export const HOME_SETTINGS_UI = Object.freeze({
  close: pauseRect([726, 478, 78, 78]),
  music: pauseRect([180, 656, 582, 90]),
  audio: pauseRect([180, 806, 582, 90]),
  vibration: pauseRect([180, 956, 582, 90]),
});

export async function loadPauseArt() {
  const toolButtonsReady = Promise.all(["ui_tool_close_v1", "ui_tool_purchase_disabled_v1"].map(async id => {
    const image = await loadImage(`assets/tool-dialog-v1/${id}.png`);
    toolButtonImages.set(id, image);
  }));
  await Promise.all(Object.entries(PAUSE_ART.assets).map(async ([id, spec]) => {
    const image = await loadImage(`${PAUSE_ART.directory}/${spec.file}`);
    pauseImages.set(id, image);
  }));
  await toolButtonsReady;
}

export function pauseArtStatus() {
  return { version: PAUSE_ART.version, loaded: pauseImages.size, expected: Object.keys(PAUSE_ART.assets).length };
}

function paintPauseText(ctx, spec, text = spec.text, bounds = spec.delivery_bounds, off = false) {
  const [x, y, w, h] = bounds;
  const family = spec.font_family === "STHupo"
    ? 'STHupo, "华文琥珀", "Arial Rounded MT Bold", "Microsoft YaHei", sans-serif'
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
    const match = name.match(/^(?:ui|txt)_pause_(continue|restart|home|music|sound|vibration)(?:_|$)/);
    const key = match && ({ continue: "resume", home: "exit", sound: "audio" }[match[1]] || match[1]);
    if (key) feedback(`pause.${key}`, PAUSE_UI[key], paint);
    else paint();
  };
  PAUSE_ART.staticLayers.forEach(id => paintPart(id, () => image(id)));
  PAUSE_ART.textLayers.forEach(spec => paintPart(spec.name, () => paintPauseText(ctx, spec)));
  for (const control of PAUSE_ART.controls) {
    paintPart(`ui_pause_${control.id}`, () => {
    const enabled = settings[control.setting];
    if (enabled) image(control.onTrack, control.trackBounds);
    else {
      const bounds = [...PAUSE_ART.assets.ui_pause_vibration_track.bounds];
      bounds[0] += control.offOffsetX;
      image("ui_pause_vibration_track", bounds);
    }
    const knob = [...control.knobBounds];
    if (!enabled) knob[0] -= 42;
    image(control.knob, knob);
    const label = [...control.label.delivery_bounds];
    if (!enabled) label[0] += 32;
    paintPauseText(ctx, control.label, enabled ? "开" : "关", label, !enabled);
    });
  }
  ctx.restore();
}

// Home settings shares the same art and saved choices, without in-level actions.
export function drawHomeSettings(ctx, settings, feedback = (id, rect, paint) => paint()) {
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

// Reuse the individual pause resources for all three tool explanations.
export function drawToolDialog(ctx, { title, lines, icon, buying, price, reason }, paintArt, feedback = (id, rect, paint) => paint()) {
  ctx.save();
  ctx.fillStyle = "rgba(100,64,85,.48)";
  ctx.fillRect(0, 0, 540, 960);
  ctx.translate(0, PAUSE_OFFSET_Y);
  ctx.scale(PAUSE_SCALE, PAUSE_SCALE);
  const image = (id, bounds = PAUSE_ART.assets[id].bounds) => ctx.drawImage(pauseImages.get(id), ...bounds);
  const panel = [...PAUSE_ART.assets.ui_pause_panel_base.bounds];
  panel[3] -= 32;
  image("ui_pause_panel_base", panel);
  for (const id of PAUSE_ART.staticLayers) {
    if (!/^ui_pause_(header_|frame_star_|balloon_|hanging_star_|bottom_|sparkle_)/.test(id)) continue;
    const bounds = [...PAUSE_ART.assets[id].bounds];
    if (/bottom/.test(id)) bounds[1] -= 32;
    else if (/balloon_|frame_star_(left|right)/.test(id)) bounds[1] -= 20;
    image(id, bounds);
  }
  const titleSpec = PAUSE_ART.textLayers.find(t => t.name === "txt_pause_title");
  paintPauseText(ctx, titleSpec, title, [346, 474, 250, 88]);

  feedback("tool.close", TOOL_MODAL_UI.close, () => ctx.drawImage(toolButtonImages.get("ui_tool_close_v1"), 706, 476, 96, 96));

  const glow = ctx.createRadialGradient(471, 741, 10, 471, 741, 181);
  glow.addColorStop(0, "rgba(255,193,216,.65)");
  glow.addColorStop(.7, "rgba(255,213,223,.32)");
  glow.addColorStop(1, "rgba(255,235,228,0)");
  ctx.fillStyle = glow;
  ctx.beginPath();ctx.ellipse(471, 741, 180, 119, 0, 0, Math.PI * 2);ctx.fill();
  paintArt(icon, { x: 359, y: 635, w: 224, h: 200 });
  for (const [id, bounds] of [
    ["ui_pause_header_star_left", [310, 708, 38, 39]],
    ["ui_pause_header_star_right", [583, 670, 44, 44]],
    ["ui_pause_frame_star_left_upper", [321, 775, 48, 47]],
    ["ui_pause_header_star_center", [593, 758, 38, 40]],
  ]) image(id, bounds);

  const bodySpec = { font_family: "SimSun", font_size: 34, font_weight: 700, color: "#A4675C" };
  lines.forEach((line, i) => paintPauseText(ctx, bodySpec, line, [233, 870 + i * 46, 475, 45]));
  if (reason && reason !== "金币不足") paintPauseText(ctx, { ...bodySpec, font_size: 22, color: "#B05D76" }, reason, [225, 953, 491, 31]);

  ctx.save();
  feedback("tool.action", TOOL_MODAL_UI.action, () => {
  if (reason) ctx.drawImage(toolButtonImages.get("ui_tool_purchase_disabled_v1"), 239, 990, 466, 110);
  else image("ui_pause_continue_base", [239, 990, 466, 110]);
  ctx.save();
  if (reason) { ctx.filter = "grayscale(1)"; ctx.globalAlpha = .75; }
  image("ui_pause_continue_star_left", [270, 1031, 27, 29]);
  image("ui_pause_continue_star_right", [657, 1031, 27, 29]);
  ctx.restore();
  const actionSpec = { ...bodySpec, font_size: 48, color: reason ? "#F7F6F8" : "#FFFDFA", stroke: { color: reason ? "#918C9B" : "#E6739F", width: 1.4 } };
  if (buying) {
    ctx.save();
    if (reason) { ctx.filter = "grayscale(1)"; ctx.globalAlpha = .75; }
    paintArt("ui_resource_coin_icon_01_instance_01", { x: 346, y: 1016, w: 54, h: 54 });
    ctx.restore();
    paintPauseText(ctx, actionSpec, `${price} 购买`, [407, 1015, 211, 60]);
  } else paintPauseText(ctx, actionSpec, "使用", [356, 1015, 230, 60]);
  });
  ctx.restore();
  ctx.restore();
}
