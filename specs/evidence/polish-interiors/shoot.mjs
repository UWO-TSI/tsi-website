// Interiors evidence (specs/polish/interiors.md): headed Chromium off screen (--window-position=2400,0), muted, signed
// out, dev server on :3136 with the Supabase env blanked. Each arg is name=query (appended to /lab/island?); PNGs land
// in <out_dir>.
//   node specs/evidence/polish-interiors/shoot.mjs <out_dir> name='hq=inside&time=night' ...
// In the query: wait=<ms> after load (default 7000); keys=<k,k>:<ms>;... walks before the shot; press=<key>:<ms> presses
// once before the shot; strip=<n>:<ms> takes n frames <ms> apart (after `press`, if any, from the press on); hold=<key>
// keeps a key down through the strip (walking past something); path=/lab/interior (default /lab/island); hud=0 hides
// the DOM overlays.
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SHOTS] = process.argv.slice(2);
const HOST = "http://localhost:3136";
const browser = await chromium.launch({ headless: false, args: ["--window-position=2400,0", "--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503/i.test(m.text())) console.log("console", m.text().slice(0, 300)); });
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
await page.evaluate(l => { localStorage.clear(); localStorage.setItem("tsi.look.v1", l); localStorage.setItem("tsi.pixelated.v1", "false"); }, JSON.stringify(LOOK));
for (const spec of SHOTS) {
  const [name, query = ""] = spec.split(/=(.*)/s);
  const q = new URLSearchParams(query);
  const wait = Number(q.get("wait") ?? 7000), keys = q.get("keys"), press = q.get("press"), strip = q.get("strip"), path = q.get("path") ?? "/lab/island", hud = q.get("hud"), hold = q.get("hold");
  for (const k of ["wait", "keys", "press", "strip", "path", "hud", "hold"]) q.delete(k);
  await page.goto(`${HOST}${path}?${q.toString().replace(/%2C/g, ",")}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 300000 }).catch(() => {});
  await page.waitForTimeout(wait);
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'] { display: none !important; } nextjs-portal { display: none !important; }" });
  if (hud === "0") await page.addStyleTag({ content: "main > :not(:has(canvas)), nav { visibility: hidden !important; }" });
  if (keys) {
    await page.locator("canvas").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
    for (const step of keys.split(";")) {
      const [k, ms] = step.split(":");
      for (const key of k.split(",")) await page.keyboard.down(key);
      await page.waitForTimeout(Number(ms));
      for (const key of k.split(",")) await page.keyboard.up(key);
      await page.waitForTimeout(200);
    }
    await page.waitForTimeout(900);
  }
  const perf = await page.evaluate(() => document.querySelector("#island-options output")?.textContent ?? "");
  if (perf) console.log("perf", name, perf.replace(/\n/g, " | "));
  const clip = path === "/lab/island" ? { x: 0, y: 40, width: 1440, height: 860 } : { x: 0, y: 40, width: 1440, height: 860 };
  if (strip) {
    const [n, ms] = strip.split(":").map(Number);
    if (hold) await page.locator("canvas").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
    const t0 = Date.now();
    if (press) { const [k] = press.split(":"); await page.keyboard.press(k); }
    if (hold) await page.keyboard.down(hold);
    for (let i = 0; i < n; i++) {
      await page.screenshot({ path: `${OUT}/${name}-${String(i).padStart(2, "0")}.png`, clip });
      await page.waitForTimeout(Math.max(0, t0 + (i + 1) * ms - Date.now()));
    }
    if (hold) await page.keyboard.up(hold);
  } else {
    if (press) { const [k, ms] = press.split(":"); await page.keyboard.press(k); await page.waitForTimeout(Number(ms ?? 900)); }
    await page.screenshot({ path: `${OUT}/${name}.png`, clip });
  }
  console.log("shot", name);
}
await browser.close();
