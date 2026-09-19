import { chromium as bundledChromium } from "file:///C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs";

const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH
  || "C:/Program Files/Google/Chrome/Application/chrome.exe";

export const chromium = new Proxy(bundledChromium, {
  get(target, property, receiver) {
    if (property === "launch") {
      return (options = {}) => target.launch({ ...options, executablePath });
    }
    return Reflect.get(target, property, receiver);
  },
});
