import "./build-level-config.mjs";
import { readFile, writeFile, cp, mkdir } from "node:fs/promises";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

// Optional CLI path lets the offline workstation reuse its cached Terser.
const { minify } = await import(process.argv[2] ? pathToFileURL(process.argv[2]).href : "terser");
const rawSource = await readFile(new URL("../src/game.js", import.meta.url), "utf8");
const source = rawSource.replace(/window\.__toyhouse_debug = \{[\s\S]*?\n\};/, '');
if (source.includes('__toyhouse_debug')) throw new Error('Development interface removal failed');
const motionCode = (await readFile(new URL("../src/ui-motion.js", import.meta.url), "utf8")).replace(/^export /gm, "");
const config = await readFile(new URL("../src/level-config.js", import.meta.url), "utf8");
const art = await readFile(new URL("../src/art-manifest.js", import.meta.url), "utf8");
const pauseArt = await readFile(new URL("../src/pause-art-manifest.js", import.meta.url), "utf8");
const sharedDialogArt = await readFile(new URL("../src/shared-dialog-art-manifest.js", import.meta.url), "utf8");
const toolArt = await readFile(new URL("../src/tool-art-manifest.js", import.meta.url), "utf8");
const pauseCode = (await readFile(new URL("../src/pause-dialog.js", import.meta.url), "utf8"))
  .replace('import PAUSE_ART from "./pause-art-manifest.js";', pauseArt.replace("export default", "const PAUSE_ART ="))
  .replace('import SHARED_DIALOG_ART from "./shared-dialog-art-manifest.js";', sharedDialogArt.replace("export default", "const SHARED_DIALOG_ART ="))
  .replace('import TOOL_ART from "./tool-art-manifest.js";', toolArt.replace("export default", "const TOOL_ART ="))
  .replace(/^export /gm, "");
const completeArt = await readFile(new URL("../src/complete-art-manifest.js", import.meta.url), "utf8");
const completeCode = (await readFile(new URL("../src/complete-dialog.js", import.meta.url), "utf8"))
  .replace('import COMPLETE_ART from "./complete-art-manifest.js";', completeArt.replace("export default", "const COMPLETE_ART ="))
  .replace(/^export /gm, "");
const homeArt = await readFile(new URL("../src/home-runtime-manifest.js", import.meta.url), "utf8");
const loadingArt = await readFile(new URL("../src/loading-art-manifest.js", import.meta.url), "utf8");
const loadingCode = (await readFile(new URL("../src/loading-screen.js", import.meta.url), "utf8"))
  .replace('import LOADING_ART from "./loading-art-manifest.js";', loadingArt.replace("export default", "const LOADING_ART ="))
  .replace(/^export /gm, "");
const homeCode = (await readFile(new URL("../src/home-screen.js", import.meta.url), "utf8"))
  .replace('import HOME_ART from "./home-runtime-manifest.js";', homeArt.replace("export default", "const HOME_ART ="))
  .replace(/^export /gm, "");
const aliasesCode = (await readFile(new URL("../src/image-aliases.js", import.meta.url), "utf8")).replace("export default", "const IMAGE_ALIASES =");
const atlasCode = (await readFile(new URL("../src/runtime-atlas-manifest.js", import.meta.url), "utf8")).replace("export default", "const RUNTIME_ATLAS =");
const loaderCode = (await readFile(new URL("../src/image-loader.js", import.meta.url), "utf8"))
  .replace('import IMAGE_ALIASES from "./image-aliases.js";', aliasesCode)
  .replace('import RUNTIME_ATLAS from "./runtime-atlas-manifest.js";', atlasCode).replace(/^export /gm, "");
