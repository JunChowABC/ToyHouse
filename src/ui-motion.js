// Presentation time is independent of the paused gameplay clock.
export const dialogMotion = { key: null, elapsed: 0, closing: false, done: null };
export function syncDialogMotion(key) {
  if (key === dialogMotion.key) return;
  Object.assign(dialogMotion, { key, elapsed: 0, closing: false, done: null });
}
export function closeDialogMotion(done) {
  if (dialogMotion.closing) return;
  if (!dialogMotion.key) { done(); return; }
  Object.assign(dialogMotion, { elapsed: 0, closing: true, done });
}
export function tickDialogMotion(ms) {
  dialogMotion.elapsed += ms;
  if (dialogMotion.closing && dialogMotion.elapsed >= 180) {
    const done = dialogMotion.done;
    Object.assign(dialogMotion, { key: null, closing: false, done: null });
    done?.();
  }
}
export function dialogMotionBusy() {
  return Boolean(dialogMotion.key && (dialogMotion.closing || dialogMotion.elapsed < 300));
}
export function paintDialogBackdrop(ctx, color) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t = Math.min(1, dialogMotion.elapsed / (dialogMotion.closing ? 180 : 300));
  const opacity = dialogMotion.closing ? 1 - t * t : 1 - (1 - t) ** 3;
  ctx.globalAlpha *= opacity;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 540, 960);
  // Gentle overshoot on arrival, ease-in shrink on dismissal.
  const overshoot = 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
  const scale = reduced ? 1 : dialogMotion.closing ? 1 - .16 * t * t : .78 + .22 * overshoot;
  ctx.translate(270, 480);
  ctx.scale(scale, scale);
  ctx.translate(-270, -480);
}
