// Remodel-ground evidence: the game's own frame (post FX, light, shadows) of the ground from fixed cameras, so a before
// run (main's tree) and an after run (this lane) frame it the same. Headless Chromium, muted, against a dev server with
// the Supabase env blanked. Run from web/:
//   PORT=3187 node ../specs/evidence/remodel-ground/tools/shots.mjs <out-dir> <before|after> <scene> [shot,shot,...]
// <scene>: autumn | winter (the village by day in that season) | v2 (the smooth world, autumn) | terrain (the test
// island's cliffs and rock, autumn).
// Each shot teleports the player to its spot and hands the main pass a camera at (azimuth from -z toward +x, elevation,
// distance) round a look point above the player's ground, through three's devtools hook (no game code changes). The
// gameplay shots use the orbit camera's own distance, tilt and FOV (lib/game/orbitCamera.ts); `feet` is a close-up.
// Writes <out-dir>/<shot>.<scene>.<phase>.png.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [outDir, phase, scene, only] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3187;
mkdirSync(outDir, { recursive: true });

/** The orbit camera's follow: (0, 7.4, -10.8) from the look point, FOV 48. */
const GAME = { el: (Math.atan2(7.4, 10.8) * 180) / Math.PI, d: Math.hypot(7.4, 10.8), fov: 48, lift: 0.9 };
const FEET = { az: 150, el: 36, d: 2.7, fov: 40, lift: 0.35 };
const VILLAGE = [
  { id: "plaza", at: [-1.5, 3.2], az: 0, ...GAME },
  { id: "beach", at: [2.5, -17.2], az: 160, ...GAME },
  { id: "path", at: [6, -9.5], az: 0, ...GAME },
  { id: "river", at: [-19, -1.8], az: 0, ...GAME },
  { id: "feet", at: [4, -6], ...FEET },
  { id: "feet-sand", at: [-3, -17.3], ...FEET },
  { id: "feet-path", at: [0, -12.5], ...FEET },
  { id: "feet-plaza", at: [-1, 4], ...FEET, az: 200 },
  { id: "feet-bridge", at: [0, 0.6], ...FEET, az: 200 },
  { id: "overview", at: [0, 0], az: 0, el: 89, d: 75, fov: 48, lift: 0 },
];
const V2 = [
  { id: "v2", at: [44, 50], az: 0, ...GAME },
  { id: "v2-feet", at: [44, 50], ...FEET },
];
/** The natural-terrain test island (lib/game/fixtures/terrainFixture.ts): the cliff kit's ring and the steep mountain's rock. */
const TERRAIN = [
  { id: "cliff", at: [12, -15.5], az: 0, ...GAME },
  { id: "cliff-close", at: [12, -14.6], az: 10, el: 22, d: 3.4, fov: 40, lift: 0.8 },
  { id: "mountain", at: [-12, -14], az: 0, ...GAME },
];
const SHOTS = (scene === "v2" ? V2 : scene === "terrain" ? TERRAIN : VILLAGE).filter(s => !only || only.split(",").includes(s.id));
const season = scene === "v2" || scene === "terrain" ? "autumn" : scene;
const query = `time=day&weather=clear&season=${season}${scene === "v2" || scene === "terrain" ? `&fixture=${scene}` : ""}`;

const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const INIT = ({ look }) => {
  try {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.pixelated.v1", "false");
    localStorage.setItem("tsi.welcomed.v1", "1"); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 0, pitch: 0.6, zoom: 1, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
  } catch { /* storage blocked: defaults */ }
  const audit = { renderers: [], main: null, gameCam: null, cam: null };
  window.__audit = audit;
  const hook = new EventTarget();
  hook.addEventListener("observe", e => {
    const o = e.detail;
    if (o?.isWebGLRenderer) {
      audit.renderers.push(o);
      const render = o.render.bind(o);
      o.render = (sc, camera) => {
        if (sc?.isScene && camera?.isPerspectiveCamera) {
          if (!audit.main || sc.children.length >= audit.main.children.length) audit.main = sc;
          if (sc === audit.main) audit.gameCam = camera;
          if (audit.cam && sc === audit.main) return render(sc, audit.cam);
        }
        return render(sc, camera);
      };
    }
  });
  window.__THREE_DEVTOOLS__ = hook;
};
const AIM = ({ pos, target, fov }) => {
  const A = window.__audit, src = A.gameCam;
  if (!src) return false;
  const cam = src.clone();
  const canvas = A.renderers[0].domElement;
  cam.fov = fov; cam.aspect = canvas.clientWidth / canvas.clientHeight; cam.near = 0.05; cam.far = 400;
  cam.position.set(...pos); cam.up.set(0, 1, 0); cam.lookAt(...target); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  A.cam = cam;
  return true;
};
const UNAIM = () => { window.__audit.cam = null; };

const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 1 });
await ctx.addInitScript(INIT, { look: LOOK });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 160)));
page.on("console", m => { if (/THREE\.WebGL|Shader Error|ERROR: 0:/.test(m.text())) console.log("console", m.text().slice(0, 400)); });
await page.goto(`http://localhost:${PORT}/lab/island?${query}`, { timeout: 420000 });
await page.waitForFunction(() => !!window.__move?.sim?.current, null, { timeout: 420000 });
await page.waitForTimeout(12000);
await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
await page.waitForTimeout(1500);
await page.addStyleTag({ content: "body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}" });
const rect = await page.evaluate(() => { const c = window.__audit.renderers[0].domElement.getBoundingClientRect(); return { x: c.x, y: c.y, w: c.width, h: c.height }; });
const clip = { x: rect.x, y: rect.y, width: rect.w, height: rect.h };
for (const s of SHOTS) {
  await page.evaluate(([x, z]) => window.__move.teleport(x, z, 0), s.at);
  await page.waitForTimeout(2200);
  const y = await page.evaluate(() => window.__move.sim.current.state.y ?? 0);
  const a = (s.az * Math.PI) / 180, e = (s.el * Math.PI) / 180;
  const target = [s.at[0], y + s.lift, s.at[1]];
  const pos = [target[0] + Math.sin(a) * Math.cos(e) * s.d, target[1] + Math.sin(e) * s.d, target[2] - Math.cos(a) * Math.cos(e) * s.d];
  await page.evaluate(AIM, { pos, target, fov: s.fov });
  await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res)))));
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(outDir, `${s.id}.${scene}.${phase}.png`), clip });
  await page.evaluate(UNAIM);
  console.log("shot", s.id, scene, phase, "ground", y.toFixed(2));
}
await ctx.close();
await browser.close();
