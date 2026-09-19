import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const project = new URL("../", import.meta.url);
const source = new URL("outputs/20260919_home_psd_v2_art_slogan/", project);
const manifest = JSON.parse(await readFile(new URL("psd-manifest.json", source), "utf8"));
const validation = JSON.parse(await readFile(new URL("qa/validation-report.json", source), "utf8"));
if (!validation.valid) throw new Error("Home PSD must pass validation before export");
// Currency art is owned and loaded by the core HUD. Do not ship duplicate variants.
const excluded = new Set(["ui_star_bar", "ui_star_icon", "ui_coin_bar", "ui_coin_icon"]);
const layers = manifest.groups.flatMap(group => group.layers).filter(layer => !excluded.has(layer.name));
const directory = "assets/home-v2";
const output = new URL(`${directory}/`, project);
await mkdir(output, { recursive: true });
const assets = {};
for (const layer of layers) {
  const bytes = await readFile(new URL(layer.file, source));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== layer.final_sha256) throw new Error(`Unverified home PNG: ${layer.name}`);
  const file = `${layer.name}.png`;
  await copyFile(new URL(layer.file, source), new URL(file, output));
  assets[layer.name] = { file, bounds: layer.logical_bounds, sha256, opacity: layer.opacity / 255 };
}
const data = {
  version: "home-v2-art-slogan", directory, canvas: manifest.canvas,
  source: "outputs/20260919_home_psd_v2_art_slogan/toyhouse-home-layered-v2-art-slogan.psd",
  assets, layers: layers.map(layer => layer.name),
  textLayers: manifest.text_layers.filter(text => !["txt_star_count", "txt_coin_count"].includes(text.name)),
  currencySource: "toyhouse-ui-v3/06_RESOURCES", excludedAssets: [...excluded],
};
await writeFile(new URL("manifest.json", output), JSON.stringify(data, null, 2) + "\n");
await writeFile(new URL("src/home-art-manifest.js", project),
  `// Generated from the validated home PSD by scripts/export-home-art.mjs.\nexport default ${JSON.stringify(data, null, 2)};\n`);
console.log(`Exported ${layers.length} home resources; four currency resources reuse the core HUD`);
