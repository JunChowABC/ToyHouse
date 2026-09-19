import COMPLETE_ART from "./complete-art-manifest.js";

const COMPLETE_SCALE = Math.min(540 / COMPLETE_ART.canvas.width, 960 / COMPLETE_ART.canvas.height);
const COMPLETE_OFFSET_Y = (960 - COMPLETE_ART.canvas.height * COMPLETE_SCALE) / 2;
const completeImages = new Map();
const completeRect = ([x, y, w, h]) => ({ x: x * COMPLETE_SCALE, y: y * COMPLETE_SCALE + COMPLETE_OFFSET_Y, w: w * COMPLETE_SCALE, h: h * COMPLETE_SCALE });
const completeText = Object.fromEntries(COMPLETE_ART.textLayers.map(spec => [spec.name, spec]));
const COMPLETE_REWARD_ART = Object.freeze({
  coins: { card: "ui_reward_card_coin", icon: "ui_coin", text: "txt_coin_count" },
  stars: { card: "ui_reward_card_star", icon: "ui_rainbow_star", text: "txt_star_count" },
});

export const COMPLETE_UI = Object.freeze({
  home: completeRect(COMPLETE_ART.assets.ui_button_home.bounds),
  next: completeRect(COMPLETE_ART.assets.ui_button_next.bounds),
});

export async function loadCompleteArt() {
  await Promise.all(Object.entries(COMPLETE_ART.assets).map(async ([id, spec]) => {
    const image = new Image();
    image.src = new URL(`${COMPLETE_ART.directory}/${spec.file}`, document.baseURI).href;
    await image.decode();
    completeImages.set(id, image);
  }));
}

export function completeArtStatus() {
  return { version: COMPLETE_ART.version, loaded: completeImages.size, expected: Object.keys(COMPLETE_ART.assets).length };
}

// Center the entire reward row, moving card, icon and amount together.
// Zero/invalid amounts never reserve an invisible slot.
export function completionRewardLayout(rewards) {
  const amounts = new Map();
  for (const reward of rewards || []) {
    if (!COMPLETE_REWARD_ART[reward.type] || !Number.isSafeInteger(reward.amount) || reward.amount <= 0) continue;
    const amount = (amounts.get(reward.type) || 0) + reward.amount;
    if (Number.isSafeInteger(amount)) amounts.set(reward.type, amount);
  }
  return [...amounts].map(([type, amount], index, row) => {
    const spec = COMPLETE_REWARD_ART[type];
    const card = [...COMPLETE_ART.assets[spec.card].bounds];
    const centerX = COMPLETE_ART.canvas.width / 2 + (index - (row.length - 1) / 2) * 209;
    const dx = centerX - card[0] - card[2] / 2;
    const shift = bounds => [bounds[0] + dx, ...bounds.slice(1)];
    return { type, amount, ...spec, cardBounds: shift(card), iconBounds: shift(COMPLETE_ART.assets[spec.icon].bounds), textBounds: shift(completeText[spec.text].delivery_bounds) };
  });
}

function paintCompleteText(ctx, spec, text = spec.text, bounds = spec.delivery_bounds) {
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
    ctx.lineWidth = spec.stroke.width * 2;
    ctx.strokeStyle = spec.stroke.color;
    ctx.strokeText(text, x + w / 2, baseline, w - ctx.lineWidth);
  }
  ctx.fillStyle = spec.color;
  ctx.fillText(text, x + w / 2, baseline, w - (spec.stroke?.width || 0) * 2);
}

export function drawCompleteDialog(ctx, { levelNo, title, rewards, isLastLevel }, feedback = (id, rect, paint) => paint()) {
  ctx.save();
  ctx.fillStyle = "rgba(100,64,85,.48)";
  ctx.fillRect(0, 0, 540, 960);
  ctx.translate(0, COMPLETE_OFFSET_Y);
  ctx.scale(COMPLETE_SCALE, COMPLETE_SCALE);
  const image = (id, bounds = COMPLETE_ART.assets[id].bounds) => ctx.drawImage(completeImages.get(id), ...bounds);
  COMPLETE_ART.staticLayers.forEach(id => {
    const key = /^ui_(button|icon)_home$/.test(id) ? "home" : /^ui_(button|icon)_next$/.test(id) ? "next" : null;
    if (key) feedback(`complete.${key}`, COMPLETE_UI[key], () => image(id));
    else image(id);
  });
  const row = completionRewardLayout(rewards);
  for (const reward of row) {
    image(reward.card, reward.cardBounds);
    image(reward.icon, reward.iconBounds);
    paintCompleteText(ctx, completeText[reward.text], `×${reward.amount}`, reward.textBounds);
  }
  for (const spec of COMPLETE_ART.textLayers) {
    if (spec.name === "txt_coin_count" || spec.name === "txt_star_count") continue;
    const text = spec.name === "txt_level" ? `第${levelNo}关 ${title}`
      : spec.name === "txt_next" && isLastLevel ? "晚安"
      : spec.name === "txt_reward" && !row.length ? "本关已完成" : spec.text;
    const key = spec.name === "txt_home" ? "home" : spec.name === "txt_next" ? "next" : null;
    const paint = () => paintCompleteText(ctx, spec, text);
    if (key) feedback(`complete.${key}`, COMPLETE_UI[key], paint);
    else paint();
  }
  ctx.restore();
}
