import { mkdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "../scripts/playwright_system_chrome.mjs";

const assetsDir = resolve("docs/design/核心玩法系统/assets");
const outputDir = resolve("test-output/core-svg");
await mkdir(outputDir, { recursive: true });

const files = [
  "核心玩法系统-界面关系评审稿.svg",
  "局内玩法界面-交互原型.svg",
  "暂停弹窗-交互原型.svg",
  "普通关卡完成反馈-交互原型.svg",
  "道具说明弹窗-交互原型.svg",
  "道具说明弹窗-流程图.svg",
];

const browser = await chromium.launch({ headless: true });
try {
  for (const file of files) {
    const source = await readFile(resolve(assetsDir, file), "utf8");
    const size = source.match(/<svg[^>]*width="(\d+)"[^>]*height="(\d+)"/);
    if (!size) throw new Error(`Missing SVG dimensions: ${file}`);
    const width = Number(size[1]);
    const height = Number(size[2]);
    const page = await browser.newPage({ viewport: { width, height } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(pathToFileURL(resolve(assetsDir, file)).href, { waitUntil: "load" });
    await page.screenshot({ path: resolve(outputDir, file.replace(/\.svg$/i, ".png")) });
    if (errors.length) throw new Error(`${file}: ${errors.join(" | ")}`);
    await page.close();
  }
  console.log(`rendered ${files.length} core gameplay SVG files`);
} finally {
  await browser.close();
}
