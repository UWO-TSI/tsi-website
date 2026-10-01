// Café evidence and review shots (specs/cafe-polish.md item 10): headed Chromium (WebGL), muted, signed out, dev server on :3121
// with the Supabase env blanked. Each arg is name=query (appended to /lab/island?); PNGs land in <out_dir>.
//   node specs/evidence/cafe-polish/shoot.mjs <out_dir> name='cafe=inside&time=evening' ...
// Options in the query: wait=<ms> after load (default 7000), keys=<w,a...>:<ms> to walk before the shot, clip=<x,y,w,h>.
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SHOTS] = process.argv.slice(2);
const HOST = "http://localhost:3121";
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503/i.test(m.text())) console.log("console", m.text().slice(0, 300)); });
// A saved look skips the character creator (signed out, localStorage only).
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
await page.evaluate(l => { localStorage.clear(); localStorage.setItem("tsi.look.v1", l); }, JSON.stringify(LOOK));
for (const spec of SHOTS) {
  const [name, query = ""] = spec.split(/=(.*)/s);
  const q = new URLSearchParams(query);
  const wait = Number(q.get("wait") ?? 7000), keys = q.get("keys"), clip = q.get("clip");
  const px = q.get("px"), repeat = q.get("repeat"), press = q.get("press"), click = q.get("click"), path = q.get("path") ?? "/lab/island", mobile = q.get("mobile");
  // size=WxH: a portrait frame beside a portrait reference; hud=0: the game's DOM overlays hidden (canvas only).
  const size = q.get("size")?.split("x").map(Number), hud = q.get("hud");
  for (const k of ["wait", "keys", "clip", "px", "panel", "repeat", "press", "click", "path", "mobile", "size", "hud"]) q.delete(k);
  await page.setViewportSize(mobile ? { width: 390, height: 844 } : size ? { width: size[0], height: size[1] } : { width: 1440, height: 900 });
  // px=0: the smooth render (the pixel filter is the default finish).
  await page.evaluate(v => localStorage.setItem("tsi.pixelated.v1", v), px === "0" ? "false" : "true");
  await page.goto(`${HOST}${path}?${q.toString().replace(/%2C/g, ",")}`, { waitUntil: "domcontentloaded" });
  if (!mobile) await page.waitForSelector("canvas", { timeout: 240000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 240000 }).catch(() => {});
  await page.waitForTimeout(wait);
  if (keys) {
    await page.locator("canvas").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
    for (const step of keys.split(";")) {
      const [k, ms] = step.split(":");
      for (const key of k.split(",")) await page.keyboard.down(key);
      await page.waitForTimeout(Number(ms));
      for (const key of k.split(",")) await page.keyboard.up(key);
      await page.waitForTimeout(250);
    }
    await page.waitForTimeout(repeat ? 0 : 900);
  }
  // The view options panel starts open on a fresh profile: close it, and log the Performance readout.
  const perf = await page.evaluate(() => document.querySelector("#island-options output")?.textContent ?? "");
  console.log("perf", name, perf.replace(/\n/g, " | "));
  // The view options panel is always open at desktop widths: hide it (and the lab's nav is cropped by clip) for the shot.
  if (!spec.includes("panel=1")) await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'] { display: none !important; }" });
  await page.waitForTimeout(300);
  if (hud === "0") await page.addStyleTag({ content: "main > :not(:has(canvas)), nav { visibility: hidden !important; } nextjs-portal { display: none !important; }" });
  const opts = mobile ? { path: `${OUT}/${name}.png`, fullPage: true } : size || hud === "0" ? { path: `${OUT}/${name}.png` } : { path: `${OUT}/${name}.png`, clip: { x: 0, y: 40, width: 1440, height: 860 } };
  if (clip) { const [x, y, width, height] = clip.split(",").map(Number); opts.clip = { x, y, width, height }; }
  // press=<key>:<ms>: press a key (E to interact), wait, then shoot. repeat=<n>:<ms>: n frames of one load.
  // click=<button text>:<ms>: click a button by its accessible name first (Stand up, ...).
  if (click) { const [t, ms] = click.split(":"); await page.getByRole("button", { name: t }).first().click(); await page.waitForTimeout(Number(ms ?? 900)); }
  if (press) { const [k, ms] = press.split(":"); await page.keyboard.press(k); await page.waitForTimeout(Number(ms ?? 900)); }
  if (repeat) {
    const [n, ms] = repeat.split(":").map(Number);
    for (let i = 0; i < n; i++) { await page.screenshot({ ...opts, path: `${OUT}/${name}-${i}.png` }); await page.waitForTimeout(ms); }
  } else await page.screenshot(opts);
  console.log("shot", name);
}
await browser.close();
