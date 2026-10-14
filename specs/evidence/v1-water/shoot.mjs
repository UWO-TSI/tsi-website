// v1 water and wharf evidence (specs/v1-drop.md §8c): the same views before and after, at the wharf, the beach, the
// shallows and the open sea, by day and at dusk. Headless (WebGL on the GPU through Metal), muted, never brought to the
// front; signed out on the dev server with the Supabase env blanked; the shared browser lock held by the caller.
//   PORT=3166 node specs/evidence/v1-water/shoot.mjs <out_dir> <label> [views] [times]
// views: wharf, beach, shallows, sea, wharf-top (default the first four); times: day, dusk (default both).
// Env: TIER=high|lite (default high), EXTRA="&glass=0" (more query), WAIT (ms after load, default 6000).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT = "/tmp/v1-water", LABEL = "after", VIEWS = "wharf,beach,shallows,sea", TIMES = "day,dusk"] = process.argv.slice(2);
const HOST = `http://localhost:${process.env.PORT ?? 3166}`, TIER = process.env.TIER ?? "high", WAIT = Number(process.env.WAIT ?? 6000);
mkdirSync(OUT, { recursive: true });
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
/** Where the player stands (village map) and the camera: yaw, pitch (degrees), zoom. Yaw 180 looks east, out to sea. */
const VIEW = {
  wharf: { at: [8, -17.4], cam: [180, 40, 1.35] },
  "wharf-top": { at: [7, -20.5], cam: [205, 58, 1.7] },
  beach: { at: [1.5, -17.6], cam: [155, 42, 1.15] },
  shallows: { at: [3, -18.6], cam: [215, 62, 0.85] },
  sea: { at: [8, -22.9], cam: [180, 20, 1.6] },
};
const TIME = { day: "at=13:30&date=2026-10-13", dusk: "at=18:25&date=2026-10-13" };
const rad = d => (d * Math.PI) / 180;

const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
for (const view of VIEWS.split(",")) for (const time of TIMES.split(",")) {
  const v = VIEW[view];
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([look, cam, lite]) => { try {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.welcomed.v1", "1");
    localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
    localStorage.setItem("tsi.liteMode.v1", String(lite)); localStorage.setItem("tsi.shadows.v1", String(!lite));
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: cam[0], pitch: cam[1], zoom: cam[2], sensitivity: 1, invertY: false, mouseLook: true, autoFollow: false }));
  } catch {} }, [JSON.stringify(LOOK), [rad(v.cam[0]), rad(v.cam[1]), v.cam[2]], TIER === "lite"]);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
  await page.goto(`${HOST}/lab/island?at=${v.at.join(",")}&${TIME[time]}&weather=clear${process.env.EXTRA ?? ""}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !!window.__move?.sim?.current, null, { timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 300000 }).catch(() => console.log("still preparing"));
  // Adaptive quality must not step down mid-shot (a dev server is slow to settle).
  await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; } main > :not(:has(canvas)):not([class*=veil]), nav { visibility: hidden !important; }" }).catch(() => {});
  await page.waitForTimeout(WAIT);
  const file = `${OUT}/${LABEL}-${view}-${time}${TIER === "lite" ? "-lite" : ""}.png`;
  await page.screenshot({ path: file });
  console.log("wrote", file);
  await ctx.close();
}
await browser.close();
