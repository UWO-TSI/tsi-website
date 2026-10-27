// Remodel evidence (game/remodel), after remodel-props/tools/ingame-pair.mjs: the game's own frame (post FX, light,
// shadows) of each remodelled model where it stands in the new world, before and after. Headless Chromium, muted,
// against a dev server (Supabase env blanked, NEXT_PUBLIC_GAME_WORLD=new) on PORT. Run from web/:
//   PORT=3191 node ../specs/evidence/remodel/tools/ingame.mjs <stats.json> <out-dir> before|after [id,id,...]
// Finds the model in the live scene by primitive signature (stats.json from glb-stats.mjs over the old and new GLBs),
// picks the instance nearest a stop, aims a camera at it (the player stepped aside). Static props: `before` writes the
// camera to cams.json and `after` reuses it, so both frames match. Moving things (critters): each run frames its own.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [statsFile, outDir, mode, only] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3191;
mkdirSync(outDir, { recursive: true });
const SIGS = {};
for (const s of JSON.parse(readFileSync(statsFile, "utf8"))) SIGS[s.file] = s.sig;
const camsFile = join(outDir, "cams.json");
const cams = existsSync(camsFile) ? JSON.parse(readFileSync(camsFile, "utf8")) : {};

const A = "/assets/acnh/", G = "/assets/game/";
/** Each shot: the old and new files, where to look from (a stop near it), the camera's turn and distance factor. */
const SHOTS = [
  { id: "market-barrel", old: [`${A}furniture/barrel.glb`], new: [`${G}props/market-barrel.glb`], stop: [66, 28], az: 200, el: 24, k: 2.2 },
  { id: "market-cart", old: [`${A}props/market-cart.glb`], new: [`${G}props/market-cart.glb`], stop: [66, 36], az: 250, el: 24, k: 1.15 },
  { id: "lighthouse", old: [`${A}furniture/lighthouse.glb`], new: [`${G}props/lighthouse.glb`], stop: [118, 98], az: 300, el: 14, k: 1.25 },
  { id: "butterflies", old: [`${A}critters/common-butterfly.glb`, `${A}critters/tiger-butterfly.glb`, `${A}critters/monarch-butterfly.glb`, `${A}critters/agrias-butterfly.glb`, `${A}critters/peacock-butterfly.glb`],
    new: [`${G}critters/common-butterfly.glb`, `${G}critters/tiger-butterfly.glb`, `${G}critters/monarch-butterfly.glb`, `${G}critters/agrias-butterfly.glb`, `${G}critters/peacock-butterfly.glb`],
    stop: [30, 52], az: 30, el: 20, k: 1.6, moving: true },
  { id: "crabs", old: [`${A}props/crab-gazami.glb`, `${A}props/crab-hermit.glb`], new: [`${G}critters/crab-swimmer.glb`, `${G}critters/crab-hermit.glb`], stop: [-8, 100], az: 20, el: 35, k: 1.4, moving: true },
  { id: "gather-rocks", old: [`${A}props/rock-a.glb`], new: [`${G}props/gather-rock-a.glb`], stop: [55.8, 63], az: 160, el: 30, k: 2.4 },
  { id: "rope-fence", old: [`${A}props/fence-rope-a.glb`], new: [`${G}props/rope-fence.glb`], stop: [21.5, 52], az: 150, el: 28, k: 2.2 },
  { id: "fish", old: [`${A}fish/sea-bass.glb`, `${A}fish/horse-mackerel.glb`], new: [`${G}fish/sea-bass.glb`, `${G}fish/horse-mackerel.glb`], stop: [68, 46], az: 20, el: 50, k: 2, moving: true },
].filter(s => !only || only.split(",").includes(s.id));

