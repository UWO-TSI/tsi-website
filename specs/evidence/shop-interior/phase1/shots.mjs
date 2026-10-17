// Shop interior, phase 1 evidence (specs/interiors/shop.md): the greybox layout in the game's own frame, headless and
// muted, against a dev server with the Supabase env blanked. Run from web/:
//   PORT=3189 node ../specs/evidence/shop-interior/phase1/shots.mjs <out-dir> [name,name,...]
// Shots: a top-down plan with labels and a legend, the view from the door (the walking camera), each section and the
// counter (the walking camera with you standing there, and a lower look across it). Labels are projected from the
// layout module the room draws from (lib/game/shopLayout.ts, exposed in dev as window.__shopLayout). The main pass is
// handed a camera through three's devtools hook (the asset audit's technique), so no game code changes for the shots.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [outDir, only] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3189;
mkdirSync(outDir, { recursive: true });

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

/** In the page: hand the main pass a camera (null: the game's own). */
const AIM = cam => {
  const A = window.__audit;
  if (!cam) { A.cam = null; return true; }
  const c = A.gameCam.clone(), canvas = A.renderers[0].domElement;
  c.fov = cam.fov; c.aspect = canvas.clientWidth / canvas.clientHeight; c.near = 0.05; c.far = 400;
  c.position.set(...cam.pos); c.up.set(...(cam.up ?? [0, 1, 0])); c.lookAt(...cam.target); c.updateProjectionMatrix(); c.updateMatrixWorld(true);
  A.cam = c;
  return true;
};

/** In the page: labels at world points (projected through the camera drawing the room), and an optional legend. */
const LABEL = ({ labels, legend, title }) => {
  document.getElementById("shop-labels")?.remove();
  const A = window.__audit, cam = A.cam ?? A.gameCam, rect = A.renderers[0].domElement.getBoundingClientRect();
  const root = document.createElement("div");
  root.id = "shop-labels";
  root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:99999;font:600 13px/1.25 -apple-system,system-ui,sans-serif";
  const v = cam.position.clone();
  for (const l of labels) {
    v.set(...l.at).project(cam);
    if (v.z > 1) continue;
    const x = rect.left + (v.x + 1) / 2 * rect.width, y = rect.top + (1 - v.y) / 2 * rect.height;
    const el = document.createElement("div");
    const big = l.style === "section", floor = l.style === "floor";
    el.textContent = l.text;
    el.style.cssText = `position:absolute;left:${x + (l.dx ?? 0)}px;top:${y + (l.dy ?? 0)}px;transform:translate(-50%,-50%);white-space:nowrap;`
      + (big ? "font-size:20px;letter-spacing:.08em;color:#111;background:rgba(255,255,255,.88);padding:4px 10px;border-radius:6px;border:2px solid #111"
        : floor ? "font-size:12px;font-style:italic;font-weight:500;color:#2b2b2b;background:rgba(255,255,255,.6);padding:1px 6px;border-radius:4px"
          : "color:#fff;background:rgba(20,22,26,.86);padding:3px 8px;border-radius:5px");
    if (l.dot !== false && !big && !floor) {
      const dot = document.createElement("div");
      dot.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:50%;background:#fff;border:2px solid #14161a`;
      root.appendChild(dot);
    }
    root.appendChild(el);
  }
  if (title) {
    const t = document.createElement("div");
    t.textContent = title;
    t.style.cssText = "position:absolute;left:18px;top:14px;font-size:18px;color:#fff;background:rgba(20,22,26,.86);padding:6px 12px;border-radius:6px";
    root.appendChild(t);
  }
  if (legend) {
    const box = document.createElement("div");
    box.style.cssText = "position:absolute;right:16px;top:14px;background:rgba(20,22,26,.9);color:#fff;padding:12px 14px;border-radius:8px;font-size:13px;line-height:1.7";
    for (const row of legend) {
      const r = document.createElement("div");
      if (row.head) { r.textContent = row.head; r.style.cssText = "font-weight:700;margin-top:6px;opacity:.85"; }
      else {
        const sw = document.createElement("span");
        sw.style.cssText = `display:inline-block;width:14px;height:${row.thin ? 4 : 14}px;margin:0 8px ${row.thin ? 4 : -2}px 0;border-radius:2px;background:${row.colour};border:1px solid rgba(255,255,255,.4)`;
        r.appendChild(sw); r.appendChild(document.createTextNode(row.text));
      }
      box.appendChild(r);
    }
    root.appendChild(box);
  }
  document.body.appendChild(root);
};

