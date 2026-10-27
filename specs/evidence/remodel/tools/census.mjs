// Remodel inventory: what the new world actually draws. Headless Chromium (muted) against a dev server with the Supabase
// env blanked and NEXT_PUBLIC_GAME_WORLD=new, walking /lab/island?fixture=v2 to a few stops by day and by night. Logs
// every GLB the page fetches and counts the meshes in the main scene by primitive signature (glb-stats.mjs), so each
// model's instance count is what the scene holds, not a guess. Run from web/:
//   PORT=3191 node ../specs/evidence/remodel/tools/census.mjs <all-stats.json> <out.json>
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [statsFile, outFile] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3191;
const stats = JSON.parse(readFileSync(statsFile, "utf8"));
const bySig = {};
for (const s of stats) for (const sig of s.sig ?? []) (bySig[sig] ??= []).push(s.file);

const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const INIT = ({ look }) => {
  try {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.welcomed.v1", "1"); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
  } catch { /* storage blocked */ }
  const audit = { main: null };
  window.__audit = audit;
  const hook = new EventTarget();
  hook.addEventListener("observe", e => {
    const o = e.detail;
    if (!o?.isWebGLRenderer) return;
    const render = o.render.bind(o);
    o.render = (scene, camera) => {
      if (scene?.isScene && camera?.isPerspectiveCamera && (!audit.main || scene.children.length >= audit.main.children.length)) audit.main = scene;
      return render(scene, camera);
    };
  });
  window.__THREE_DEVTOOLS__ = hook;
};
/** In the page: instances per primitive signature, and the nearest one's distance to the player. */
const COUNT = () => {
  const S = window.__audit.main, out = {};
  if (!S) return out;
  S.updateMatrixWorld(true);
  const s = window.__move?.sim?.current?.state, I = new S.matrixWorld.constructor(), M = I.clone(), p = { x: 0, y: 0, z: 0 };
  S.traverse(o => {
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
    const g = o.geometry, mats = Array.isArray(o.material) ? o.material : [o.material];
    const sig = `${g.attributes.position.count}|${g.index ? g.index.count : 0}|${mats[0]?.name ?? ""}`;
    const n = o.isInstancedMesh ? o.count : 1;
    const e = (out[sig] ??= { n: 0, near: 1e9 });
    e.n += n;
    for (let k = 0; k < Math.min(n, 400); k++) {
      if (o.isInstancedMesh) { o.getMatrixAt(k, I); M.multiplyMatrices(o.matrixWorld, I); } else M.copy(o.matrixWorld);
      p.x = M.elements[12]; p.z = M.elements[14];
      if (s) e.near = Math.min(e.near, Math.hypot(p.x - s.x, p.z - s.z));
    }
  });
  return out;
};

const STOPS = { day: [["spawn", 68, 46], ["market", 66, 36], ["wharf", 88, 46], ["plaza", 30, 52], ["museum", 6, 68], ["beach", -8, 100], ["woods", -35, 60], ["lighthouse", 118, 100]],
  night: [["plaza", 30, 52], ["market", 66, 60], ["woods", -35, 60]] };
const fetched = new Set(), files = {};
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
for (const time of Object.keys(STOPS)) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 640 } });
  await ctx.addInitScript(INIT, { look: LOOK });
  const page = await ctx.newPage();
  page.on("response", r => { const u = new URL(r.url()); if (u.pathname.endsWith(".glb")) fetched.add(u.pathname); });
  page.on("pageerror", e => console.log(time, "pageerror", e.message.slice(0, 160)));
  await page.goto(`http://localhost:${PORT}/lab/island?fixture=v2&time=${time}&weather=clear`);
  await page.waitForFunction(() => !!window.__move?.sim?.current, null, { timeout: 420000 });
  await page.waitForTimeout(10000);
  for (const [stop, x, z] of STOPS[time]) {
    await page.evaluate(([x, z]) => window.__move.teleport(x, z, 0), [x, z]);
    await page.waitForTimeout(7000);
    const counts = await page.evaluate(COUNT);
    for (const [sig, { n, near }] of Object.entries(counts)) for (const f of bySig[sig] ?? []) {
      const e = (files[f] ??= { max: 0, stops: {}, near: 1e9 });
      e.max = Math.max(e.max, n); e.stops[`${time}:${stop}`] = n; e.near = Math.min(e.near, Math.round(near * 10) / 10);
    }
    console.log("stop", time, stop);
  }
  await ctx.close();
}
await browser.close();
writeFileSync(outFile, JSON.stringify({ fetched: [...fetched].sort(), files }, null, 1));
console.log("fetched", fetched.size, "matched", Object.keys(files).length);
