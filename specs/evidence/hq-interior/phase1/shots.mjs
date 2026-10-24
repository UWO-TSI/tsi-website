// HQ interior, phase 1 evidence (specs/interiors/hq.md, row 316): each layout option as a walkable greybox, headless and
// muted, against a dev server with the Supabase env blanked. Run from web/:
//   PORT=3189 node ../specs/evidence/hq-interior/phase1/shots.mjs <out-dir> [a|b] [name,name,...]
// Per option: a top-down plan of each floor with its zones and fixtures labelled, an overview, and the views David asked
// for: from the door, the aquarium from the ground lounge, from the top of the stairs, the upper lounge looking at the
// aquarium, and the banners from the entrance. The player walks with the room's own click-to-walk event (up the stair
// by its walker); labels are projected from the layout module the room draws from (window.__hqLayout).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [outDir, which = "a,b", only] = process.argv.slice(2);
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
  document.getElementById("hq-labels")?.remove();
  const A = window.__audit, cam = A.cam ?? A.gameCam, rect = A.renderers[0].domElement.getBoundingClientRect();
  const root = document.createElement("div");
  root.id = "hq-labels";
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

async function load(opt, aerial) {
  await page.goto(`http://localhost:${PORT}/lab/island?hq=inside&hqLayout=${opt}&time=day&weather=clear&season=autumn${aerial ? "&aerial=1" : ""}`);
  await page.waitForFunction(() => !!window.__hqLayout && !!window.__audit?.main && !!window.__audit?.gameCam, null, { timeout: 420000 });
  await page.waitForTimeout(8000);
  await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
  await page.waitForTimeout(1000);
  await page.evaluate(() => {
    const st = document.createElement("style");
    st.id = "hq-hide";
    st.textContent = "body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important} #hq-labels, #hq-labels *, [data-testid='interior-backdrop']{visibility:visible !important}";
    document.head.appendChild(st);
  });
}

const rect = () => page.evaluate(() => { const c = window.__audit.renderers[0].domElement.getBoundingClientRect(); return { x: c.x, y: c.y, width: c.width, height: c.height }; });