const settle = page => page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(res)))));

const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await ctx.addInitScript(INIT, { look: LOOK });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|403|503|WebSocket|colyseus/i.test(m.text())) console.log("console", m.text().slice(0, 200)); });
await page.goto(`http://localhost:${PORT}/lab/island?shop=inside&time=day&weather=clear&season=autumn`);
await page.waitForFunction(() => !!window.__shopLayout && !!window.__audit?.main && !!window.__audit?.gameCam, null, { timeout: 420000 });
await page.waitForTimeout(9000);
await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
await page.waitForTimeout(1200);
await page.addStyleTag({ content: "body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important} #shop-labels, #shop-labels *{visibility:visible !important}" });
const L = await page.evaluate(() => {
  const s = window.__shopLayout;
  return { fixtures: s.SHOP_FIXTURES, slots: s.SHOP_SLOTS, kinds: s.ITEM_KINDS, pendant: s.SHOP_PENDANT, spot: s.SHOP_COUNTER_SPOT, spawn: s.SHOP_SPAWN };
});

// ── Labels from the layout ──
const top = f => {
  const xs = f.blocks.flatMap(b => [b.at[0] - b.size[0] / 2, b.at[0] + b.size[0] / 2]), zs = f.blocks.flatMap(b => [b.at[2] - b.size[2] / 2, b.at[2] + b.size[2] / 2]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...f.blocks.map(b => b.at[1] + b.size[1])), (Math.min(...zs) + Math.max(...zs)) / 2];
};
/** Where a fixture's label sits when its box centre is the wrong spot (an L, a wall). */
const ANCHOR = { pegboard: [-5.7, 2.9, -3.4], "merch-counter": [-5.5, 0.85, -2.0], "merch-shelf": [-5.7, 1.6, 1.0], "tile-wall": [1.2, 3.0, 4.9], curtains: [5.9, 2.9, -2.9], shelving: [5.6, 2.2, 0.2] };
const fixtureLabels = (ids, opts = {}) => L.fixtures.filter(f => !ids || ids.includes(f.id)).map(f => ({ text: f.label, at: ANCHOR[f.id] ?? top(f), ...(opts[f.id] ?? {}) }));
const kindAt = kind => {
  const ss = L.slots.filter(s => s.kind === kind), n = ss.length;
  return [ss.reduce((a, s) => a + s.at[0], 0) / n, Math.max(...ss.map(s => s.at[1] + s.size[1])), ss.reduce((a, s) => a + s.at[2], 0) / n];
};
const kindLabels = (kinds, opts = {}) => kinds.map(k => ({ text: L.kinds[k].label, at: kindAt(k), ...(opts[k] ?? {}) }));
const KIND_TONE = { seasonal: "#e2873a", clothes: "#2fa39e", accessories: "#86cfc8", tools: "#68a85a", dyes: "#d3639a", furniture: "#c99a4c", merch: "#2f55d4" };
const LEGEND = [
  { head: "In-game items" },
  ...["seasonal", "clothes", "accessories", "tools", "dyes", "furniture"].map(k => ({ text: L.kinds[k].label, colour: KIND_TONE[k] })),
  { head: "Club merch" },
  { text: "Every merch item", colour: KIND_TONE.merch },
  { head: "Fixtures" },
  { text: "Concrete", colour: "#b9b5ae" }, { text: "Metal", colour: "#8e959c" }, { text: "Pegboard", colour: "#c8cacb" },
  { text: "Glazed tile", colour: "#9dbcae" }, { text: "Timber top", colour: "#b38a5d" },
  { head: "Floor, light, path" },
  { text: "Herringbone oak", colour: "#caa67c" }, { text: "Polished concrete", colour: "#a7a6a2" },
  { text: "Edge light / pendant", colour: "#fff3d6", thin: true }, { text: "Walking path", colour: "#f2c94c", thin: true },
];
const SECTIONS = [
  { text: "IN-GAME ITEMS", at: [3.6, 0, -4.55], style: "section" },
  { text: "CLUB MERCH", at: [-3.6, 0, -4.55], style: "section" },
];
const pendantLabel = { text: "Linear pendant", at: [L.pendant.x1, L.pendant.y, L.pendant.z] };
const keeperLabel = { text: "Shopkeeper", at: [0.1, 1.45, 4.25] };

