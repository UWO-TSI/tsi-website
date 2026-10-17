// Remodel evidence (game/remodel-trees): in-game shots of the village trees and flowers at fixed cameras, so the before
// and after pictures are framed the same. Headless Chromium, muted, against a dev server with the Supabase env blanked.
// From art/nature/evidence/ingame.mjs (game/remodel-nature). Run from web/:
//   PORT=3186 node ../art/trees/evidence/ingame.mjs <out-dir> <cams.json> <before|after> [season,season,...] [only,only]
// "before" is shot with the pre-remodel SEASON_TREES / SEASON_FLOWERS in place (the lane swaps lib/game/seasonalLook.ts
// back for the run), "after" with ours; the first run picks each target's camera and writes it to cams.json, and the
// next reuses it exactly. Two kinds of target:
//   - a model (`mat`): found in the live scene by its materials near a map spot, framed by an evidence camera handed to
//     the main pass (three's devtools hook, no game code changes); the player stands behind that camera, and the orbit
//     (window.__orbit, dev only) turns to the same side and pulls in, so the game camera, which picks each tree's near
//     or far model (lib/game/natureLod.ts), is about as far from it as the evidence camera;
//   - a village view (`game`): the game's own camera, the player at a spot facing a group of trees: what a player sees.
// The player's see-through cut is turned off for an evidence frame (it is drawn for the game camera). Writes
// <out-dir>/<mode>/<target>.<season>.png.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [outDir, camsFile, mode, seasonArg, onlyArg] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3186;
const seasons = (seasonArg ?? "autumn").split(",");
const only = onlyArg ? new Set(onlyArg.split(",")) : null;
const cams = existsSync(camsFile) ? JSON.parse(readFileSync(camsFile, "utf8")) : {};
mkdirSync(join(outDir, mode), { recursive: true });

const LEAVES = /^(mTreeOak(Leaf|SakuraBloom|LeafSnow|LeafSphSnow)|mTreeLeaves)$/;
const NEEDLES = /^(PltTreeCedar__PltTreeCedar4_mat0|mPltTreeCedarLeafSnow|mNeedles)$/;
const FLOWERS = /^(PltFlw\w+_mat\d|mPetals|mFlowerLeaves)$/;
const TARGETS = [
  { id: "tree-round", mat: LEAVES, near: [-6, -12], az: 20, el: 16, k: 1.0 },
  { id: "tree-wide", mat: LEAVES, near: [17, -7], az: -60, el: 16, k: 1.0 },
  { id: "tree-tall", mat: LEAVES, near: [14, -12], az: -20, el: 16, k: 1.0 },
  { id: "cedar", mat: NEEDLES, near: [6, -14], az: 0, el: 16, k: 1.0 },
  { id: "flowers", mat: FLOWERS, near: [-5, -7], az: 20, el: 34, k: 1.6, group: 1.2 },
  { id: "village-west", game: { player: [-6, -6.5], yaw: Math.PI, zoom: 1 } },
  { id: "village-east", game: { player: [12, -5.5], yaw: Math.PI, zoom: 1 } },
];

const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const INIT = ({ look }) => {
  try {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.pixelated.v1", "false");
    localStorage.setItem("tsi.welcomed.v1", "1"); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 0, pitch: 0.6, zoom: 1, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
  } catch { /* storage blocked: defaults */ }
  const ev = { renderers: [], main: null, gameCam: null, cam: null };
  window.__ev = ev;
  const hook = new EventTarget();
  hook.addEventListener("observe", e => {
    const o = e.detail;
    if (!o?.isWebGLRenderer) return;
    ev.renderers.push(o);
    const render = o.render.bind(o);
    o.render = (scene, camera) => {
      if (scene?.isScene && camera?.isPerspectiveCamera) {
        if (!ev.main || scene.children.length >= ev.main.children.length) ev.main = scene;
        if (scene === ev.main) ev.gameCam = camera;
        if (ev.cam && scene === ev.main) {
          if (!ev.cut) scene.traverse(m => { const mat = m.material; if (!ev.cut && mat && !Array.isArray(mat)) ev.cut = o.properties.get(mat)?.uniforms?.uCut ?? null; });
          if (ev.cut) ev.cut.value.w = 0;
          return render(scene, ev.cam);
        }
      }
      return render(scene, camera);
    };
  });
  window.__THREE_DEVTOOLS__ = hook;
};

/** In the page: the world boxes of every shown instance whose material matches. */
const FIND = (src) => {
  const re = new RegExp(src), S = window.__ev.main;
  if (!S) return [];
  S.updateMatrixWorld(true);
  const shown = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const out = [];
  S.traverse(o => {
    if (!o.isMesh || !shown(o)) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (!mats.some(m => re.test(m?.name ?? ""))) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    const n = o.isInstancedMesh ? o.count : 1, I = o.matrixWorld.clone(), M = o.matrixWorld.clone();
    for (let k = 0; k < n; k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, I); M.multiplyMatrices(o.matrixWorld, I); }
      const b = g.boundingBox.clone().applyMatrix4(M);
      out.push([b.min.x, b.min.y, b.min.z, b.max.x, b.max.y, b.max.z]);
    }
  });
  return out;
};

