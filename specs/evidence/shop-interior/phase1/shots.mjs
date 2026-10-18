// Shop interior, phase 1 evidence (specs/interiors/shop.md): the two-floor greybox in the game's own frame, headless and
// muted, against a dev server with the Supabase env blanked. Run from web/:
//   PORT=3189 node ../specs/evidence/shop-interior/phase1/shots.mjs <out-dir> [name,name,...]
// (PNGs; the committed shots are those converted with `cwebp -q 88`.)
// Shots: a top-down plan of each floor with a numbered key and a legend, the view from the door (the walking camera),
// the in-game items, the counter, the stair, climbing it, the top of the stairs and the merch floor. The player walks
// there with the room's own click-to-walk event (up the stair by its walker). Labels are projected from the layout
// module the room draws from (lib/game/shopLayout.ts, exposed in dev as window.__shopLayout), bent like the curved
// world; the plans load with ?aerial=1 (no bend). The main pass is handed a camera through three's devtools hook (the
// asset audit's technique), so no game code changes for the shots.
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
const LABEL = ({ labels, legend, key, title, titleLow, bend }) => {
  document.getElementById("shop-labels")?.remove();
  const A = window.__audit, cam = A.cam ?? A.gameCam, rect = A.renderers[0].domElement.getBoundingClientRect();
  const root = document.createElement("div");
  root.id = "shop-labels";
  root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:99999;font:600 13px/1.25 -apple-system,system-ui,sans-serif";
  const v = cam.position.clone();
  for (const l of labels) {
    // The curved world sinks everything by its view-space distance (lib/game/worldProjection.ts bendViewPoint): so do the labels.
    v.set(...l.at).applyMatrix4(cam.matrixWorldInverse);
    v.y -= v.z * v.z * bend[0] + v.x * v.x * bend[1];
    v.applyMatrix4(cam.projectionMatrix);
    if (v.z > 1) continue;
    const x = rect.left + (v.x + 1) / 2 * rect.width, y = rect.top + (1 - v.y) / 2 * rect.height;
    const el = document.createElement("div");
    const big = l.style === "section", floor = l.style === "floor", badge = l.style === "badge";
    el.textContent = l.text;
    el.style.cssText = `position:absolute;left:${x + (l.dx ?? 0)}px;top:${y + (l.dy ?? 0)}px;transform:translate(-50%,-50%);white-space:nowrap;`
      + (badge ? "width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:13px;color:#fff;background:#14161a;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.5)"
        : big ? "font-size:20px;letter-spacing:.08em;color:#111;background:rgba(255,255,255,.88);padding:4px 10px;border-radius:6px;border:2px solid #111"
        : floor ? "font-size:12px;font-style:italic;font-weight:500;color:#2b2b2b;background:rgba(255,255,255,.6);padding:1px 6px;border-radius:4px"
          : "color:#fff;background:rgba(20,22,26,.86);padding:3px 8px;border-radius:5px");
    if (l.dot !== false && !big && !floor && !badge) {
      const dot = document.createElement("div");
      dot.style.cssText = `position:absolute;left:${x}px;top:${y}px;width:7px;height:7px;margin:-3.5px 0 0 -3.5px;border-radius:50%;background:#fff;border:2px solid #14161a`;
      root.appendChild(dot);
    }
    root.appendChild(el);
  }
  if (title) {
    const t = document.createElement("div");
    t.textContent = title;
    t.style.cssText = `position:absolute;left:${rect.left + 16}px;top:${titleLow ? rect.bottom - 56 : rect.top + 12}px;font-size:18px;color:#fff;background:rgba(20,22,26,.86);padding:6px 12px;border-radius:6px`;
    root.appendChild(t);
  }
  if (legend) {
    const box = document.createElement("div");
    box.style.cssText = `position:absolute;right:${innerWidth - rect.right + 16}px;top:${rect.top + 12}px;background:rgba(20,22,26,.9);color:#fff;padding:12px 14px;border-radius:8px;font-size:13px;line-height:1.7`;
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
  if (key) {
    const box = document.createElement("div");
    box.style.cssText = `position:absolute;left:${rect.left + 16}px;top:${rect.top + 64}px;background:rgba(20,22,26,.9);color:#fff;padding:12px 14px;border-radius:8px;font-size:13px;line-height:1.75;white-space:nowrap`;
    for (const [n, text] of key) {
      const r = document.createElement("div");
      r.innerHTML = `<b style="display:inline-block;width:22px;text-align:right;margin-right:8px">${n}</b>`;
      r.appendChild(document.createTextNode(text));
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
/** Into the shop (aerial: the curved world's bend off, for the plan), settled, with the page's DOM hidden but the labels. */
async function load(aerial) {
  await page.goto(`http://localhost:${PORT}/lab/island?shop=inside&time=day&weather=clear&season=autumn${aerial ? "&aerial=1" : ""}`);
  await page.waitForFunction(() => !!window.__shopLayout && !!window.__audit?.main && !!window.__audit?.gameCam, null, { timeout: 420000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    const st = document.createElement("style");
    st.id = "shop-hide";
    st.textContent = "body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important} #shop-labels, #shop-labels *{visibility:visible !important}";
    document.head.appendChild(st);
  });
}
await load(false);
const L = await page.evaluate(() => {
  const s = window.__shopLayout;
  return { fixtures: s.SHOP_FIXTURES, slots: s.SHOP_SLOTS, kinds: s.ITEM_KINDS, pendant: s.SHOP_PENDANT, spot: s.SHOP_COUNTER_SPOT, spawn: s.SHOP_SPAWN,
    F: s.SHOP_FLOOR_HEIGHT, stair: s.SHOP_STAIR, lane: s.STAIR_LANE, booth: s.SHOP_BOOTH, mezz: s.SHOP_MEZZ };
});
const F = L.F, LANE = (L.lane[0] + L.lane[1]) / 2, HEAD = [LANE, L.stair.z1 + 0.6];
/** Routes: from the counter or the door to the stair's foot by the aisle, then up it; off it at the landing. */
const TO_FOOT = [[-1.0, 1.0], [-1.0, -3.6], [LANE, -3.6]], UP = [...TO_FOOT, HEAD];

// ── Labels from the layout (world points; upstairs is F higher) ──
const top = f => {
  const xs = f.blocks.flatMap(b => [b.at[0] - b.size[0] / 2, b.at[0] + b.size[0] / 2]), zs = f.blocks.flatMap(b => [b.at[2] - b.size[2] / 2, b.at[2] + b.size[2] / 2]);
  return [(Math.min(...xs) + Math.max(...xs)) / 2, f.level * F + Math.max(...f.blocks.map(b => b.at[1] + b.size[1])), (Math.min(...zs) + Math.max(...zs)) / 2];
};
/** Where a fixture's label sits when its box centre is the wrong spot (an L, a wall, the flight). */
const ANCHOR = { pegboard: [5.97, F + 2.8, -0.6], "merch-counter": [5.66, F + 0.85, -0.3], "stairwell-rail": [-4.18, F + 1.0, -1.5], "tile-wall": [1.2, 2.9, 4.9],
  curtains: [5.9, 2.8, -2.9], shelving: [5.6, 2.2, 0.2], stair: [-5.1, 2.0, -0.4], finishes: [-4.1, 0.1, 4.0] };
const fixtureLabels = (ids, opts = {}) => L.fixtures.filter(f => ids.includes(f.id)).map(f => ({ text: f.label, at: ANCHOR[f.id] ?? top(f), ...(opts[f.id] ?? {}) }));
const kindAt = kind => {
  const ss = L.slots.filter(s => s.kind === kind), n = ss.length;
  return [ss.reduce((a, s) => a + s.at[0], 0) / n, ss[0].level * F + Math.max(...ss.map(s => s.at[1] + s.size[1])), ss.reduce((a, s) => a + s.at[2], 0) / n];
};
const kindLabels = (kinds, opts = {}) => kinds.map(k => ({ text: L.kinds[k].label, at: kindAt(k), ...(opts[k] ?? {}) }));
const KIND_TONE = { seasonal: "#e2873a", clothes: "#2fa39e", accessories: "#86cfc8", tools: "#68a85a", dyes: "#d3639a", furniture: "#c99a4c", finishes: "#9b7fd0", merch: "#2f55d4" };
const LEGEND = [
  { head: "In-game items (ground floor)" },
  ...["seasonal", "clothes", "accessories", "tools", "dyes", "furniture", "finishes"].map(k => ({ text: L.kinds[k].label, colour: KIND_TONE[k] })),
  { head: "Club merch (upper floor)" },
  { text: "Every merch item", colour: KIND_TONE.merch },
  { head: "Fixtures" },
  { text: "Concrete", colour: "#b9b5ae" }, { text: "Metal", colour: "#8e959c" }, { text: "Pegboard", colour: "#bcc0c3" },
  { text: "Glazed tile", colour: "#9dbcae" }, { text: "Timber top", colour: "#b38a5d" }, { text: "Glass railing", colour: "#cddfe5" },
  { head: "Floor, light, path" },
  { text: "Herringbone oak (ground)", colour: "#caa67c" }, { text: "Polished concrete (upper)", colour: "#a7a6a2" },
  { text: "Edge light / pendant", colour: "#fff3d6", thin: true }, { text: "Walking path", colour: "#f2c94c", thin: true },
];
const pendantLabel = { text: "Linear pendant", at: [L.pendant.x1, L.pendant.y, L.pendant.z] };
const keeperLabel = { text: "Shopkeeper", at: [0.1, 1.45, 4.25] };
const stairLabel = { text: "Stair up to the club merch", at: [-5.1, 2.0, -0.4] };

/** The plans' numbered keys: number, what, and where its badge sits. */
const KEY_GROUND = [
  [1, "Counter: glazed tile, timber top", [0.9, 0.8, 3.0]],
  [2, "Glazed tile wall", [-1.0, 3.0, 4.96]],
  [3, "Crates (close the counter's end)", [2.05, 1.05, 3.9]],
  [4, "Plant (closes the other end)", [-2.05, 1.35, 3.9]],
  [5, "Shopkeeper, behind the counter", [0.75, 1.4, 4.4]],
  [6, "Linear pendant", [-1.3, 2.6, 3.3]],
  [7, "Stair up to the mezzanine", [-5.1, 1.8, -1.2]],
  [8, "\"Club merch upstairs\" sign", [-3.6, 1.3, -2.5]],
  [9, "Windows (both storeys), curtains", [5.95, 2.9, -2.9]],
  [10, "Seasonal: stepped plinths", [3.85, 0.8, -3.35]],
  [11, "Tools: concrete table", [3.5, 0.72, 0.6]],
  [12, "Dyes, accessories: shelving", [5.75, 2.4, 1.15]],
  [13, "Furniture: showroom dais", [3.0, 0.2, 3.6]],
  [14, "Clothes: metal rail, face-out", [-2.6, 1.6, -0.2]],
  [15, "Changing room, beside the clothes", [-3.0, 2.3, 1.6]],
  [16, "Wallpaper, flooring samples", [-4.1, 0.1, 4.0]],
  [17, "Edge light (e.g. shelf lips)", [5.49, 1.0, -0.3]],
  [18, "Walking path", [0, 0, -2.4]],
];
const KEY_UPPER = [
  [1, "Railing round the stairwell", [-4.18, F + 1.0, 0.4]],
  [2, "Top of the stair: you arrive here", [LANE, F, 2.4]],
  [3, "Glass railing: overlooks the entrance", [3.2, F + 1.0, -1.0]],
  [4, "Pegboard wall, round the back corner", [5.97, F + 3.0, -0.6]],
  [5, "Long metal counter with drawers", [5.66, F + 0.85, 0.6]],
  [6, "Metal shelf on the pegboard", [-0.7, F + 1.6, 4.75]],
  [7, "Club merch sign", [1.7, F + 2.95, 4.93]],
  [8, "Featured drop, at the front", [0, F + 0.75, 0.35]],
  [9, "Edge light (counter lip, shelf)", [-2.0, F + 0.8, 4.34]],
  [10, "Walking path (merch loop)", [-0.5, F, -0.4]],
  [11, "Tees and hoodies (hung, folded)", [3.5, F + 2.1, 4.88]],
  [12, "Totes", [-2.2, F + 2.05, 4.9]],
  [13, "Stickers, pins, caps (on the counter)", [0.6, F + 1.03, 4.45]],
  [14, "Posters", [0.4, F + 2.57, 4.91]],
  [15, "Below: entrance, seasonal display", [3.0, 0, -3.2]],
  [16, "Sign on the edge, facing the door", [-1.6, F, -1.0]],
];
const plan = (level, key, extra) => ({
  cam: { pos: [0, 60 + level * F, 0.15], target: [0, level * F, 0.15], up: [0, 0, 1], fov: 13.6 },
  labels: [...(level === 0 ? [{ text: "Door", at: [0, 0, -5.15] }] : []), ...key.map(([n, , at]) => ({ text: String(n), at, style: "badge" })), ...extra],
  key: key.map(([n, text]) => [n, text]), legend: LEGEND,
});
const booth = L.booth.spot;
const mezzTitle = { text: "MEZZANINE: CLUB MERCH", at: [1.6, F + 1.15, L.mezz.z0], style: "section" };

const SHOTS = [
  { id: "01-plan-ground", title: "Ground floor, top down (12 x 10; door at the bottom; the mezzanine cut away)", aerial: true, route: [[0, -1.0], L.spot],
    ...plan(0, KEY_GROUND, [{ text: "Herringbone oak", at: [1.4, 0, -4.2], style: "floor" }, { text: "The mezzanine's edge is overhead here", at: [2.6, 0, L.mezz.z0], style: "floor" }]) },
  { id: "02-plan-mezzanine", title: "Mezzanine, top down (the back 12 x 6, over the counter): club merch", aerial: true, upstairs: true,
    ...plan(1, KEY_UPPER, [{ text: "Polished concrete", at: [1.4, F, 3.0], style: "floor" }]) },
  { id: "03-door-view", title: "From the door (the walking camera): the merch level above, the stair on the right", cam: null,
    labels: [{ text: "GROUND FLOOR: IN-GAME ITEMS", at: [2.6, 0, -4.45], style: "section" }, mezzTitle,
      ...kindLabels(["seasonal", "tools", "dyes", "merch-featured"], { "merch-featured": { dy: 70, dx: -90 } }), { text: "\"Club merch\" sign on the edge", at: [0.9, F - 0.4, L.mezz.z0], dy: 22 },
      stairLabel, { text: "\"Club merch upstairs\" sign", at: [-3.6, 1.3, -2.5] }] },
  { id: "04-items-walk", title: "In-game items (walking camera, under the mezzanine: it's cut away)", route: [[3.0, -0.6]], cam: null,
    labels: [...kindLabels(["seasonal", "tools", "dyes", "accessories", "furniture", "clothes", "finishes"], { accessories: { dy: -16 }, dyes: { dy: 16 } })] },
  { id: "05-counter-walk", title: "At the counter (walking camera, the mezzanine cut away overhead)", route: [[0, -1.0], L.spot], cam: null,
    labels: [{ text: "Cashier counter: glazed tile, timber top", at: [0, 0.4, 2.93] }, pendantLabel, keeperLabel, { text: "Glazed tile wall", at: [-1.4, 2.6, 4.92] },
      { text: "Crate stack", at: [2.05, 1.05, 3.9] }, { text: "Plant", at: [-2.05, 1.35, 3.9] }, stairLabel] },
  { id: "06-changing-room", title: "The changing room, beside the clothes (walking camera)", route: [[-1.0, 0.55], booth], cam: null,
    labels: [{ text: "Changing room: curtain", at: [L.booth.at[0], 2.1, L.booth.at[1] - 0.55] }, { text: "Mirror, bench inside", at: [L.booth.at[0], 1.9, L.booth.at[1] + 0.5], dy: -18 },
      { text: "Clothes rail", at: [-2.6, 1.6, -0.2], dx: 60 }, stairLabel] },
  { id: "07-changing-room-open", title: "E there: the curtain sweeps and the wardrobe opens (the village fitting room's behaviour)", hud: true, press: "e", cam: null, labels: [] },
  { id: "08-stair-view", title: "The stair, from the aisle", cam: { pos: [0.8, 3.4, -4.6], target: [-4.4, 1.2, 0.2], fov: 55 },
    labels: [...fixtureLabels(["stair", "upstairs-sign", "rail"], { stair: { dy: -20 } }), { text: "Changing room", at: [L.booth.at[0], 2.2, L.booth.at[1]] }, { text: "Handrail", at: [-4.24, 2.4, 0.6] }, mezzTitle] },
  { id: "09-on-the-stair", title: "Climbing (walking camera)", upstairs: false, route: [...TO_FOOT, [LANE, L.stair.z0 + 3.4]], cam: null,
    labels: [{ text: "You, on the stair", at: [LANE, 2.27 + 1.5, L.stair.z0 + 3.4], dx: 80 }, { text: "Mezzanine", at: [1.5, F, 1.0], style: "section" }, ...kindLabels(["merch-wear", "merch-featured"])] },
  { id: "10-top-of-stairs", title: "From the top of the stairs (walking camera)", upstairs: true, route: [HEAD], cam: null,
    labels: [mezzTitle, ...kindLabels(["merch-wear", "merch-bags", "merch-small", "merch-prints", "merch-featured"]),
      { text: "Railing round the stairwell", at: [-4.18, F + 1.0, 1.0], dx: -110 }] },
  { id: "11-merch-walk", title: "Club merch (walking camera, standing at the merch wall)", upstairs: true, route: [[1.5, 3.4]], cam: null,
    labels: [...kindLabels(["merch-wear", "merch-bags", "merch-small", "merch-prints", "merch-featured"]), { text: "Edge light under the counter lip", at: [-2.4, F + 0.8, 4.34], dy: 18 }] },
  { id: "12-merch-across", title: "Club merch, across the mezzanine", upstairs: true, cam: { pos: [-3.6, F + 3.0, -0.8], target: [2.6, F + 1.0, 4.2], fov: 58 },
    labels: [...fixtureLabels(["pegboard", "merch-counter", "merch-shelf", "merch-plinths", "merch-sign"], { "merch-plinths": { dy: 30 }, "merch-sign": { dy: -14 } }),
      ...kindLabels(["merch-wear", "merch-bags", "merch-small", "merch-prints"], { "merch-small": { dy: 16 } })] },
  { id: "13-mezzanine-edge", title: "From the mezzanine, over the glass to the entrance below", upstairs: true, route: [[4.4, -0.55]], cam: { pos: [1.6, F + 3.4, -0.4], target: [1.6, 0.0, -3.6], fov: 64 },
    labels: [{ text: "Glass railing", at: [3.4, F + 1.0, L.mezz.z0] }, { text: "The door", at: [0, 0.6, -5.0] }, { text: "Seasonal display", at: [3.85, 1.3, -3.35] },
      { text: "Stair", at: [-5.1, 1.6, -1.6] }, ...kindLabels(["merch-featured"], { "merch-featured": { dy: -18 } })] },
].filter(s => !only || only.split(",").includes(s.id));

const rect = await page.evaluate(() => { const c = window.__audit.renderers[0].domElement.getBoundingClientRect(); return { x: c.x, y: c.y, width: c.width, height: c.height }; });
let at = L.spawn, aerial = false;
for (const s of [...SHOTS].sort((p, q) => Number(!!p.aerial) - Number(!!q.aerial))) {
  if (!!s.aerial !== aerial) { aerial = !!s.aerial; await load(aerial); at = L.spawn; }
  await page.evaluate(() => document.getElementById("shop-labels")?.remove());
  // An upstairs shot from downstairs (run on its own, or after a reload): up the stair first.
  const zone = await page.evaluate(() => window.__shopWalker.zone);
  const route = s.upstairs && zone === "ground" ? [...UP, ...(s.route ?? [])] : s.route;
  if (route) {
    await page.evaluate(AIM, null);
    for (const to of route) {
      await page.evaluate(([x, z]) => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x, z } })), to);
      await page.waitForTimeout(Math.hypot(to[0] - at[0], to[1] - at[1]) / 4.6 * 1000 + 900);
      at = to;
    }
    await page.waitForTimeout(1600);
    const w = await page.evaluate(() => ({ zone: window.__shopWalker.zone, height: window.__shopWalker.height }));
    console.log("at", s.id, at.join(","), w.zone, w.height.toFixed(2));
  }
  await page.evaluate(AIM, s.cam);
  await page.evaluate(hud => { const st = document.getElementById("shop-hide"); if (st) st.disabled = !!hud; }, s.hud);
  if (s.press) {
    await page.evaluate(() => window.__audit.renderers[0].domElement.focus());
    await page.keyboard.press(s.press);
    await page.waitForTimeout(4500);
  }
  await settle(page);
  await page.waitForTimeout(500);
  await page.evaluate(LABEL, { labels: s.labels, legend: s.legend, key: s.key, title: s.title, titleLow: s.hud, bend: aerial ? [0, 0] : [0.0032, 0.0011] });
  await page.screenshot({ path: join(outDir, `${s.id}.png`), clip: rect });
  console.log("shot", s.id);
  // Close what the shot opened (the wardrobe), and hide the page's DOM again.
  if (s.press) { await page.keyboard.press("Escape"); await page.waitForTimeout(1500); }
  if (s.hud) await page.evaluate(() => { const st = document.getElementById("shop-hide"); if (st) st.disabled = false; });
}
await browser.close();
