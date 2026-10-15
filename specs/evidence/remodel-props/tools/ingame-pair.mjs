// Remodel-props evidence: the game's own frame (post FX, light, shadows) of each remodelled prop, before and after, from
// the SAME camera. Headless Chromium, muted, against a dev server with the Supabase env blanked. Run from web/:
//   PORT=3181 node ../specs/evidence/remodel-props/tools/ingame-pair.mjs <out-dir> before [id,id,...]
//   PORT=3181 node ../specs/evidence/remodel-props/tools/ingame-pair.mjs <out-dir> after  [id,id,...]
// before: finds the old model in the live scene by primitive signature (old-sigs.json, from glb-stats.mjs), aims a
//   camera at the instance nearest the spawn (the player teleported beside it, off the line of sight), writes
//   <out-dir>/<id>.before.png and the camera into <out-dir>/cams.json.
// after: reads cams.json, puts the player and the camera back exactly there, writes <out-dir>/<id>.after.png.
// The main pass is handed the audit camera through three's devtools hook (the asset audit's technique), so no game
// code changes.
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const HERE = dirname(fileURLToPath(import.meta.url));
const [outDir, mode, only] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3181;
mkdirSync(outDir, { recursive: true });
const SIGS = JSON.parse(readFileSync(join(HERE, "old-sigs.json"), "utf8"));
const camsFile = join(outDir, "cams.json");
const cams = existsSync(camsFile) ? JSON.parse(readFileSync(camsFile, "utf8")) : {};

const DAY = "weather=clear&season=autumn&tradition=halloween";
const SCENES = {
  village: { url: `/lab/island?time=day&${DAY}`, outdoor: true },
  "village-night": { url: `/lab/island?time=night&${DAY}`, outdoor: true },
  hq: { url: `/lab/island?time=day&${DAY}&hq=inside`, outdoor: false },
};
const A = "/assets/acnh/";
/** Each shot: its scene, the old files it frames, and the camera's turn (az from -z toward +x, el up), distance factor. */
const SHOTS = [
  { id: "campfire", scene: "village", files: [`${A}props/campfire.glb`], az: 30, el: 28, k: 1 },
  { id: "campfire-night", scene: "village-night", same: "campfire" },
  { id: "mailbox", scene: "village", files: [`${A}furniture/mailbox.glb`], az: 200, el: 22, k: 1.1 },
  { id: "streetlamp", scene: "village", files: [`${A}props/streetlamp.glb`], az: 25, el: 18, k: 1 },
  { id: "streetlamp-night", scene: "village-night", same: "streetlamp" },
  { id: "museum-door-fence", scene: "village", files: [`${A}props/fence-country-b.glb`], az: 20, el: 30, k: 1.1, tp: [-4, -3] },
  { id: "buoy", scene: "village", files: [`${A}props/buoy.glb`], az: 30, el: 22, k: 1.2 },
  { id: "rowboat", scene: "village", files: ["/assets/game/wharf/rowboat.glb"], az: 40, el: 32, k: 1.1 },
  { id: "study-table", scene: "village", files: [`${A}furniture/reading-table.glb`, `${A}furniture/lounge-book.glb`], az: 35, el: 30, k: 1 },
  { id: "hq-lamps", scene: "hq", files: [`${A}furniture/floor-lamp.glb`], from: [1.7, 2.3, -0.9], look: [5.7, 1.75, 3.9], walk: [-3, -1] },
  { id: "welcome-mat", scene: "hq", files: [`${A}furniture/yellow-message-mat.glb`], from: [1.6, 2.4, -2.6], look: [0, 0.02, -5.1], walk: [-3, -1] },
].filter(s => !only || only.split(",").includes(s.id));

const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const INIT = ({ look }) => {
  try {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.pixelated.v1", "false");
    localStorage.setItem("tsi.welcomed.v1", "1"); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 0, pitch: 0.6, zoom: 1, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
  } catch { /* storage blocked: defaults */ }
  const audit = { renderers: [], cam: null, main: null, gameCam: null };
  window.__audit = audit;
  const hook = new EventTarget();
  hook.addEventListener("observe", e => {
    const o = e.detail;
    if (o?.isWebGLRenderer) {
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
    }
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
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const g = o.geometry, mats = Array.isArray(o.material) ? o.material : [o.material];
    const sig = `${g.attributes.position.count}|${g.index ? g.index.count : 0}|${mats[0]?.name ?? ""}`;
    if (!sigs.includes(sig)) return;
    if (!g.boundingBox) g.computeBoundingBox();
    const M = o.matrixWorld.clone(), I = o.matrixWorld.clone();
    const n = o.isInstancedMesh ? o.count : 1;
    for (let k = 0; k < n; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, I); M.multiplyMatrices(o.matrixWorld, I); }
      const b = g.boundingBox.clone().applyMatrix4(M);
      out.push([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]);
    }
  });
  return out;
};

