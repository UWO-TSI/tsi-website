// rod-gear round 9 (the Tidewarden in hand), from tool-pipeline rods-r2/shoot.mjs: headless Chromium only, muted, signed out, against a dev server with
// the Supabase env blanked. Never headed. One browser and one page for every shot (the island's assets stay cached).
//   HOST=http://localhost:3347 node specs/evidence/rod-gear/r9/hand.mjs <out_dir> <shot> ...
// A shot: <name>=<rod file>@<time>[@yaw,pitch,zoom][@strip]. The Flimsy rod (everyone's starter) goes in hand and its
// GLB is answered with <rod file> from web/public/assets/game/tools/, so any rod is held as the game holds it (its
// effect is named by its own GLB, RodAura). `strip` takes six frames a quarter second apart (the idle animation).
// CLIP=x,y,w,h crops every frame; W and H set the viewport (a phone: W=390 H=844).
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const [OUT, ...SHOTS] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3347";
const CLIP = process.env.CLIP ? (([x, y, width, height]) => ({ x, y, width, height }))(process.env.CLIP.split(",").map(Number)) : undefined;
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
const rad = d => (Number(d) * Math.PI) / 180;
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: Number(process.env.W ?? 1280), height: Number(process.env.H ?? 800) }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
let rodFile = "rod-1.glb";
await page.route("**/assets/game/tools/rod-1.glb", r => r.fulfill({ status: 200, contentType: "model/gltf-binary", body: readFileSync(join(ROOT, "web/public/assets/game/tools", rodFile)) }));

for (const shot of SHOTS) {
  const [name, spec] = shot.split("=");
  const [rod, time, cam = "200,12,0.55", ...flags] = spec.split("@");
  rodFile = rod;
  await page.goto(`${HOST}/student/opening-soon`, { waitUntil: "domcontentloaded" });
  const [yaw, pitch, zoom] = cam.split(",").map(Number);
  await page.evaluate(([look, c]) => {
    localStorage.clear();
    const kv = { "tsi.look.v1": look, "tsi.pixelated.v1": "false", "tsi.welcomed.v1": "1", "tsi.dock.cleared": "1",
      "tsi.held.v1": JSON.stringify({ held: "rod:rod_flimsy", last: null, pins: [], chosen: { rod: "rod_flimsy" } }),
      "tsi.camera.v1": JSON.stringify({ yaw: c[0], pitch: c[1], zoom: c[2], sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false }) };
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
  }, [JSON.stringify(LOOK), [rad(yaw), rad(pitch), zoom]]);
  await page.goto(`${HOST}/lab/island?weather=clear&season=summer&time=${time}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => ![...document.querySelectorAll("[role=status]")].some(e => /Preparing|Tethos Island/.test(e.textContent) && !e.hasAttribute("data-leaving")), null, { timeout: 300000, polling: 250 }).catch(() => console.log(name, "still preparing"));
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; } main > :not(:has(canvas)), nav { visibility: hidden !important; }" });
  await page.waitForTimeout(Number(process.env.WAIT ?? 7000));
  const frames = flags.includes("strip") ? 6 : 1;
  for (let f = 0; f < frames; f++) {
    await page.screenshot({ path: `${OUT}/${name}${frames > 1 ? `-${f}` : ""}.png`, clip: CLIP });
    if (frames > 1) await page.waitForTimeout(250);
  }
  console.log("shot", name, rod, time);
}
await browser.close();
