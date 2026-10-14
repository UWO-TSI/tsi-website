// v1 land look evidence (specs/v1-drop.md §8b, §8c): headless Chromium on the real GPU (ANGLE on Metal), muted, never
// brought to the front, signed out against a dev server with the Supabase env blanked. Each arg is one shot:
//   name='path?query|steps'   steps split on ~, run in order after the scene settles:
//     cam=yawDeg,pitchDeg[,zoom]   the orbit camera's saved angle (set before the load)
//     vp=WxH                        the viewport (default 1440x900)          lite=1   the Lite tier
//     smooth=1                      the pixel finish off (it is on by default, as in the game)
//     wait=ms   nohud   eval=js   key=Key:ms
// The PNG is written to <out>/<name>.png.
//   HOST=http://localhost:3167 node specs/evidence/v1-land/shoot.mjs <out> 'village|/lab/island?time=day~cam=0,34~nohud'
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SHOTS] = process.argv.slice(2);
const HOST = process.env.HOST ?? "http://localhost:3167";
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, channel: "chromium", args: ["--mute-audio", "--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
const rad = d => (Number(d) * Math.PI) / 180;

for (const shot of SHOTS) {
  const [name, rest = ""] = shot.split(/\|(.*)/s);
  const [url, ...steps] = rest.split("~");
  const opt = Object.fromEntries(steps.filter(s => s.includes("=")).map(s => s.split(/=(.*)/s)));
  const [w, h] = (opt.vp ?? "1440x900").split("x").map(Number);
  const phone = w < 700;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
  const cam = opt.cam?.split(",").map(Number);
  await ctx.addInitScript(([look, c, lite, smooth]) => { try {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.liteMode.v1", lite); localStorage.setItem("tsi.shadows.v1", lite === "true" ? "false" : "true");
    localStorage.setItem("tsi.pixelated.v1", smooth ? "false" : "true"); localStorage.setItem("tsi.hud.full.v1", "true");
    if (c) localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: c[0], pitch: c[1], zoom: c[2] ?? 1, sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false }));
  } catch {} }, [JSON.stringify(LOOK), cam && [rad(cam[0]), rad(cam[1]), cam[2]], opt.lite === "1" ? "true" : "false", opt.smooth === "1"]);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", name, e.message.slice(0, 300)));
  await page.goto(`${HOST}${url}`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector("canvas", { timeout: 300000 });
  if (url.startsWith("/lab/island") || url.startsWith("/student/dashboard")) {
    await page.waitForFunction(() => !!window.__move?.sim?.current, null, { timeout: 300000 }).catch(() => {});
  }
  await page.waitForTimeout(Number(opt.settle ?? 9000));
  // A development server is slow to settle: adaptive quality may have stepped down meanwhile. Shots are of the settings as chosen.
  if (await page.evaluate(() => { const g = window.__governor; if (!g) return false; g.hold = 1e9; g.set(0); return true; }).catch(() => false)) await page.waitForTimeout(1500);
  for (const step of steps) {
    const [k, v = ""] = step.split(/=(.*)/s);
    if (k === "wait") await page.waitForTimeout(Number(v));
    else if (k === "nohud") await page.addStyleTag({ content: "main > :not(:has(canvas)), nav, nextjs-portal, #island-options, [aria-controls='island-options'] { visibility: hidden !important; }" });
    else if (k === "eval") console.log("eval", name, JSON.stringify(await page.evaluate(v)));
    else if (k === "key") { const [key, ms] = v.split(":"); await page.keyboard.down(key); await page.waitForTimeout(Number(ms)); await page.keyboard.up(key); }
    else if (k === "press") await page.keyboard.press(v);
  }
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log("wrote", `${OUT}/${name}.png`);
  await ctx.close();
}
await browser.close();
