// The flat UI rollout's in-game shots (specs/polish/flat-ui.md): menus over the member island at /lab/island, the
// demo services behind them (collections=demo, progression=demo). Headless and muted; the dev server on PORT with the
// Supabase env blanked.   PORT=3191 node ../specs/evidence/flat-ui/shots-game.mjs <out-dir> [scene ...]   (from web/)
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT, ...ONLY] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3191, HOST = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
async function island(query, fn, { width = 1440, height = 900, wait = 6000 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await ctx.addInitScript(look => { try {
    for (const [k, v] of Object.entries({ "tsi.liteMode.v1": "false", "tsi.pixelated.v1": "false", "tsi.welcomed.v1": "1", "tsi.look.v1": look, "tsi.gift.later": new Date().toISOString().slice(0, 10) })) localStorage.setItem(k, v);
  } catch {} }, JSON.stringify(LOOK));
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  const t0 = Date.now();
  await page.goto(`${HOST}/lab/island?at=14:05&${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !document.body.innerText.includes("Preparing"), null, { timeout: 300000 }).catch(() => console.log("still preparing"));
  await page.waitForTimeout(wait);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; } nav:has(> a[href='/lab']) { display: none !important; }" });
  console.log("loaded in", Math.round((Date.now() - t0) / 1000), "s");
  await fn(page);
  await ctx.close();
}
const shot = async (page, name) => { await page.mouse.move(1, 1); await page.waitForTimeout(800); await page.screenshot({ path: join(OUT, `${name}.png`) }); console.log("shot", name); };
const SCENES = {
  decorate: () => island("home=inside&decorate=1", async page => { await shot(page, "5b-decorate-room"); }),
};
for (const [name, run] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  try { await run(); } catch (e) { console.log("failed", name, e.message.slice(0, 200)); }
}
await browser.close();
