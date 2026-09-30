// Game rules stay in 540x960 design coordinates. Only presentation and hit areas move.
export const viewport = { height: 960, y: 0, top: 0, bottom: 0 };
export function resizeViewport(canvas) {
  const bounds = canvas.getBoundingClientRect();
  const css = getComputedStyle(document.documentElement);
  const unit = 540 / Math.max(1, bounds.width);
  const safeTop = (parseFloat(css.getPropertyValue('--safe-top')) || 0) * unit;
  const safeBottom = (parseFloat(css.getPropertyValue('--safe-bottom')) || 0) * unit;
  viewport.height = Math.max(960, bounds.height * unit);
  const extra = Math.max(0, viewport.height - 960 - safeTop - safeBottom);
  viewport.y = Math.min(safeTop, viewport.height - 960) + extra / 2;
  viewport.top = -extra / 2;
  viewport.bottom = extra / 2;
}
export function controlOffset(id) {
  if (id === 'home.settings' || id === 'play.pause') return viewport.top;
  if (id === 'home.start' || /^play\.(remove|shuffle|flip)$/.test(id)) return viewport.bottom;
  return 0;
}
export function atOffset(ctx, y, paint) {
  ctx.save(); ctx.translate(0, y); paint(); ctx.restore();
}
export function fillViewport(ctx) {
  ctx.fillRect(0, -viewport.y, 540, viewport.height);
}
export function drawRoomBackground(ctx, image) {
  if (!image) return;
  // The generated image preserves the original composition centered at y=480.
  const reach = Math.max(480 + viewport.y, viewport.height - viewport.y - 480);
  const scale = Math.max(540 / image.width, reach * 2 / image.height);
  ctx.drawImage(image, (540 - image.width * scale) / 2, 480 - image.height * scale / 2,
    image.width * scale, image.height * scale);
}
