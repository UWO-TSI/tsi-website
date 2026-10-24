// HQ interior, phase 2 evidence (specs/interiors/hq.md, row 316): the furnished room, headless and muted, against a dev
// server with the Supabase env blanked. Run from web/:
//   PORT=3189 node ../specs/evidence/hq-interior/phase2/shots.mjs <out-dir> [day,night] [name,name,...]
// Per time of day: top-down plans of each floor (labelled), an overview, the phase 1 views furnished (from the door, the
// banners and the aquarium walking in, the aquarium from the ground lounge, the top of the stairs, the upper lounge
// looking at the tank), the aquarium close up, the work floor, the coffee bar and Wren's desk, the upper lounge, the
// admin doors, and the walking camera under the mezzanine and upstairs. Then, by day, the prompts: every station's E
// (logged), the coffee bar's line and the admin doors' line on screen. The player walks with the room's click-to-walk
// event (up the stair by its walker); labels are projected from the layout module the room draws from.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [outDir, times = "day,night", only] = process.argv.slice(2);
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

/** In the page: labels at world points (projected through the camera drawing the room), a legend and a title. */
const LABEL = ({ labels, legend, title, bend }) => {
  document.getElementById("hq-labels")?.remove();
  const A = window.__audit, cam = A.cam ?? A.gameCam, rect = A.renderers[0].domElement.getBoundingClientRect();
  const root = document.createElement("div");
  root.id = "hq-labels";
  root.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:99999;font:600 13px/1.25 -apple-system,system-ui,sans-serif";
  const v = cam.position.clone();
  for (const l of labels) {
    v.set(...l.at).applyMatrix4(cam.matrixWorldInverse);
    v.y -= v.z * v.z * bend[0] + v.x * v.x * bend[1];
    v.applyMatrix4(cam.projectionMatrix);
    if (v.z > 1) continue;
    const x = rect.left + (v.x + 1) / 2 * rect.width, y = rect.top + (1 - v.y) / 2 * rect.height;
    const el = document.createElement("div");
    const big = l.style === "section", badge = l.style === "badge";
    el.textContent = l.text;
    el.style.cssText = `position:absolute;left:${x}px;top:${y}px;transform:translate(-50%,-50%);white-space:nowrap;`
      + (badge ? "width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:13px;color:#fff;background:#14161a;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.5)"
        : big ? "font-size:19px;letter-spacing:.08em;color:#111;background:rgba(255,255,255,.88);padding:4px 10px;border-radius:6px;border:2px solid #111"
          : "color:#fff;background:rgba(20,22,26,.86);padding:3px 8px;border-radius:5px");
    root.appendChild(el);
  }
  if (title) {
    const t = document.createElement("div");
    t.textContent = title;
    t.style.cssText = `position:absolute;left:${rect.left + 16}px;top:${rect.top + 12}px;font-size:18px;color:#fff;background:rgba(20,22,26,.86);padding:6px 12px;border-radius:6px`;
    root.appendChild(t);
  }
  if (legend) {
    const box = document.createElement("div");
    box.style.cssText = `position:absolute;right:${innerWidth - rect.right + 16}px;top:${rect.top + 12}px;background:rgba(20,22,26,.9);color:#fff;padding:12px 14px;border-radius:8px;font-size:13px;line-height:1.7;max-width:320px`;
    for (const row of legend) { const r = document.createElement("div"); r.textContent = row; box.appendChild(r); }
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

const HIDE = "body *:not(canvas){visibility:hidden !important} canvas{visibility:visible !important} #hq-labels, #hq-labels *, [data-testid='interior-backdrop']{visibility:visible !important}";
async function load(time, aerial) {
  await page.goto(`http://localhost:${PORT}/lab/island?hq=inside&time=${time}&weather=clear&season=autumn${aerial ? "&aerial=1" : ""}`);
  await page.waitForFunction(() => !!window.__hqLayout && !!window.__hqWalker && !!window.__audit?.main && !!window.__audit?.gameCam, null, { timeout: 420000 });
  await page.waitForTimeout(9000);
  await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
  await page.waitForTimeout(1000);
}
const hideUi = on => page.evaluate(([on, css]) => {
  document.getElementById("hq-hide")?.remove();
  if (!on) return;
  const st = document.createElement("style");
  st.id = "hq-hide"; st.textContent = css;
  document.head.appendChild(st);
}, [on, HIDE]);
const rect = () => page.evaluate(() => { const c = window.__audit.renderers[0].domElement.getBoundingClientRect(); return { x: c.x, y: c.y, width: c.width, height: c.height }; });

const L0 = { at: null };
/** Walk a route of points with the room's click-to-walk (the walker carries you up and down the stair). */
async function walk(route) {
  await page.evaluate(AIM, null);
  for (const to of route) {
    await page.evaluate(([x, z]) => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x, z } })), to);
    await page.waitForTimeout(Math.hypot(to[0] - L0.at[0], to[1] - L0.at[1]) / 4.6 * 1000 + 900);
    L0.at = to;
  }
  await page.waitForTimeout(1200);
  return page.evaluate(() => ({ zone: window.__hqWalker.zone, height: window.__hqWalker.height, shown: window.__hqWalker.shown }));
}

