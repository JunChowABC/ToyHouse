import "./build-level-config.mjs";
import { readFile, writeFile, cp, mkdir } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

// Optional CLI path lets the offline workstation reuse its cached Terser.
const { minify } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : "terser");
const source = await readFile(new URL("../src/game.js", import.meta.url), "utf8");
const config = await readFile(new URL("../src/level-config.js", import.meta.url), "utf8");
const art = await readFile(new URL("../src/art-manifest.js", import.meta.url), "utf8");
const pauseArt = await readFile(new URL("../src/pause-art-manifest.js", import.meta.url), "utf8");
const pauseCode = (await readFile(new URL("../src/pause-dialog.js", import.meta.url), "utf8"))
  .replace('import PAUSE_ART from "./pause-art-manifest.js";', pauseArt.replace("export default", "const PAUSE_ART ="))
  .replace(/^export /gm, "");
const completeArt = await readFile(new URL("../src/complete-art-manifest.js", import.meta.url), "utf8");
const completeCode = (await readFile(new URL("../src/complete-dialog.js", import.meta.url), "utf8"))
  .replace('import COMPLETE_ART from "./complete-art-manifest.js";', completeArt.replace("export default", "const COMPLETE_ART ="))
  .replace(/^export /gm, "");
const homeArt = await readFile(new URL("../src/home-art-manifest.js", import.meta.url), "utf8");
const homeCode = (await readFile(new URL("../src/home-screen.js", import.meta.url), "utf8"))
  .replace('import HOME_ART from "./home-art-manifest.js";', homeArt.replace("export default", "const HOME_ART ="))
  .replace(/^export /gm, "");
const loaderCode = (await readFile(new URL("../src/image-loader.js", import.meta.url), "utf8")).replace(/^export /gm, "");
const bundled = source.replace('import { loadImage, imageLoadStatus } from "./image-loader.js";', loaderCode).replace('import LEVEL_CONFIG from "./level-config.js";', config.replace("export default", "const LEVEL_CONFIG ="))
  .replace('import ART_MANIFEST from "./art-manifest.js";', art.replace("export default", "const ART_MANIFEST ="))
  .replace('import { PAUSE_UI, TOOL_MODAL_UI, HOME_SETTINGS_UI, loadPauseArt, drawPauseDialog, drawToolDialog, drawHomeSettings, pauseArtStatus } from "./pause-dialog.js";', pauseCode)
  .replace('import { COMPLETE_UI, loadCompleteArt, drawCompleteDialog, completeArtStatus, completionRewardLayout } from "./complete-dialog.js";', completeCode)
  .replace('import { HOME_UI, loadHomeArt, drawHomeScreen, homeArtStatus } from "./home-screen.js";', homeCode).replaceAll('import { loadImage } from "./image-loader.js";', '');
const result = await minify(bundled, { module: true, compress: true, mangle: true });
await writeFile(new URL("../docs/game.js", import.meta.url), result.code);
await mkdir(new URL("../docs/assets/", import.meta.url), { recursive: true });
await cp(new URL("../assets/toyhouse-ui-v3/", import.meta.url), new URL("../docs/assets/toyhouse-ui-v3/", import.meta.url), { recursive: true });
await cp(new URL("../assets/pause-dialog-v2/", import.meta.url), new URL("../docs/assets/pause-dialog-v2/", import.meta.url), { recursive: true });
await cp(new URL("../assets/tool-dialog-v1/", import.meta.url), new URL("../docs/assets/tool-dialog-v1/", import.meta.url), { recursive: true });
await cp(new URL("../assets/level-complete-v1/", import.meta.url), new URL("../docs/assets/level-complete-v1/", import.meta.url), { recursive: true });
await cp(new URL("../assets/home-v2/", import.meta.url), new URL("../docs/assets/home-v2/", import.meta.url), { recursive: true });
await cp(new URL("../styles.css", import.meta.url), new URL("../docs/styles.css", import.meta.url));
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const bundleVersion = createHash("sha256").update(result.code).digest("hex").slice(0, 12);
await writeFile(new URL("../docs/index.html", import.meta.url), html.replace('src="src/game.js"', `src="game.js?v=${bundleVersion}"`));
console.log("Updated docs/ with v1.3 levels, V3 PSD UI and supplied original art, styles and entry point");
