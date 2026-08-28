import { pathToFileURL } from "node:url";

const playwrightEntry = pathToFileURL(
  "C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "playwright") return { url: playwrightEntry, shortCircuit: true };
  return nextResolve(specifier, context);
}
