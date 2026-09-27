// Headed Chromium (WebGL) evidence for the audio pass: the Sound section in
// the settings sheet (specs/audio-pass.md item 4). Signed out, /lab/island.
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const execFileAsync = promisify(execFile);

const BASE = "http://localhost:4400/lab/island";
const OUT = process.argv[2];
// Same pre-seeded look as specs/evidence/polish/shots.mjs, to skip the
// first-visit character creator and land straight on the island.
const look = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_hoodie: 2 } };
const browser = await chromium.launch({ headless: false, args: ["--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
await ctx.addInitScript(l => { try { localStorage.setItem("tsi.look.v1", l); } catch {} }, JSON.stringify(look));
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message));
// Playwright's screenshot() only encodes png/jpeg; take png then convert to
// webp (project convention for evidence images) with cwebp (Homebrew).
const shot = async (name) => {
  await page.waitForTimeout(500);
  const png = `${OUT}/${name}.png`;
  await page.screenshot({ path: png });
  await execFileAsync("cwebp", ["-quiet", "-q", "90", png, "-o", `${OUT}/${name}.webp`]);
  await fs.unlink(png);
  console.log("shot", name);
};
const ready = async () => {
  await page.waitForSelector("canvas", { timeout: 120000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing the island"), null, { timeout: 180000 });
  await page.waitForTimeout(3000);
};

await page.goto(`${BASE}?time=day`, { waitUntil: "domcontentloaded" });
try {
  await ready();
} catch (e) {
  console.log("ready() failed:", e.message);
  await page.screenshot({ path: `${OUT}/DEBUG-ready-timeout.png` });
}
// Desktop viewport: the options panel is always visible (the "View options"
// toggle is a mobile/touch-only affordance — .panelToggle is display:none
// above 700px), so the Settings button is already on screen.
await page.getByRole("button", { name: "Settings · text, contrast, keys" }).click({ timeout: 20000 });
await page.waitForSelector('[data-testid="settings-sheet"]', { timeout: 30000 });

// Trigger sound on first (any) gesture — clicks above already count, so
// AudioController should have already unlocked it. Confirm, then screenshot
// the Sound section.
const enabled = await page.evaluate(() => document.querySelector('[data-testid="settings-sheet"]')?.textContent?.includes("Turn on sound") === false);
console.log("sound already enabled from earlier clicks:", enabled);
await page.locator('[data-testid="settings-sheet"] fieldset', { hasText: "Sound" }).scrollIntoViewIfNeeded();
await shot("A1-settings-sheet-sound-section");

await browser.close();
