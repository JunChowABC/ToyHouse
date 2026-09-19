import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";

const project = new URL("../", import.meta.url);
const source = new URL("outputs/20260919_level_complete_psd_v1/", project);
const manifest = JSON.parse(await readFile(new URL("psd-manifest.json", source), "utf8"));
const validation = JSON.parse(await readFile(new URL("qa/validation-report.json", source), "utf8"));
if (!validation.valid) throw new Error("Completion PSD must pass validation before export");
const directory = "assets/level-complete-v1";
const output = new URL(`${directory}/`, project);
await mkdir(output, { recursive: true });
const layers = manifest.groups.flatMap(group => group.layers);
const assets = {};
for (const layer of layers) {
  const bytes = await readFile(new URL(layer.file, source));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== layer.final_sha256) throw new Error(`Unverified PNG: ${layer.name}`);
  const file = `${layer.name}.png`;
  await copyFile(new URL(layer.file, source), new URL(file, output));
  assets[layer.name] = { file, bounds: layer.logical_bounds, sha256 };
}
const rewardLayers = new Set(["ui_reward_card_coin", "ui_reward_card_star", "ui_coin", "ui_rainbow_star"]);
const data = {
  version: "level-complete-v1", directory, canvas: manifest.canvas,
  source: "outputs/20260919_level_complete_psd_v1/level-complete-dialog-layered-v1.psd",
  assets, staticLayers: layers.filter(layer => !rewardLayers.has(layer.name)).map(layer => layer.name),
  textLayers: manifest.text_layers,
};
await writeFile(new URL("manifest.json", output), JSON.stringify(data, null, 2) + "\n");
await writeFile(new URL("src/complete-art-manifest.js", project),
  `// Generated from the validated completion PSD by scripts/export-complete-art.mjs.\nexport default ${JSON.stringify(data, null, 2)};\n`);
console.log(`Exported ${layers.length} independent completion assets`);