const SHOTS = [
  {
    id: "01-plan-top-down", title: "Shop layout, top down (12 x 10; door at the bottom)",
    cam: { pos: [0, 60, 0.15], target: [0, 0, 0.15], up: [0, 0, 1], fov: 13.6 },
    labels: [
      ...SECTIONS.map(s => ({ ...s, at: [s.at[0], 0, -5.85] })),
      { text: "Door", at: [0, 0, -5.15], dy: 0 },
      { text: "You (spawn)", at: [L.spawn[0], 1.4, L.spawn[1]], dx: 62 },
      ...fixtureLabels(null, {
        counter: { dy: 22 }, "tile-wall": { at: [0, 3.5, 4.96], dy: -14 }, crates: { dx: 34, dy: -22 }, plant: { dx: -30, dy: -22 },
        pegboard: { at: [-6.0, 3.2, -3.0], dx: 4 }, "merch-counter": { at: [-5.66, 0.85, -1.0] }, "merch-shelf": { at: [-5.82, 1.6, 1.2] },
        "merch-sign": { at: [-4.05, 3.3, 4.93], dy: -10 }, "merch-plinths": { dy: 34 },
        curtains: { at: [6.0, 3.1, -2.9] }, "seasonal-plinths": { dy: 30 }, rail: { dy: -22 }, "tools-table": { dy: 26 },
        shelving: { at: [5.75, 2.4, 1.15], dx: -10 }, dais: { at: [4.25, 0.2, 3.5], dy: 8 },
      }),
      { ...pendantLabel, dx: 40, dy: -2 }, { ...keeperLabel, dx: -60 },
      { text: "Herringbone oak", at: [1.0, 0, -4.2], style: "floor" }, { text: "Polished concrete", at: [-2.4, 0, -4.2], style: "floor" },
      { text: "Walking path", at: [0, 0, -0.6], style: "floor", dx: 46 },
    ],
    legend: LEGEND,
  },
  {
    id: "02-door-view", title: "From the door (the walking camera)", cam: null,
    labels: [
      ...SECTIONS.map(s => ({ ...s, at: [s.at[0], 2.6, 0] })),
      ...kindLabels(["seasonal", "clothes", "tools", "dyes", "furniture", "merch-wear", "merch-small", "merch-bags", "merch-prints", "merch-featured"]),
      { text: "Cashier counter", at: [0, 0.9, 2.95] }, pendantLabel, keeperLabel,
    ],
  },
  {
    id: "03-items-walk", title: "In-game items (walking camera, standing in the section)", walk: [3.0, -1.9], cam: null,
    labels: [...kindLabels(["seasonal", "clothes", "tools", "dyes", "accessories", "furniture"], { accessories: { dy: -16 }, dyes: { dy: 16 } }),
      { text: "Edge lights", at: [3.5, 0.6, 0.9], dy: 22 }],
  },
  {
    id: "04-items-across", title: "In-game items, across from the aisle", cam: { pos: [-0.9, 3.4, -3.9], target: [3.9, 0.7, 1.2], fov: 52 },
    labels: [...fixtureLabels(["seasonal-plinths", "rail", "tools-table", "shelving", "dais", "curtains"], { "seasonal-plinths": { dy: 30 }, rail: { dy: -26 }, "tools-table": { dy: 30 }, dais: { at: [3.4, 0.2, 3.5], dy: 18 } }),
      ...kindLabels(["seasonal", "clothes", "tools", "dyes", "accessories", "furniture"], { seasonal: { dy: -22 }, clothes: { dy: 10 }, tools: { dy: -18 }, dyes: { dx: -40 }, accessories: { dx: -40 }, furniture: { dy: -18 } })],
  },
  {
    id: "05-merch-walk", title: "Club merch (walking camera, standing in the section)", walk: [-3.0, -1.9], cam: null,
    labels: [...kindLabels(["merch-wear", "merch-small", "merch-bags", "merch-prints", "merch-featured"]), { text: "Edge light under the counter lip", at: [-5.34, 0.8, -0.8], dx: 80 }],
  },
  {
    id: "06-merch-across", title: "Club merch, across from the aisle", cam: { pos: [0.9, 3.4, -3.9], target: [-4.1, 0.9, 1.2], fov: 52 },
    labels: [...fixtureLabels(["pegboard", "merch-counter", "merch-shelf", "merch-plinths", "merch-sign"], { pegboard: { at: [-5.95, 2.9, -2.4] }, "merch-plinths": { dy: 30 }, "merch-sign": { dy: -14 } }),
      ...kindLabels(["merch-wear", "merch-small", "merch-bags", "merch-prints", "merch-featured"], { "merch-featured": { dy: -16 }, "merch-small": { dy: -14 } })],
  },
  {
    id: "07-counter-walk", title: "At the counter (walking camera)", walk: "spot", cam: null,
    labels: [{ text: "Cashier counter: glazed tile, timber top", at: [0, 0.4, 2.93] }, pendantLabel, keeperLabel, { text: "Glazed tile wall", at: [-1.4, 2.6, 4.92] },
      { text: "Crate stack", at: [2.05, 1.05, 3.9] }, { text: "Plant", at: [-2.05, 1.35, 3.9] }],
  },
  {
    id: "08-counter-low", title: "The counter, lower", cam: { pos: [0.6, 1.9, 0.0], target: [0, 1.3, 4.0], fov: 55 },
    labels: [{ text: "Tiled counter", at: [0.9, 0.45, 2.93] }, { text: "Timber top", at: [-1.2, 0.88, 2.9] }, { text: "Till", at: [-0.55, 1.12, 3.4] },
      { ...pendantLabel, dy: -14 }, keeperLabel, { text: "Glazed tile wall", at: [1.5, 2.6, 4.92] }],
  },
].filter(s => !only || only.split(",").includes(s.id));

const rect = await page.evaluate(() => { const c = window.__audit.renderers[0].domElement.getBoundingClientRect(); return { x: c.x, y: c.y, width: c.width, height: c.height }; });
let at = L.spawn;
for (const s of SHOTS) {
  await page.evaluate(() => document.getElementById("shop-labels")?.remove());
  const to = s.walk === "spot" ? L.spot : s.walk ?? L.spawn;
  if (to[0] !== at[0] || to[1] !== at[1]) {
    await page.evaluate(AIM, null);
    await page.evaluate(([x, z]) => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x, z } })), to);
    await page.waitForTimeout(Math.hypot(to[0] - at[0], to[1] - at[1]) / 4.6 * 1000 + 2500);
    at = to;
  }
  await page.evaluate(AIM, s.cam);
  await settle(page);
  await page.waitForTimeout(500);
  await page.evaluate(LABEL, { labels: s.labels, legend: s.legend, title: s.title });
  await page.screenshot({ path: join(outDir, `${s.id}.png`), clip: rect });
  console.log("shot", s.id);
}
await browser.close();
