import { defineConfig, chromium } from "@playwright/test";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
let executablePath = chromium.executablePath();
if (!existsSync(executablePath) && process.env.LOCALAPPDATA) {
  const cache = path.join(process.env.LOCALAPPDATA, "ms-playwright");
  const revisions = readdirSync(cache).filter(x => /^chromium-\d+$/.test(x)).sort((a,b)=>Number(b.split("-")[1])-Number(a.split("-")[1]));
  for (const revision of revisions) {
    const candidate = path.join(cache, revision, "chrome-win64", "chrome.exe");
    if (existsSync(candidate)) { executablePath = candidate; break; }
  }
}
export default defineConfig({
  testDir: "./test/browser", timeout: 30000, workers: 1, fullyParallel: false,
  outputDir: "./work/browser-results",
  use: { headless: true, launchOptions: { executablePath } },
});
