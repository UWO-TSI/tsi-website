// rod-gear round 4 evidence: headless Chromium against a dev server (BASE), muted, never headed.
// Run: PW=<path to playwright/index.mjs> SHELL_BIN=<chrome-headless-shell> BASE=http://localhost:<port> node specs/evidence/rod-gear/r4/shots.mjs
// The harness (/dev/economy) seeds the catch counts: Flimsy 50, Cedar 37, Glass 12, Training 31 (found unless ?found=0).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import(process.env.PW);
const BASE = process.env.BASE;
const OUT = dirname(fileURLToPath(import.meta.url));
const ONLY = process.env.ONLY?.split(",");
const want = (k) => !ONLY || ONLY.includes(k);

const browser = await chromium.launch({ headless: true, executablePath: process.env.SHELL_BIN, args: ["--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors = [];
async function page(w, h) {
  const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  // The site's intro curtain waits on window load, which a dev page's models can hold back: keep it out of the shots.
  await p.addInitScript(() => document.addEventListener("DOMContentLoaded", () => {
    const s = document.createElement("style"); s.textContent = ".ld-overlay { display: none !important; }"; document.head.append(s);
  }));
  p.on("pageerror", (e) => errors.push(String(e)));
  return p;
}
const shop = async (p, q = "") => { await p.goto(`${BASE}/dev/economy?view=overlay&section=rods${q}`); await p.getByTestId("shop-card").first().waitFor({ timeout: 90000 }); await p.waitForTimeout(1500); };
const openShop = async (p, name) => { await p.getByRole("button", { name: new RegExp(`^${name},`) }).click(); await p.getByTestId("shop-detail").waitFor(); await p.waitForTimeout(3500); };
const bag = async (p) => { await p.goto(`${BASE}/dev/economy?view=bag`); await p.getByRole("button", { name: /^Glass rod/ }).waitFor({ timeout: 90000 }); await p.waitForTimeout(1500); };
const unlock = async (p, file) => { await p.goto(`${BASE}/dev/economy?view=unlock`); await p.getByText("Found: the Training rod").waitFor({ timeout: 90000 }); await p.waitForTimeout(900); await p.screenshot({ path: join(OUT, `${file}.png`) }); };

for (const [w, h, pre] of [[1280, 800, "rg4"], [390, 844, "rg4-phone"]]) {
  const p = await page(w, h);
  if (want("shop")) {
    await shop(p); await p.screenshot({ path: join(OUT, `${pre}-shop-shelf.png`), fullPage: true });
    await shop(p, "&found=0"); await p.screenshot({ path: join(OUT, `${pre}-shop-shelf-unfound.png`), fullPage: true });
    if (pre === "rg4") for (const [name, file] of [["Training rod", "shop-training"], ["Carrot rod", "shop-carrot"], ["Precision rod", "shop-precision"]]) {
      await shop(p); await openShop(p, name); await p.screenshot({ path: join(OUT, `${pre}-${file}.png`) });
    }
  }
  if (want("bag")) {
    await bag(p); await p.screenshot({ path: join(OUT, `${pre}-bag-tools.png`), fullPage: true });
    await p.getByRole("button", { name: /^Training rod/ }).click();
    await p.getByTestId("bag-rod").waitFor(); await p.waitForTimeout(3500);
    await p.screenshot({ path: join(OUT, `${pre}-bag-training.png`), fullPage: true });
  }
  if (want("unlock")) await unlock(p, `${pre}-unlock`);
  await p.close();
}
await browser.close();
console.log(errors.length ? `page errors:\n${[...new Set(errors)].join("\n")}` : "no page errors");