for (const opt of which.split(",")) {
  await load(opt, false);
  const L = await page.evaluate(() => { const h = window.__hqLayout; return { o: h.option, zones: h.zones, F: h.HQ_FLOOR_HEIGHT, spawn: h.HQ_SPAWN }; });
  const { o, F } = L;
  const P = id => o.paths.find(p => p.id === id).points;
  const groundToStair = P(o.id === "a" ? "to-stair" : "to-board-stair"), flight = P("flight"), upper = P("upper");
  const UP = [[0, -3.0], ...groundToStair, ...flight, upper[0]];
  const top = f => {
    const xs = f.blocks.flatMap(b => [b.at[0] - b.size[0] / 2, b.at[0] + b.size[0] / 2]), zs = f.blocks.flatMap(b => [b.at[2] - b.size[2] / 2, b.at[2] + b.size[2] / 2]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, f.level * F + Math.max(...f.blocks.map(b => b.at[1] + b.size[1])) + 0.05, (Math.min(...zs) + Math.max(...zs)) / 2];
  };
  const fixtureLabels = level => o.fixtures.filter(f => f.level === level && f.label).map(f => ({ text: f.label, at: top(f) }));
  const zoneLabels = level => L.zones.filter(z => z.level === level).map(z => ({ text: z.text, at: [z.at[0], level * F + 0.05, z.at[1]], style: "section" }));
  const aq = o.aquarium, aqLabel = { text: "Aquarium (two storeys)", at: aq.facing === "-x" ? [aq.x0 + 0.7, 3.4, aq.z0 + 0.9] : [(aq.x0 + aq.x1) / 2, 3.4, aq.z0 + 0.7] };
  const stairLabel = { text: "Stair", at: [(o.stair.x0 + o.stair.x1) / 2, F / 2 + 0.6, (o.stair.foot + o.stair.head) / 2] };
  const stationBadges = level => o.stations.filter(s => s.level === level).map(s => ({ text: "E", at: [s.pos[0], level * F + 0.05, s.pos[1]], style: "badge" }));
  const LEGEND = [
    { head: "Ground floor: work" }, { text: "Walnut (desks, library, panelling)", colour: "#7a4f31" }, { text: "Green marble (coffee bar)", colour: "#2f6e57" },
    { text: "Velvet / leather", colour: "#7b5236" }, { text: "Deep blue rug", colour: "#264a86" }, { text: "Aquarium water", colour: "#36b8dc" },
    { head: "Upper floor: lounge" }, { text: "Cream shag carpet", colour: "#eee6d6" }, { text: "Beanbags", colour: "#b07a52" },
    { text: "Yearly banner (blank)", colour: "#f1ead9" }, { text: "Admin door (locked)", colour: "#3a2a20" },
    { head: "Light, path, prompts" }, { text: "Lamp / oval ceiling light", colour: "#fff1cf", thin: true }, { text: "Walking path", colour: "#f2c94c", thin: true },
    { text: "E: a station (desk, board, plaque…)", colour: "#14161a" },
  ];
  const name = o.name;
  const VIEWS = o.id === "a" ? {
    door: { pos: [0, 1.65, -7.55], target: [0.6, 3.3, 3.0], fov: 66 },
    aquarium: { pos: [3.7, 1.45, -0.7], target: [9.6, 2.9, -2.6], fov: 64, route: [[0, -3.0], [3.6, -3.0], [3.6, 0.6], [3.9, -0.4]] },
    stairTop: { pos: [-8.9, F + 1.65, 1.7], target: [1.5, F + 0.6, 5.2], fov: 64 },
    loungeAquarium: { pos: [0.6, F + 1.6, 3.8], target: [9.6, 4.4, -3.0], fov: 60 },
    flags: { pos: [-0.6, 1.55, -6.9], target: [0.4, 4.3, 1.5], fov: 62 },
  } : {
    door: { pos: [0, 1.65, -7.55], target: [0, 3.2, 6.0], fov: 66 },
    aquarium: { pos: [0, 1.45, 0.5], target: [0, 3.0, 8.0], fov: 66, route: [[0, -3.0], [0, 0.6]] },
    stairTop: { pos: [-8.7, F + 1.65, 7.4], target: [-2.0, F + 0.5, -5.0], fov: 64 },
    loungeAquarium: { pos: [1.5, F + 1.65, -6.3], target: [0.3, 2.8, 7.8], fov: 62, route: [[-6.9, 7.2], [-6.9, -4.95]] },
    flags: { pos: [0, 1.55, -5.0], target: [0, 4.0, 3.0], fov: 66 },
  };
  const SHOTS = [
    { id: "01-plan-ground", title: `${name}: ground floor from above`, aerial: true, hideUpper: true, cam: { pos: [-3.4, 70, 0.05], target: [-3.4, 0, 0.05], up: [0, 0, 1], fov: 16 },
      labels: [...zoneLabels(0), ...fixtureLabels(0), aqLabel, ...stationBadges(0)], legend: LEGEND },
    { id: "02-plan-upper", title: `${name}: upper floor from above`, aerial: true, route: [[0, -3.0], [0, 0.6]], cam: { pos: [-3.4, 70 + F, 0.05], target: [-3.4, F, 0.05], up: [0, 0, 1], fov: 16 },
      labels: [...zoneLabels(1), ...fixtureLabels(1), ...stationBadges(1)] },
    { id: "03-overview", title: `${name}: both floors`, aerial: true, route: [[0, -3.0], [0, 0.6]], cam: { pos: [17, 23, -21], target: [0, 1.5, 1.2], fov: 40 }, labels: [] },
    { id: "04-door", title: "From the door (walking camera)", cam: null, labels: [] },
    { id: "05-entrance-eye", title: "Walking in: the banners and the aquarium", cam: VIEWS.flags, labels: [] },
    { id: "06-aquarium-ground", title: "The aquarium from the ground lounge", route: VIEWS.aquarium.route, cam: VIEWS.aquarium, labels: [] },
    { id: "07-top-of-stairs", title: "From the top of the stairs", upstairs: true, cam: VIEWS.stairTop, labels: [] },
    { id: "08-lounge-aquarium", title: "The upper lounge looking at the aquarium", upstairs: true, route: VIEWS.loungeAquarium.route, cam: VIEWS.loungeAquarium, labels: [] },
  ].filter(s => !only || only.split(",").includes(s.id));

  let at = L.spawn, aerial = false;
  for (const s of [...SHOTS].sort((p, q) => Number(!!q.aerial) - Number(!!p.aerial))) {
    if (!!s.aerial !== aerial) { aerial = !!s.aerial; await load(opt, aerial); at = L.spawn; }
    await page.evaluate(() => document.getElementById("hq-labels")?.remove());
    await page.evaluate(h => { window.__hqHideUpper = h; }, !!s.hideUpper);
    const zone = await page.evaluate(() => window.__hqWalker.zone);
    const route = s.upstairs && zone === "ground" ? [...UP, ...(s.route ?? [])] : s.route;
    if (route) {
      await page.evaluate(AIM, null);
      for (const to of route) {
        await page.evaluate(([x, z]) => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x, z } })), to);
        await page.waitForTimeout(Math.hypot(to[0] - at[0], to[1] - at[1]) / 4.6 * 1000 + 900);
        at = to;
      }
      await page.waitForTimeout(1500);
      const w = await page.evaluate(() => ({ zone: window.__hqWalker.zone, height: window.__hqWalker.height, shown: window.__hqWalker.shown }));
      console.log("at", opt, s.id, at.join(","), w.zone, w.height.toFixed(2), JSON.stringify(w.shown));
    }
    await page.evaluate(AIM, s.cam);
    await settle(page);
    await page.waitForTimeout(500);
    await page.evaluate(LABEL, { labels: s.labels, legend: s.legend, key: null, title: s.title, titleLow: false, bend: aerial ? [0, 0] : [0.0032, 0.0011] });
    const r = await rect();
    await page.screenshot({ path: join(outDir, `${opt}-${s.id}.png`), clip: r });
    console.log("shot", opt, s.id);
  }
}
await browser.close();
