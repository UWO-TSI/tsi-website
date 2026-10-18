// Shop interior, phase 2 evidence (specs/interiors/shop.md): the furnished room in the game's own frame, headless and
// muted, against a dev server with the Supabase env blanked. Run from web/:
//   PORT=3189 node ../specs/evidence/shop-interior/phase2/shots.mjs <out-dir> [name,name,...]
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
    st.textContent = "body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important} #shop-labels, #shop-labels *, [data-testid='interior-backdrop']{visibility:visible !important}";
    document.head.appendChild(st);
  });
}
await load(false);
const L = await page.evaluate(() => {
  const s = window.__shopLayout;
  return { fixtures: s.SHOP_FIXTURES, slots: s.SHOP_SLOTS, kinds: s.ITEM_KINDS, pendant: s.SHOP_PENDANT, spot: s.SHOP_COUNTER_SPOT, spawn: s.SHOP_SPAWN,
    F: s.SHOP_FLOOR_HEIGHT, stair: s.SHOP_STAIR, lane: s.STAIR_LANE, mezz: s.SHOP_MEZZ };
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

const T = (text, at, extra = {}) => ({ text, at, ...extra });
const SHOTS = [
  { id: "01-plan-ground", title: "Ground floor from above (the mezzanine cut away)", aerial: true, route: [[0, -1.0], L.spot],
    cam: { pos: [0, 60, 0.15], target: [0, 0, 0.15], up: [0, 0, 1], fov: 13.6 }, labels: [] },
  { id: "02-door-view", title: "From the door (walking camera): the branded dark round the room", cam: null, labels: [] },
  { id: "03-items-walk", title: "In-game items (walking camera)", route: [[3.0, -0.6]], cam: null, labels: [] },
  { id: "04-counter-walk", title: "At the counter (walking camera)", route: [[0, -1.0], L.spot], cam: null, labels: [] },
  { id: "05-changing-rooms", title: "The changing rooms behind the stair (walking camera)", route: [[-1.0, 0.6], [-1.6, 2.4], [-3.8, 2.9]], cam: null, labels: [] },
  { id: "06-counter-close", title: "Glazed tile, timber top, the linear pendant, herringbone oak", cam: { pos: [1.4, 1.75, 0.6], target: [-0.2, 1.0, 4.0], fov: 52 }, labels: [] },
  { id: "07-tools-shelving", title: "The tools table, the dyes and accessories, edge-lit", cam: { pos: [1.5, 2.2, -1.6], target: [4.6, 0.8, 1.2], fov: 52 }, labels: [] },
  { id: "08-showroom", title: "The furniture dais, wallpapers behind, floorings in front", cam: { pos: [3.0, 2.0, 1.2], target: [4.3, 0.9, 4.6], fov: 55 }, labels: [] },
  { id: "09-clothes-stair", title: "The clothes rail and the shoe table by the stair", cam: { pos: [-0.4, 2.2, -2.4], target: [-3.6, 0.8, 1.0], fov: 55 }, labels: [] },
  { id: "10-seasonal", title: "The front plinths by the window: today's specials", cam: { pos: [1.2, 1.7, -1.4], target: [3.9, 0.6, -3.3], fov: 52 }, labels: [] },
  { id: "11-item-tag", title: "Near an item: its tag, the name and a mini image", hud: true, route: [[0, -1.0], [2.5, -0.2]], cam: null, labels: [] },
  { id: "12-shopkeeper", title: "E at the counter: the shopkeeper's two answers", hud: true, route: [[0, -1.0], L.spot], press: "e", keep: true, cam: null, labels: [] },
  { id: "13-merch-ui", title: "Club merch: the item turning in the middle, with the pixel finish", hud: true, click: "Club merch", wait: 3500, cam: null, labels: [] },
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
  if (s.click) { await page.getByRole("button", { name: s.click }).first().click(); await page.waitForTimeout(s.wait ?? 2500); }
  await settle(page);
  await page.waitForTimeout(500);
  await page.evaluate(LABEL, { labels: s.labels, legend: s.legend, key: s.key, title: s.title, titleLow: s.hud, bend: aerial ? [0, 0] : [0.0032, 0.0011] });
  await page.screenshot({ path: join(outDir, `${s.id}.png`), clip: rect });
  console.log("shot", s.id);
  // Close what the shot opened (the wardrobe), and hide the page's DOM again.
  if ((s.press && !s.keep) || s.click) { await page.keyboard.press("Escape"); await page.waitForTimeout(1500); }
  if (s.hud) await page.evaluate(() => { const st = document.getElementById("shop-hide"); if (st) st.disabled = false; });
}
await browser.close();
