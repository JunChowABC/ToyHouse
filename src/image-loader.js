import IMAGE_ALIASES from "./image-aliases.js";
import RUNTIME_ATLAS from "./runtime-atlas-manifest.js";

const spriteImages = new Map();
export function loadImage(path) {
  const normalized = new URL(path, document.baseURI).href.slice(new URL(".", document.baseURI).href.length);
  const canonical = IMAGE_ALIASES[normalized] || normalized;
  const sprite = RUNTIME_ATLAS[canonical];
  if (!sprite) return loadImageFile(canonical);
  if (spriteImages.has(canonical)) return spriteImages.get(canonical);
  const promise = loadImageFile(sprite.file).then(atlas => {
    const [x, y, width, height] = sprite.rect;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(atlas, x, y, width, height, 0, 0, width, height);
    // Logical source identity for diagnostics; network requests use the atlas URL.
    canvas.src = new URL(canonical, document.baseURI).href;
    return canvas;
  }).catch(error => { spriteImages.delete(canonical); throw error; });
  spriteImages.set(canonical, promise);
  return promise;
}

const imageRequests = new Map();
const requestedImages = new Set();
const completedImages = new Set();
const imageQueue = [];
let activeImageLoads = 0;

export function imageLoadStatus() {
  return { loaded: completedImages.size, total: requestedImages.size,
    pending: [...requestedImages].filter(url => !completedImages.has(url)).map(url => new URL(url).pathname) };
}

function drainImageQueue() {
  while (activeImageLoads < 6 && imageQueue.length) {
    activeImageLoads++;
    const job = imageQueue.shift();
    job().finally(() => { activeImageLoads--; drainImageQueue(); });
  }
}

function attemptImage(url, attempt) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const finish = error => {
      clearTimeout(timer);
      image.onload = image.onerror = null;
      if (error) { image.src = ""; reject(error); }
      else resolve(image);
    };
    const timer = setTimeout(() => finish(new Error(`Image timeout: ${url.pathname}`)), 15000);
    image.onload = () => image.naturalWidth ? finish() : finish(new Error(`Empty image: ${url.pathname}`));
    image.onerror = () => finish(new Error(`Image unavailable: ${url.pathname}`));
    const requestUrl = new URL(url);
    if (attempt) requestUrl.searchParams.set("retry", String(attempt));
    image.src = requestUrl.href;
  });
}

function loadImageFile(path) {
  const url = new URL(IMAGE_ALIASES[path] || path, document.baseURI);
  const key = url.href;
  requestedImages.add(key);
  if (imageRequests.has(key)) return imageRequests.get(key);
  const promise = new Promise((resolve, reject) => {
    imageQueue.push(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const image = await attemptImage(url, attempt);
          completedImages.add(key);
          resolve(image);
          return;
        } catch (error) {
          if (attempt === 2) { imageRequests.delete(key); reject(error); }
        }
      }
    });
  });
  imageRequests.set(key, promise);
  drainImageQueue();
  return promise;
}