const viewportCode = (await readFile(new URL("../src/viewport.js", import.meta.url), "utf8")).replace(/^export /gm, "");
const bundled = source.replace('import { loadImage, imageLoadStatus } from "./image-loader.js";', loaderCode).replace('import LEVEL_CONFIG from "./level-config.js";', config.replace("export default", "const LEVEL_CONFIG ="))
  .replace('import ART_MANIFEST from "./art-manifest.js";', art.replace("export default", "const ART_MANIFEST ="))
  .replace('import { PAUSE_UI, TOOL_MODAL_UI, HOME_SETTINGS_UI, loadPauseArt, drawPauseDialog, drawToolDialog, drawHomeSettings, pauseArtStatus } from "./pause-dialog.js";', pauseCode)
  .replace('import { COMPLETE_UI, loadCompleteArt, drawCompleteDialog, completeArtStatus, completionRewardLayout } from "./complete-dialog.js";', completeCode)
  .replace('import { HOME_UI, loadHomeArt, drawHomeScreen, homeArtStatus } from "./home-screen.js";', homeCode)
  .replace('import { loadLoadingArt, drawLoadingScreen, loadingArtStatus } from "./loading-screen.js";', loadingCode)
  .replaceAll('import { loadImage } from "./image-loader.js";', '')
  .replace('import { dialogMotion, syncDialogMotion, closeDialogMotion, tickDialogMotion, dialogMotionBusy } from "./ui-motion.js";', motionCode)
  .replaceAll('import { paintDialogBackdrop } from "./ui-motion.js";', '')
  .replace(/^import \{[^}]*\} from "\.\/viewport\.js";\r?$/gm, '');
const result = await minify(viewportCode + "\n" + bundled, { module: true, compress: true, mangle: true });
await writeFile(new URL("../docs/game.js", import.meta.url), result.code);
await mkdir(new URL("../docs/assets/", import.meta.url), { recursive: true });
await cp(new URL("../assets/loading-v1/", import.meta.url), new URL("../docs/assets/loading-v1/", import.meta.url), { recursive: true });
await cp(new URL("../assets/core-ui-v4/", import.meta.url), new URL("../docs/assets/core-ui-v4/", import.meta.url), { recursive: true });
await cp(new URL("../assets/combo-login-v1/", import.meta.url), new URL("../docs/assets/combo-login-v1/", import.meta.url), { recursive: true });
await cp(new URL("../assets/runtime-ui/", import.meta.url), new URL("../docs/assets/runtime-ui/", import.meta.url), { recursive: true });
await cp(new URL("../assets/toyhouse-ui-v3/", import.meta.url), new URL("../docs/assets/toyhouse-ui-v3/", import.meta.url), { recursive: true });
await cp(new URL("../assets/pause-dialog-v2/", import.meta.url), new URL("../docs/assets/pause-dialog-v2/", import.meta.url), { recursive: true });
await cp(new URL("../assets/pause-popup2-v2/", import.meta.url), new URL("../docs/assets/pause-popup2-v2/", import.meta.url), { recursive: true });
await cp(new URL("../assets/tool-popup2-v1/", import.meta.url), new URL("../docs/assets/tool-popup2-v1/", import.meta.url), { recursive: true });
await cp(new URL("../assets/tool-dialog-v1/", import.meta.url), new URL("../docs/assets/tool-dialog-v1/", import.meta.url), { recursive: true });
await cp(new URL("../assets/level-complete-popup2-v1/", import.meta.url), new URL("../docs/assets/level-complete-popup2-v1/", import.meta.url), { recursive: true });
await cp(new URL("../assets/home-v2/", import.meta.url), new URL("../docs/assets/home-v2/", import.meta.url), { recursive: true });
await cp(new URL("../assets/home-screen2/", import.meta.url), new URL("../docs/assets/home-screen2/", import.meta.url), { recursive: true });
await cp(new URL("../styles.css", import.meta.url), new URL("../docs/styles.css", import.meta.url));
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const bundleVersion = createHash("sha256").update(result.code).digest("hex").slice(0, 12);
await writeFile(new URL("../docs/index.html", import.meta.url), html.replace('src="src/game.js"', `src="game.js?v=${bundleVersion}"`));
console.log("Updated docs/ with v1.3 levels, core UI v4 and supplied original art, styles and entry point");

const { verifyRelease } = await import("./verify-release-no-gm.mjs");
await verifyRelease(fileURLToPath(new URL("../docs/", import.meta.url)));
