// Remodel-r2 evidence: the game's own frame (post FX, light, shadows) of each remodelled thing from a fixed camera, so a
// before run (the tree at the step-1 commit) and an after run (this lane) frame it the same. Headless Chromium, muted,
// against a dev server with the Supabase env blanked. Run from web/:
//   PORT=3183 node ../specs/evidence/remodel-r2/tools/ingame.mjs <out-dir> <before|after|draft> <scene> [shot,shot,...]
// <scene>: day-<season> (spring|summer|autumn|winter). "draft" walks /lab/island?draft=1 with the shipped village plus
// the plaza and pier tables in their classic look and a run of connectable fence by the spawn (lab-map draft storage).
// Each shot: the player teleported to the target to read its ground (the walker's height there), then behind the camera; the main pass handed a camera
// at (azimuth from -z toward +x, elevation, distance) round the target through three's devtools hook (no game code
// changes). Writes <out-dir>/<shot>.<scene>.<phase>.png.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [outDir, phase, scene, only] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3183;
mkdirSync(outDir, { recursive: true });
const season = scene.replace(/^day-/, "");

/** The demo fence run for the draft: a straight run, a corner, a tee and a post alone, on the lawn north of the spawn. */
export const DEMO_FENCE = [[-3, -6], [-2, -6], [-1, -6], [0, -6], [0, -5], [0, -4], [-2, -5], [2, -6]];
const SHOTS = [
  { id: "bush-a", at: [-5, -9], lift: 0.45, az: 60, el: 22, d: 3.4 },
  { id: "bush-a-back", at: [-5, -9], lift: 0.45, az: 180, el: 22, d: 3.4 },
  { id: "bush-b", at: [6, -9.5], lift: 0.45, az: 0, el: 22, d: 3.4 },
  { id: "bush-b-back", at: [6, -9.5], lift: 0.45, az: 180, el: 22, d: 3.4 },
  { id: "shell-a", at: [-8.3, -17.05], lift: 0.05, az: 10, el: 40, d: 1.4 },
  { id: "shell-b", at: [8.598, -16.948], lift: 0.05, az: -10, el: 40, d: 1.4 },
  { id: "museum-door", at: [11, 7.15], lift: 0.35, az: 20, el: 26, d: 4.4 },
  { id: "study-picnic", at: [2.4, 2.6], lift: 0.5, az: 35, el: 30, d: 3.4 },
  { id: "study-pier", at: [4.6, -17.6], lift: 0.5, az: 25, el: 30, d: 3.0 },
  { id: "fence-run", at: [-0.5, -5.1], lift: 0.3, az: 25, el: 32, d: 7.2, draft: true },
  { id: "fence-run-top", at: [-0.5, -5.1], lift: 0.3, az: 0, el: 64, d: 8, draft: true },
].filter(s => (!only || only.split(",").includes(s.id)) && (phase === "draft" || !s.draft));

const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
let draft = null;
if (phase === "draft") {
  const doc = JSON.parse(readFileSync(join(process.cwd(), "data/village-map.json"), "utf8"));
  doc.objects = doc.objects.map(o => (o.kind === "study" ? { ...o, model: `${o.model}-classic` } : o));
  DEMO_FENCE.forEach(([x, z], i) => doc.objects.push({ id: `fence-${i}`, kind: "fence", x, z, model: "fence-joined" }));
  draft = JSON.stringify(doc);
}
const INIT = ({ look, draft }) => {
  try {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.pixelated.v1", "false");
    localStorage.setItem("tsi.welcomed.v1", "1"); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 0, pitch: 0.6, zoom: 1, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
    if (draft) localStorage.setItem("lab-map-village-draft-v1", draft);
  } catch { /* storage blocked: defaults */ }
  const audit = { renderers: [], cam: null, main: null, gameCam: null };
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
  // Characters between the camera and the target (residents walk their routines): hidden for the shot.
  const P = cam.position, T = cam.position.clone().set(...target), dir = T.clone().sub(P), far = dir.length() * 0.85;
  dir.normalize();
  A.hidden = [];
  const w = P.clone();
  A.main.traverse(o => {
    if (!o.isSkinnedMesh || !o.visible) return;
    o.getWorldPosition(w);
    const v = w.sub(P), dd = v.length();
    if (dd < far && v.normalize().dot(dir) > Math.cos(0.6)) { o.visible = false; A.hidden.push(o); }
  });
  return true;
};
const UNAIM = () => { const A = window.__audit; A.cam = null; for (const o of A.hidden ?? []) o.visible = true; A.hidden = []; };

const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 }, deviceScaleFactor: 1 });
await ctx.addInitScript(INIT, { look: LOOK, draft });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 160)));
await page.goto(`http://localhost:${PORT}/lab/island?time=day&weather=clear&season=${season}${phase === "draft" ? "&draft=1" : ""}`);
await page.waitForFunction(() => !!window.__move?.sim?.current, null, { timeout: 420000 });
await page.waitForTimeout(12000);
await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
await page.waitForTimeout(1500);
await page.addStyleTag({ content: "body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}" });
const rect = await page.evaluate(() => { const c = window.__audit.renderers[0].domElement.getBoundingClientRect(); return { x: c.x, y: c.y, w: c.width, h: c.height }; });
const side = Math.min(rect.w, rect.h);
const clip = { x: rect.x + (rect.w - side) / 2, y: rect.y + (rect.h - side) / 2, width: side, height: side };
for (const s of SHOTS) {
  await page.evaluate(([x, z]) => window.__move.teleport(x, z, 0), s.at);
  await page.waitForTimeout(500);
  const y = await page.evaluate(() => window.__move.sim.current.state.y ?? 0);
  // The player behind the camera, out of the shot.
  const a = s.az * Math.PI / 180, e = s.el * Math.PI / 180, back = Math.cos(e) * s.d + 1.4;
  await page.evaluate(([x, z]) => window.__move.teleport(x, z, 0), [s.at[0] + Math.sin(a) * back, s.at[1] - Math.cos(a) * back]);
  await page.waitForTimeout(1800);
  const target = [s.at[0], y + s.lift, s.at[1]];
  const pos = [target[0] + Math.sin(a) * Math.cos(e) * s.d, target[1] + Math.sin(e) * s.d, target[2] - Math.cos(a) * Math.cos(e) * s.d];
  await page.evaluate(AIM, { pos, target, fov: 40 });
  await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res)))));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, `${s.id}.${scene}.${phase}.png`), clip });
  await page.evaluate(UNAIM);
  console.log("shot", s.id, scene, phase, "ground", y.toFixed(2));
}
await ctx.close();
await browser.close();
