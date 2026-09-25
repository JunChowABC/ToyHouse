import { readFile, writeFile, copyFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import CORE_ART from "../src/art-manifest.js";

const project = new URL("../", import.meta.url);
const source = new URL("outputs/level-complete-popup2-layered-v1/", project);
const manifest = JSON.parse(await readFile(new URL("psd-manifest.json", source), "utf8"));
const validation = JSON.parse(await readFile(new URL("qa/validation-report.json", source), "utf8"));
if (!validation.valid) throw new Error("Completion PSD must pass validation before export");
const directory = "assets/level-complete-popup2-v1";
const output = new URL(`${directory}/`, project);
await mkdir(output, { recursive: true });
const letteringSource = new URL("art/level-complete-popup2/", project);
const lettering = JSON.parse(await readFile(new URL("lettering-manifest.json", letteringSource), "utf8"));
const layers = manifest.groups.flatMap(group => group.layers);
const assets = {};
const currencyIcons = { ui_reward_coin: "coin_icon", ui_reward_gem: "gem_icon" };
for (const layer of layers) {
  const currency = CORE_ART.assets[currencyIcons[layer.name]];
  if (currency) {
    const sourcePath = `${currency.directory || CORE_ART.directory}/${currency.file}`;
    const bytes = await readFile(new URL(sourcePath, project));
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (sha256 !== currency.sha256) throw new Error(`Unverified currency icon: ${sourcePath}`);
    const [x, y, w, h] = layer.logical_bounds;
    const scale = Math.min(w / currency.size[0], h / currency.size[1]);
    const width = currency.size[0] * scale, height = currency.size[1] * scale;
    const file = `${layer.name}.png`;
    await copyFile(new URL(sourcePath, project), new URL(file, output));
    assets[layer.name] = { file, bounds: [x + (w - width) / 2, y + (h - height) / 2, width, height], sha256, source_path: sourcePath };
    continue;
  }
  const bytes = await readFile(new URL(layer.file, source));
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  if (sha256 !== lettering.source_png_sha256[layer.name]) throw new Error(`PNG no longer matches approved PSD: ${layer.name}`);
  const file = `${layer.name}.png`;
  await copyFile(new URL(layer.file, source), new URL(file, output));
  assets[layer.name] = { file, bounds: layer.logical_bounds, sha256 };
}
for (const [id, spec] of Object.entries(lettering.assets)) {
  const bytes = await readFile(new URL(spec.file, letteringSource));
  if (createHash("sha256").update(bytes).digest("hex") !== spec.sha256) throw new Error(`Unverified lettering: ${id}`);
  await copyFile(new URL(spec.file, letteringSource), new URL(spec.file, output));
  assets[id] = spec;
}
const rewardLayers = new Set(["ui_coin_card", "ui_gem_card", "ui_coin_count_plate", "ui_gem_count_plate", "ui_reward_coin", "ui_reward_gem"]);
const data = {
  version: "level-complete-popup2-v1", directory, canvas: manifest.canvas,
  source: `outputs/level-complete-popup2-layered-v1/${manifest.output}`,
  assets, staticLayers: layers.filter(layer => !rewardLayers.has(layer.name)).map(layer => layer.name),
  textLayers: manifest.text_layers,
  buttonLayers: {
    home: ["ui_home_button", "ui_home_icon"],
    next: ["ui_next_button", "ui_next_arrow", "ui_star_next_button", "ui_spark_next_upper", "ui_spark_next_mid", "ui_spark_next_lower", "ui_spark_next_lower_small"],
  },
};
await writeFile(new URL("manifest.json", output), JSON.stringify(data, null, 2) + "\n");
await writeFile(new URL("src/complete-art-manifest.js", project),
  `// Generated from the validated completion PSD by scripts/export-complete-art.mjs.\nexport default ${JSON.stringify(data, null, 2)};\n`);
console.log(`Exported ${Object.keys(assets).length} completion assets: 43 independent PNGs and 2 approved title exports`);