const log = [];
for (const time of times.split(",")) {
  await load(time, false);
  const L = await page.evaluate(() => { const h = window.__hqLayout; return { o: h.option, zones: h.zones, F: h.HQ_FLOOR_HEIGHT, spawn: h.HQ_SPAWN }; });
  const { o, F } = L;
  const P = id => o.paths.find(p => p.id === id).points;
  const UP = [[0, -3.0], ...P("to-stair"), ...P("flight"), P("upper")[0]];
  const DOWN = [...UP].reverse();
  const top = f => {
    const xs = f.blocks.flatMap(b => [b.at[0] - b.size[0] / 2, b.at[0] + b.size[0] / 2]), zs = f.blocks.flatMap(b => [b.at[2] - b.size[2] / 2, b.at[2] + b.size[2] / 2]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, f.level * F + Math.max(...f.blocks.map(b => b.at[1] + b.size[1])) + 0.05, (Math.min(...zs) + Math.max(...zs)) / 2];
  };
  const fixtureLabels = level => o.fixtures.filter(f => f.level === level && f.label).map(f => ({ text: f.label, at: top(f) }));
  const zoneLabels = level => L.zones.filter(z => z.level === level).map(z => ({ text: z.text, at: [z.at[0], level * F + 0.05, z.at[1]], style: "section" }));
  const badges = level => o.stations.filter(s => s.level === level).map(s => ({ text: "E", at: [s.pos[0], level * F + 0.05, s.pos[1]], style: "badge" }));
  const aq = o.aquarium;
  const LEGEND = ["Walnut: floor planks, panelling, desks, the library, the oval ceiling", "Green marble: the coffee bar", "Brown velvet, black and brown leather: the seats",
    "Deep blue rug (work lounge), cream shag (both lounges)", "The aquarium: two storeys, its own light", "Light: lamps, strips under shelves and along the tank, track spots; four real lights", "E: a station"];
  const SHOTS = [
    { id: "01-plan-ground", title: `Ground floor from above (${time})`, aerial: true, hideUpper: true, cam: { pos: [-3.6, 70, 0.05], target: [-3.6, 0, 0.05], up: [0, 0, 1], fov: 16 },
      labels: [...zoneLabels(0), ...fixtureLabels(0), { text: "Aquarium (two storeys)", at: [aq.x0 + 0.7, 3.4, aq.z0 + 0.9] }, ...badges(0)], legend: LEGEND },
    { id: "02-plan-upper", title: `Upper floor from above (${time})`, aerial: true, cam: { pos: [-3.6, 70 + F, 0.05], target: [-3.6, F, 0.05], up: [0, 0, 1], fov: 16 },
      labels: [...zoneLabels(1), ...fixtureLabels(1), ...badges(1)] },
    { id: "03-overview", title: `Both floors (${time})`, aerial: true, cam: { pos: [17, 23, -21], target: [0, 1.5, 1.2], fov: 40 }, labels: [] },
    { id: "04-door", title: "From the door (the walking camera)", cam: null, labels: [] },
    { id: "05-entrance-eye", title: "Walking in, at eye height: the banners on the rail, the aquarium", cam: { pos: [-0.6, 1.55, -6.9], target: [0.6, 4.0, 1.5], fov: 62 }, labels: [] },
    { id: "06-aquarium-ground", title: "The aquarium from the ground lounge", route: [[0, -3.0], [3.6, -3.0], [3.6, 0.6], [3.9, -0.4]], cam: { pos: [3.7, 1.45, -0.7], target: [9.6, 2.9, -2.6], fov: 64 }, labels: [] },
    { id: "07-aquarium-close", title: "The aquarium close up: silver schools, the reef, the caustics, the warm base strip", cam: { pos: [6.9, 1.6, -1.2], target: [9.9, 1.7, -2.6], fov: 58 }, labels: [] },
    { id: "08-work-floor", title: "The work floor under the mezzanine: co-working, the library wall, the work lounge", route: [[0, 0.6]], cam: { pos: [3.6, 1.7, 1.0], target: [-4.0, 1.2, 7.4], fov: 66 }, labels: [] },
    { id: "09-board-founder", title: "The notice board and club goals, the Founder's desk and plaque, the trophy case", cam: { pos: [-0.4, 1.7, 3.0], target: [6.0, 1.3, 7.6], fov: 64 }, labels: [] },
    { id: "10-coffee-desk", title: "The green marble coffee bar and Wren's desk by the door", cam: { pos: [-1.2, 1.7, 0.9], target: [-5.6, 0.9, -3.8], fov: 64 }, labels: [] },
    { id: "11-top-of-stairs", title: "From the top of the stairs", upstairs: true, cam: { pos: [-8.9, F + 1.65, 1.7], target: [1.5, F + 0.6, 5.2], fov: 64 }, labels: [] },
    { id: "12-lounge-aquarium", title: "The upper lounge looking at the aquarium's top half", upstairs: true, cam: { pos: [0.6, F + 1.6, 3.8], target: [9.6, 4.4, -3.0], fov: 60 }, labels: [] },
    { id: "13-upper-lounge", title: "The upper lounge: the shag carpet, velvet sofas, the arc lamp, the walnut oval ceiling", upstairs: true, cam: { pos: [-3.6, F + 1.7, 2.3], target: [3.6, F + 0.9, 6.4], fov: 66 }, labels: [] },
    { id: "14-admin-doors", title: "The admin doors (locked)", upstairs: true, cam: { pos: [-4.6, F + 1.6, 3.4], target: [-6.2, F + 1.2, 7.9], fov: 60 }, labels: [] },
    { id: "15-walk-upper", title: "Upstairs, the walking camera", upstairs: true, route: [[-6.0, 2.1], [-3.2, 3.6], [1.0, 3.6]], cam: null, labels: [] },
    { id: "16-walk-under", title: "Under the mezzanine, the walking camera (the floor above cut away)", route: [[0, 2.4], [-2.0, 2.4], [-2.0, 6.0]], cam: null, labels: [] },
  ].filter(s => !only || only.split(",").includes(s.id));

  L0.at = L.spawn;
  let aerial = false;
  for (const s of [...SHOTS].sort((p, q) => Number(!!q.aerial) - Number(!!p.aerial))) {
    if (!!s.aerial !== aerial) { aerial = !!s.aerial; await load(time, aerial); L0.at = L.spawn; }
    await hideUi(true);
    await page.evaluate(() => document.getElementById("hq-labels")?.remove());
    await page.evaluate(h => { window.__hqHideUpper = h; }, !!s.hideUpper);
    const zone = await page.evaluate(() => window.__hqWalker.zone);
    const route = s.upstairs && zone === "ground" ? [...UP, ...(s.route ?? [])] : !s.upstairs && zone !== "ground" ? [...DOWN, ...(s.route ?? [])] : s.route;
    if (route) console.log("at", time, s.id, JSON.stringify(await walk(route)));
    await page.evaluate(AIM, s.cam);
    await settle(page);
    await page.waitForTimeout(700);
    await page.evaluate(LABEL, { labels: s.labels, legend: s.legend, title: s.title, bend: aerial ? [0, 0] : [0.0032, 0.0011] });
    await page.screenshot({ path: join(outDir, `${time}-${s.id}.png`), clip: await rect() });
    console.log("shot", time, s.id);
  }

  // The prompts (by day): every station's E, on its own floor; the coffee bar's and the admin doors' lines on screen.
  if (time === "day" && (!only || only.includes("prompts"))) {
    await load(time, false);
    L0.at = L.spawn;
    await hideUi(false);
    await page.evaluate(() => document.getElementById("hq-labels")?.remove());
    const prompt = () => page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.querySelector("kbd") && /^E/.test(b.textContent ?? ""))?.textContent ?? null);
    const ground = o.stations.filter(s => s.level === 0), upper = o.stations.filter(s => s.level === 1);
    // Round the furniture (the taped paths): the library behind the co-working desk, the aquarium past the lounge's sofa.
    const ROUTES = { shelf: [[0, -3.0], [0, 2.4], [0, 6.0], [-5.3, 6.0], [-5.3, 6.6]], aquarium: [[0, -3.0], [3.6, -3.0], [3.6, 0.6], [7.9, 0.6], [7.9, -2.1]],
      board: [[0, -3.0], [0, 6.0], [2.6, 6.75]], founder: [[0, -3.0], [0, 2.4], [6.1, 2.6], [7.2, 5.55]], display: [[0, -3.0], [0, 2.4], [6.1, 2.6], [8.45, 4.4]], clock: [[0, -3.0], [0, 6.0], [-0.2, 6.8]] };
    for (const st of ground) {
      const route = ROUTES[st.id] ?? [[0, -3.0], st.pos];
      await walk(route);
      const p = await prompt();
      log.push({ station: st.id, level: 0, prompt: p });
      console.log("prompt", st.id, JSON.stringify(p));
      if (st.id === "coffee") {
        await page.keyboard.press("e");
        await page.waitForTimeout(700);
        await page.screenshot({ path: join(outDir, `day-17-coffee-line.png`) });
      }
      if (st.id === "aquarium") {
        await page.keyboard.press("e");
        await page.waitForTimeout(700);
        await page.screenshot({ path: join(outDir, `day-18-aquarium-line.png`) });
      }
      await walk([...route].reverse());
    }
    await walk(UP);
    for (const st of upper) {
      await walk([st.pos]);
      const p = await prompt();
      log.push({ station: st.id, level: 1, prompt: p });
      console.log("prompt", st.id, JSON.stringify(p));
      if (st.id === "admin") {
        await page.keyboard.press("e");
        await page.waitForTimeout(700);
        await page.screenshot({ path: join(outDir, `day-19-admin-locked.png`) });
      }
    }
    writeFileSync(join(outDir, "prompts.json"), JSON.stringify(log, null, 1));
  }
}
await browser.close();