const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const INIT = ({ look }) => {
  try {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.pixelated.v1", "false");
    localStorage.setItem("tsi.welcomed.v1", "1"); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
  } catch { /* storage blocked: defaults */ }
  const audit = { renderers: [], cam: null, main: null, gameCam: null };
  window.__audit = audit;
  const hook = new EventTarget();
  hook.addEventListener("observe", e => {
    const o = e.detail;
    if (!o?.isWebGLRenderer) return;
    audit.renderers.push(o);
    const render = o.render.bind(o);
    o.render = (scene, camera) => {
      if (scene?.isScene && camera?.isPerspectiveCamera) {
        if (!audit.main || scene.children.length >= audit.main.children.length) audit.main = scene;
        if (scene === audit.main) audit.gameCam = camera;
        if (audit.cam && scene === audit.main) return render(scene, audit.cam);
      }
      return render(scene, camera);
    };
  });
  window.__THREE_DEVTOOLS__ = hook;
};
/** In the page: world boxes of every mesh whose signature is one of `sigs` (instances expanded). */
const FIND = sigs => {
  const S = window.__audit.main;
  if (!S) return [];
  S.updateMatrixWorld(true);
  const out = [];
  S.traverse(o => {
    if (!o.isMesh || !o.visible || !o.geometry?.attributes?.position) return;
    const g = o.geometry, mats = Array.isArray(o.material) ? o.material : [o.material];
    const sig = `${g.attributes.position.count}|${g.index ? g.index.count : 0}|${mats[0]?.name ?? ""}`;
    if (!sigs.includes(sig)) return;
    if (!g.boundingBox) g.computeBoundingBox();
    const M = o.matrixWorld.clone(), I = o.matrixWorld.clone();
    const n = o.isInstancedMesh ? o.count : 1;
    for (let k = 0; k < n; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, I); M.multiplyMatrices(o.matrixWorld, I); }
      const b = g.boundingBox.clone().applyMatrix4(M);
      if (Number.isFinite(b.min.x) && b.max.x - b.min.x < 50) out.push([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]);
    }
  });
  return out;
};
const AIM = ({ pos, target, fov }) => {
  const A = window.__audit, src = A.gameCam;
  if (!src) return false;
  const cam = src.clone();
  const canvas = A.renderers[0].domElement;
  cam.fov = fov; cam.aspect = canvas.clientWidth / canvas.clientHeight; cam.near = 0.05; cam.far = 600;
  cam.position.set(...pos); cam.up.set(0, 1, 0); cam.lookAt(...target); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  A.cam = cam;
  const P = cam.position, T = cam.position.clone().set(...target), dir = T.clone().sub(P), far = dir.length() * 0.85;
  dir.normalize();
  A.hidden = [];
  const w = P.clone();
  A.main.traverse(o => {
    if (!o.isSkinnedMesh || !o.visible) return;
    o.getWorldPosition(w);
    const v = w.sub(P), d = v.length();
    if (d < far && v.normalize().dot(dir) > Math.cos(0.6)) { o.visible = false; A.hidden.push(o); }
  });
  return true;
};
const UNAIM = () => { const A = window.__audit; A.cam = null; for (const o of A.hidden ?? []) o.visible = true; A.hidden = []; };
const centre = b => [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2];

const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await ctx.addInitScript(INIT, { look: LOOK });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 160)));
await page.goto(`http://localhost:${PORT}/lab/island?fixture=v2&time=day&weather=clear&season=summer`);
await page.waitForFunction(() => !!window.__move?.sim?.current, null, { timeout: 420000 });
await page.waitForTimeout(12000);
await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
await page.addStyleTag({ content: "body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}" });
const rect = await page.evaluate(() => { const c = window.__audit.renderers[0].domElement.getBoundingClientRect(); return { x: c.x, y: c.y, w: c.width, h: c.height }; });
const side = Math.min(rect.w, rect.h);
const clip = { x: rect.x + (rect.w - side) / 2, y: rect.y + (rect.h - side) / 2, width: side, height: side };
for (const s of SHOTS) {
  const files = mode === "before" ? s.old : s.new;
  let cam = cams[s.id];
  if (mode === "before" || s.moving || !cam) {
    await page.evaluate(([x, z]) => window.__move.teleport(x, z, 0), s.stop);
    await page.waitForTimeout(6000);
    const sigs = files.flatMap(f => SIGS[f] ?? []);
    let boxes = [];
    for (let tries = 0; tries < 6 && !boxes.length; tries++) { boxes = await page.evaluate(FIND, sigs); if (!boxes.length) await page.waitForTimeout(3000); }
    if (!boxes.length) { console.log("NOT FOUND", s.id, mode); continue; }
    boxes.sort((p, q) => Math.hypot(centre(p)[0] - s.stop[0], centre(p)[2] - s.stop[1]) - Math.hypot(centre(q)[0] - s.stop[0], centre(q)[2] - s.stop[1]));
    const box = boxes[0], c = centre(box), r = Math.max(0.15, Math.hypot(box[3] - box[0], box[4] - box[1], box[5] - box[2]) / 2), fov = 40;
    const d = Math.max(r / Math.sin((fov / 2) * Math.PI / 180) * 1.25, 1.2) * s.k, a = s.az * Math.PI / 180, e = s.el * Math.PI / 180;
    const pos = [c[0] + Math.sin(a) * Math.cos(e) * d, c[1] + Math.sin(e) * d, c[2] - Math.cos(a) * Math.cos(e) * d];
    const right = [-Math.cos(a), -Math.sin(a)], off = r + 1.2;
    cam = { pos, target: c, fov, teleport: [c[0] + right[0] * off, c[2] + right[1] * off] };
    if (mode === "before") cams[s.id] = cam;
  }
  await page.evaluate(([x, z]) => window.__move.teleport(x, z, 0), cam.teleport);
  await page.waitForTimeout(s.moving ? 300 : 2500);
  await page.evaluate(AIM, cam);
  await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res)))));
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, `${s.id}.${mode}.png`), clip });
  await page.evaluate(UNAIM);
  console.log("shot", s.id, mode);
}
await browser.close();
if (mode === "before") writeFileSync(camsFile, JSON.stringify(cams, null, 1));
