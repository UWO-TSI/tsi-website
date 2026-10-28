// Remodel round 3 redo (game/remodel): the plaza benches (bench-0 to bench-3, the new world) before and after their
// move to the plaza's edge. Headless Chromium, muted, against a dev server (Supabase env blanked,
// NEXT_PUBLIC_GAME_WORLD=new) on PORT. Run from web/:
//   PORT=3191 node ../specs/evidence/remodel/tools/benches.mjs <out-dir> before|after
// Shoot `after` first: it keeps the new spots (new.json) for `before`, shot with the old world.json put back.
// Each bench from round 3's camera (cam below; bench-0's is round 3's exact camera); the plaza from above; and,
// after, the player sat on bench-0 (pressing E beside it, the game's own benchSeat).
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [outDir, mode] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3191;
mkdirSync(outDir, { recursive: true });

const GROUND = 3, OLD = { "bench-0": [21, 46], "bench-1": [21, 54], "bench-2": [43.5, 44], "bench-3": [43.5, 56] };
const keep = join(outDir, "new.json");
if (mode === "after") {
  const world = JSON.parse(readFileSync(new URL("../../../../web/data/world/world.json", import.meta.url), "utf8"));
  writeFileSync(keep, JSON.stringify(Object.fromEntries(world.objects.filter(o => o.id in OLD).map(o => [o.id, [o.x, o.z, o.yaw ?? 0]]))));
}
const NEW = JSON.parse(readFileSync(keep, "utf8"));
/**
 * Round 3's recipe (ingame.mjs): the bench's box (r its half diagonal) seen from az 200, el 22, at 1.5 times the fit
 * distance; mirrored (az 340) for the benches on the shop's side (z over 50), so the camera stands on the plaza's side, not
 * in a lamp. On the old spot both times while the move stays in frame (bench-0, bench-1); else on each frame's own spot.
 */
function cam(id) {
  const [ox, oz] = OLD[id], [nx, nz] = NEW[id], stay = Math.hypot(nx - ox, nz - oz) < 2;
  const c = stay || mode === "before" ? [ox, GROUND + 0.275, oz] : [nx, GROUND + 0.275, nz];
  const r = Math.hypot(1.92, 0.55, 0.54) / 2, fov = 40, a = (oz > 50 ? 340 : 200) * Math.PI / 180, e = 22 * Math.PI / 180;
  const d = Math.max(r / Math.sin((fov / 2) * Math.PI / 180) * 1.25, 1.2) * 1.5;
  return { pos: [c[0] + Math.sin(a) * Math.cos(e) * d, c[1] + Math.sin(e) * d, c[2] - Math.cos(a) * Math.cos(e) * d], target: c, fov, hide: true };
}

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
const AIM = ({ pos, target, fov, hide }) => {
  const A = window.__audit, src = A.gameCam;
  if (!src) return false;
  const cam = src.clone(), canvas = A.renderers[0].domElement;
  cam.fov = fov; cam.aspect = canvas.clientWidth / canvas.clientHeight; cam.near = 0.05; cam.far = 600;
  cam.position.set(...pos); cam.up.set(0, 1, 0); cam.lookAt(...target); cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  A.cam = cam;
  A.hidden = [];
  if (hide) A.main.traverse(o => { if (o.isSkinnedMesh && o.visible) { o.visible = false; A.hidden.push(o); } });
  return true;
};
const UNAIM = () => { const A = window.__audit; A.cam = null; for (const o of A.hidden ?? []) o.visible = true; A.hidden = []; };

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
async function shoot(name, c, at = [36, 50]) {
  if (at) { await page.evaluate(([x, z]) => window.__move.teleport(x, z, 0), at); await page.waitForTimeout(4000); }
  await page.evaluate(AIM, c);
  await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res)))));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, `${name}.${mode}.png`), clip });
  await page.evaluate(UNAIM);
  console.log("shot", name, mode);
}
for (const id of Object.keys(OLD)) await shoot(id, cam(id), OLD[id].map((v, i) => v + (i ? (v > 50 ? -2.5 : 2.5) : 0)));
await shoot("top", { pos: [30, GROUND + 44, 51], target: [30, GROUND, 50], fov: 40, hide: true });
if (mode === "after") {
  // Up to bench-0 from the fountain's side, a step in front of its slot 0, and E: the game seats you (benchSeat).
  const [x, z, yaw] = NEW["bench-0"], fx = Math.sin(yaw), fz = Math.cos(yaw), sx = x + Math.cos(yaw) * -0.42, sz = z - Math.sin(yaw) * -0.42;
  await page.evaluate(([x, z, f]) => window.__move.teleport(x, z, f), [sx + fx * 0.9, sz + fz * 0.9, yaw + Math.PI]);
  await page.waitForTimeout(3000);
  await page.keyboard.press("e");
  await page.waitForTimeout(3500);
  const d = 4.2;
  await shoot("sit", { pos: [x + fx * d + Math.cos(yaw) * 1.4, GROUND + 1.6, z + fz * d - Math.sin(yaw) * 1.4], target: [x, GROUND + 0.6, z], fov: 40, hide: false }, null);
  console.log("player", JSON.stringify(await page.evaluate(() => { const s = window.__move.sim.current.state; return [s.x, s.z, s.facing]; })));
}
await browser.close();