/** In the page: hand the main pass a camera at `pos` looking at `target`. */
const AIM = ({ pos, target, fov }) => {
  const A = window.__audit, src = A.gameCam;
  if (!src) return false;
  const cam = src.clone();
  const canvas = A.renderers[0].domElement;
  cam.fov = fov; cam.aspect = canvas.clientWidth / canvas.clientHeight; cam.near = 0.05; cam.far = 400;
  cam.position.set(...pos); cam.up.set(0, 1, 0); cam.lookAt(...target); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  A.cam = cam;
  // Characters (players and residents walk their routines) standing between the camera and the prop: hidden for the shot.
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
for (const sceneName of [...new Set(SHOTS.map(s => s.scene))]) {
  const sc = SCENES[sceneName];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(INIT, { look: LOOK });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log(sceneName, "pageerror", e.message.slice(0, 160)));
  await page.goto(`http://localhost:${PORT}${sc.url}`);
  if (sc.outdoor) await page.waitForFunction(() => !!window.__move?.sim?.current, null, { timeout: 420000 });
  else await page.waitForFunction(() => !!window.__audit?.main, null, { timeout: 420000 });
  await page.waitForTimeout(12000);
  await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
  await page.waitForTimeout(1500);
  await page.addStyleTag({ content: "body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}" });
  const spawn = sc.outdoor ? await page.evaluate(() => { const s = window.__move.sim.current.state; return [s.x, s.z]; }) : [0, 0];
  const rect = await page.evaluate(() => { const c = window.__audit.renderers[0].domElement.getBoundingClientRect(); return { x: c.x, y: c.y, w: c.width, h: c.height }; });
  const side = Math.min(rect.w, rect.h);
  const clip = { x: rect.x + (rect.w - side) / 2, y: rect.y + (rect.h - side) / 2, width: side, height: side };
  for (const s of SHOTS.filter(x => x.scene === sceneName)) {
    let cam = cams[s.same ?? s.id];
    if (mode === "before" && !s.same) {
      const sigs = s.files.flatMap(f => SIGS[f] ?? []);
      const boxes = await page.evaluate(FIND, sigs);
      if (!boxes.length) { console.log("NOT FOUND", s.id); continue; }
      const sorted = boxes.slice().sort((p, q) => Math.hypot(centre(p)[0] - spawn[0], centre(p)[2] - spawn[1]) - Math.hypot(centre(q)[0] - spawn[0], centre(q)[2] - spawn[1]));
      const pick = sorted[0];
      // The picked instance joined with the shot's other parts close by (a table's book, the other fence segment).
      let box = pick.slice();
      const grow = [pick[3] - pick[0], pick[4] - pick[1], pick[5] - pick[2]].map(x => x * 0.8 + 0.3);
      for (const b of boxes) {
        const c = centre(b);
        if ([0, 1, 2].every(k => c[k] > pick[k] - grow[k] && c[k] < pick[k + 3] + grow[k])) box = [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.min(box[2], b[2]), Math.max(box[3], b[3]), Math.max(box[4], b[4]), Math.max(box[5], b[5])];
      }
      const c = centre(box), r = Math.max(0.2, Math.hypot(box[3] - box[0], box[4] - box[1], box[5] - box[2]) / 2), fov = 40;
      let pos, teleport = null;
      if (s.look) c.splice(0, 3, ...s.look);
      if (s.from) pos = s.from;
      else {
        const d = Math.max(r / Math.sin((fov / 2) * Math.PI / 180) * 1.25, 2.2) * s.k;
        const a = s.az * Math.PI / 180, e = s.el * Math.PI / 180;
        pos = [c[0] + Math.sin(a) * Math.cos(e) * d, c[1] + Math.sin(e) * d, c[2] - Math.cos(a) * Math.cos(e) * d];
        const right = [-Math.cos(a), -Math.sin(a)], off = r + 0.9;
        teleport = s.tp ? [c[0] + s.tp[0], c[2] + s.tp[1]] : [c[0] + right[0] * off, c[2] + right[1] * off];
      }
      cam = { pos, target: c, fov, teleport, walk: s.walk ?? null, box };
      cams[s.id] = cam;
    }
    if (!cam) { console.log("NO CAMERA", s.id, "(run before first)"); continue; }
    if (cam.teleport && sc.outdoor) { await page.evaluate(([x, z]) => window.__move.teleport(x, z, 0), cam.teleport); await page.waitForTimeout(1500); }
    // Indoors: walk the player off the shot (the room's click-to-walk event).
    if (cam.walk && !sc.outdoor) { await page.evaluate(([x, z]) => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x, z } })), cam.walk); await page.waitForTimeout(3500); }
    await page.evaluate(AIM, cam);
    await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res)))));
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(outDir, `${s.id}.${mode}.png`), clip });
    await page.evaluate(UNAIM);
    console.log("shot", s.id, mode);
  }
  await ctx.close();
}
await browser.close();
if (mode === "before") writeFileSync(camsFile, JSON.stringify(cams, null, 1));
else if (mode === "after") console.log("after shots written");