const AIM = ({ c, d, az, el, fov }) => {
  const ev = window.__ev, src = ev.gameCam;
  if (!src) return false;
  const cam = src.clone();
  const canvas = ev.renderers[0].domElement;
  cam.fov = fov; cam.aspect = canvas.clientWidth / canvas.clientHeight; cam.near = 0.05; cam.far = 400;
  const a = az * Math.PI / 180, e = el * Math.PI / 180;
  cam.position.set(c[0] + Math.sin(a) * Math.cos(e) * d, c[1] + Math.sin(e) * d, c[2] + Math.cos(a) * Math.cos(e) * d);
  cam.up.set(0, 1, 0); cam.lookAt(c[0], c[1], c[2]); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  ev.cam = cam;
  return true;
};
/** Turn the orbit (dev only): yaw in radians, zoom x the follow distance. */
const ORBIT = ({ yaw, zoom }) => {
  const o = window.__orbit?.orbit;
  if (!o) return false;
  for (const v of [o.target, o.view]) { v.yaw = yaw; v.zoom = zoom; }
  o.idle = 0;
  return true;
};

const centre = b => [(b[0] + b[3]) / 2, (b[1] + b[4]) / 2, (b[2] + b[5]) / 2];
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
for (const season of seasons) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(INIT, { look: LOOK });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log(season, "pageerror", e.message.slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/lab/island?time=day&weather=clear&season=${season}`);
  await page.waitForFunction(() => !!window.__move?.sim?.current && !!window.__ev?.main, null, { timeout: 420000 });
  await page.waitForTimeout(15000);
  await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
  await page.addStyleTag({ content: "body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important}" });
  const rect = await page.evaluate(() => { const c = window.__ev.renderers[0].domElement.getBoundingClientRect(); return { x: c.x, y: c.y, w: c.width, h: c.height }; });
  const side = Math.min(rect.w, rect.h);
  const clip = { x: rect.x + (rect.w - side) / 2, y: rect.y + (rect.h - side) / 2, width: side, height: side };
  for (const t of TARGETS) {
    if (only && !only.has(t.id)) continue;
    if (t.game) {
      await page.evaluate(([x, z]) => window.__move.teleport(x, z, 0), t.game.player);
      await page.evaluate(ORBIT, { yaw: t.game.yaw, zoom: t.game.zoom });
      await page.waitForTimeout(2500);
      await page.evaluate(() => { window.__ev.cam = null; });
      await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res)))));
      await page.screenshot({ path: join(outDir, mode, `${t.id}.${season}.png`), clip });
      console.log(season, t.id, "shot");
      continue;
    }
    let cam = cams[t.id];
    if (!cam) {
      const boxes = await page.evaluate(FIND, t.mat.source);
      if (!boxes.length) { console.log(season, t.id, "not in the scene: skipped"); continue; }
      const near = t.near;
      boxes.sort((p, q) => Math.hypot(centre(p)[0] - near[0], centre(p)[2] - near[1]) - Math.hypot(centre(q)[0] - near[0], centre(q)[2] - near[1]));
      let box = boxes[0].slice();
      if (t.group) for (const b of boxes) if (Math.hypot(centre(b)[0] - centre(box)[0], centre(b)[2] - centre(box)[2]) < t.group) box = [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.min(box[2], b[2]), Math.max(box[3], b[3]), Math.max(box[4], b[4]), Math.max(box[5], b[5])];
      const c = centre(box), r = Math.max(0.2, Math.hypot(box[3] - box[0], box[4] - box[1], box[5] - box[2]) / 2);
      const d = Math.max(r / Math.sin(20 * Math.PI / 180) * 1.12, 1.6) * t.k;
      const a = t.az * Math.PI / 180, back = d * Math.cos(t.el * Math.PI / 180) + 2;
      const player = [c[0] + Math.sin(a) * back, c[2] + Math.cos(a) * back];
      cam = { c, d, az: t.az, el: t.el, player, from: mode };
      cams[t.id] = cam;
      writeFileSync(camsFile, JSON.stringify(cams, null, 1));
    }
    await page.evaluate(([x, z]) => window.__move.teleport(x, z, 0), cam.player);
    // The game camera behind the player on the evidence camera's side, pulled in: the tree draws its near model.
    await page.evaluate(ORBIT, { yaw: cam.az * Math.PI / 180 + Math.PI, zoom: 0.6 });
    await page.waitForTimeout(2200);
    await page.evaluate(AIM, { c: cam.c, d: cam.d, az: cam.az, el: cam.el, fov: 40 });
    await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res)))));
    await page.waitForTimeout(400);
    await page.screenshot({ path: join(outDir, mode, `${t.id}.${season}.png`), clip });
    await page.evaluate(() => { window.__ev.cam = null; });
    console.log(season, t.id, "shot");
  }
  await ctx.close();
}
await browser.close();
