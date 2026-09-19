import { pathToFileURL } from "node:url";
import { resolve as resolvePath } from "node:path";

const playwrightEntry = pathToFileURL(resolvePath(import.meta.dirname, "playwright_system_chrome.mjs")).href;

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "playwright") return { url: playwrightEntry, shortCircuit: true };
  return nextResolve(specifier, context);
}
