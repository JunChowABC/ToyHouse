import assert from 'node:assert/strict';
import { chromium } from '../scripts/playwright_system_chrome.mjs';

const browser = await chromium.launch({ headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  page.on('pageerror', error => errors.push(String(error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.addInitScript(() => {
    window.requestAnimationFrame = () => 0;
    window.duckTransforms = [];
    const drawImage = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function(image, ...args) {
      if (image.src?.includes('toy_duck_yellow_a')) {
        const { a, b, c, d } = this.getTransform();
        window.duckTransforms.push({ a, b, c, d });
      }
      return drawImage.call(this, image, ...args);
    };
  });
  await page.goto('http://127.0.0.1:4186/?previewLevel=31', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.__toyhouse_art_ready);
  await page.waitForFunction(() => JSON.parse(window.render_game_to_text()).art.systems.play);
  for (const [x, y, facing] of [[3, 1, 'UP'], [10, 3, 'RIGHT']]) {
    const transforms = await page.evaluate(({ x, y }) => {
      window.duckTransforms = [];
      window.__toyhouse_debug.loadMechanicConfig({
        board_width: 12, board_height: 18,
        toy_list: [{ toy_id: 'duck', archetype_id: 'AUTO_EXIT', direction: null,
          grid_position: [x, y], footprint: [1, 1] }], board_entities: [],
      });
      return window.duckTransforms;
    }, { x, y });
    assert(transforms.length > 0, `${facing} duck drawn`);
    const transform = transforms.at(-1);
    if (facing === 'UP') {
      assert(Math.abs(transform.a) < .01 && transform.b > .5, 'upward duck rotates toward travel');
    } else {
      assert(transform.a < -.5 && Math.abs(transform.b) < .01, 'rightward duck flips toward travel');
    }
  }
  assert.deepEqual(errors, []);
  await page.close();
  console.log('Duck exit artwork faces UP and RIGHT in browser Canvas PASS');
} finally {
  await browser.close();
}
