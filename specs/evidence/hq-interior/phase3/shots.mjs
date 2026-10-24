// HQ interior, phase 3 evidence (specs/interiors/hq.md, row 316): the gallery (layout B) furnished, two tall storeys,
// headless and muted, against a dev server with the Supabase env blanked. Run from web/:
//   PORT=3189 node ../specs/evidence/hq-interior/phase3/shots.mjs <out-dir> [day,night] [name,name,...]
// Per time of day: top-down plans of each floor (labelled), an overview, from the door (the walking camera), the
// aquarium straight ahead from the entrance, the bridge's lounge looking at the tank, the arms with their banners,
// under the left arm (work), the stair, the ceiling's height from the walking camera, and more. Then, by day, the
// prompts: every station's E (logged) and the new stations' lines on screen. The player walks with the room's
// click-to-walk event (up the stair by its walker); eye-level views park the player out of the picture and show the
// whole upper floor (__hqShowUpper); labels are projected from the layout module the room draws from.
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
  const TOP = 2 * F;
  const P = id => o.paths.find(p => p.id === id).points;
  const UP = [[0, -3.0], ...P("to-stair"), ...P("flight"), P("upper")[0]];
  const DOWN = [...UP].reverse();
  const top = f => {
    const xs = f.blocks.flatMap(b => [b.at[0] - b.size[0] / 2, b.at[0] + b.size[0] / 2]), zs = f.blocks.flatMap(b => [b.at[2] - b.size[2] / 2, b.at[2] + b.size[2] / 2]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, f.level * F + Math.min(2.2, Math.max(...f.blocks.map(b => b.at[1] + b.size[1]))) + 0.05, (Math.min(...zs) + Math.max(...zs)) / 2];
  };
  const fixtureLabels = level => o.fixtures.filter(f => f.level === level && f.label).map(f => ({ text: f.label, at: top(f) }));
  const zoneLabels = level => L.zones.filter(z => z.level === level).map(z => ({ text: z.text, at: [z.at[0], level * F + 0.05, z.at[1]], style: "section" }));
  const badges = level => o.stations.filter(s => s.level === level).map(s => ({ text: "E", at: [s.pos[0], level * F + 0.05, s.pos[1]], style: "badge" }));
  const aq = o.aquarium;
  const LEGEND = ["Walnut: floor planks, panelling, desks, the library, the oval ceiling", "Green marble: the coffee bar", "Brown velvet, black and brown leather: the seats",
    "Deep blue rug (work lounge), cream shag (both lounges)", `The aquarium: the back wall, ${aq.y1.toFixed(1)} tall, its own light`, `Each storey ${F} high; the ceiling at ${TOP}`,
    "Light: lamps, strips under shelves and along the tank, track spots; four real lights", "E: a station"];
  // Where the player waits during the eye-level views: by the front wall past the coffee bar, out of the pictures.
  const PARK = [[0, -3.0], [-6.5, -3.0], [-6.5, -7.3]];
  const AISLE = [[0, -3.0], [5.85, -3.0], [8.8, -3.0], [8.8, 2.6]];
  const SHOTS = [
    { id: "01-plan-ground", title: `Ground floor from above (${time})`, aerial: true, hideUpper: true, cam: { pos: [-3.6, 70, 0.05], target: [-3.6, 0, 0.05], up: [0, 0, 1], fov: 16 },
      labels: [...zoneLabels(0), ...fixtureLabels(0), { text: "Aquarium (the back wall, both storeys)", at: [0, 0.4, aq.z0 + 0.6] }, ...badges(0)], legend: LEGEND },
    { id: "02-plan-upper", title: `Upper floor from above (${time})`, aerial: true, showUpper: true, cam: { pos: [-3.6, 70 + F, 0.05], target: [-3.6, F, 0.05], up: [0, 0, 1], fov: 16 },
      labels: [...zoneLabels(1), ...fixtureLabels(1), ...badges(1)] },
    { id: "03-overview", title: `Both floors (${time})`, aerial: true, showUpper: true, cam: { pos: [19, 27, -23], target: [0, 2.5, 1.0], fov: 40 }, labels: [] },
    { id: "03b-section", title: `The two storeys from the front (the near wall cut away): ${F} each, the ceiling at ${TOP}`, aerial: true, showUpper: true,
      cam: { pos: [0, F, -60], target: [0, F, 0], fov: 12 },
      labels: [{ text: `ground storey ${F}`, at: [-7.4, F / 2, -8.4] }, { text: `upper storey ${F}`, at: [-7.4, F * 1.5, -8.4] }, { text: `ceiling ${TOP}`, at: [-7.4, TOP - 0.3, -8.4] },
        { text: "the bridge's floor", at: [7.6, F + 0.2, -8.4] }, { text: `the tank, ${aq.y1.toFixed(1)} tall`, at: [0, aq.y1 + 0.35, aq.z0] }] },
    { id: "04-door", title: "From the door (the walking camera)", route: [[0, -6.4]], cam: null, labels: [] },
    { id: "05-aquarium-entrance", title: "The aquarium straight ahead from the entrance", park: PARK, cam: { pos: [0, 1.6, -7.3], target: [0, 4.2, 6.6], fov: 66 }, labels: [] },
    { id: "06-bridge-lounge", title: "The bridge's lounge looking at the tank", park: PARK, cam: { pos: [-9.0, F + 2.3, -7.5], target: [1.5, F + 0.2, 4.0], fov: 70 }, labels: [] },
    { id: "07-arm-left", title: "The left arm and its banners, one after another toward the tank", park: PARK, cam: { pos: [2.6, 1.7, -3.3], target: [5.6, 4.0, 6.0], fov: 64 }, labels: [] },
    { id: "08-arm-right", title: "Along the right arm's rail from the bridge: the banners toward the tank", park: AISLE, cam: { pos: [-3.0, F + 1.7, -4.2], target: [-5.2, F - 0.9, 6.0], fov: 64 }, labels: [] },
    { id: "09-work", title: "Under the left arm: co-working, the library wall, the trophy case", park: PARK, cam: { pos: [5.2, 1.65, -3.2], target: [8.6, 1.2, 4.0], fov: 66 }, labels: [] },
    { id: "10-stair", title: "The stair under the right arm, the notice board at its foot", park: AISLE, cam: { pos: [-4.0, 1.6, -3.4], target: [-9.0, 2.6, 3.4], fov: 64 }, labels: [] },
    { id: "11-height-walk", title: "The ceiling's height from the walking camera, in the hall", route: [[0, -3.0], [0, 0.9], [4.6, 0.9], [4.6, 5.9], [0, 5.9], [-1.0, 5.6]], cam: null, labels: [] },
    { id: "12-height-upper", title: "The drop to the hall from the bridge, the walking camera", upstairs: true, route: [[-6.9, 7.2], [-6.9, -4.95], [-1.5, -4.95]], cam: null, labels: [] },
    { id: "13-top-of-stairs", title: "From the top of the stairs", park: AISLE, cam: { pos: [-8.9, F + 1.65, 6.9], target: [2.0, F - 0.6, -4.0], fov: 64 }, labels: [] },
    { id: "14-coffee-desk", title: "The entry under the bridge: the door, Wren at her desk, the work lounge", park: AISLE, cam: { pos: [-3.0, 2.0, -2.0], target: [3.5, 0.7, -7.2], fov: 70 }, labels: [] },
    { id: "15-founder", title: "The Founder's desk and blank plaque, the clock, the trophy case", park: PARK, cam: { pos: [4.6, 1.7, 3.2], target: [8.2, 1.3, 7.8], fov: 64 }, labels: [] },
    { id: "16-admin-doors", title: "The two admin doors (locked) at the end of the left arm", park: PARK, cam: { pos: [7.4, F + 1.7, 1.6], target: [7.8, F + 1.1, 7.9], fov: 60 }, labels: [] },
    { id: "17-walk-upper", title: "Upstairs on the left arm, the walking camera", upstairs: true, route: [[-6.9, 7.2], [-6.9, -4.95], [6.9, -4.95], [6.9, 1.4]], cam: null, labels: [] },
    { id: "18-walk-under", title: "Under the left arm, walking: the arm above cut away", route: [[0, -3.0], [5.85, -3.0], [8.8, -3.0], [8.8, 1.6]], cam: null, labels: [] },
    { id: "19-walk-stair", title: "Under the right arm by the stair, walking", route: [[0, -3.0], [-6.8, -3.0], [-6.8, 2.6]], cam: null, labels: [] },
  ].filter(s => !only || only.split(",").includes(s.id));

  // Every shot's way from the hub (0, -3) in the hall: walk the last one back, then this one.
  const SPAWN_WAY = [[0, -6.4]];
  let cur = SPAWN_WAY;
  const wayOf = s => [...(s.upstairs ? UP.slice(1) : []), ...(s.route ?? s.park ?? [])];
  L0.at = L.spawn;
  let aerial = false;
  for (const s of [...SHOTS].sort((p, q) => Number(!!q.aerial) - Number(!!p.aerial))) {
    if (!!s.aerial !== aerial) { aerial = !!s.aerial; await load(time, aerial); L0.at = L.spawn; cur = SPAWN_WAY; }
    await hideUi(true);
    await page.evaluate(() => document.getElementById("hq-labels")?.remove());
    const eye = !!s.cam && !s.aerial;
    await page.evaluate(([h, v]) => { window.__hqHideUpper = h; window.__hqShowUpper = v; }, [!!s.hideUpper, !!s.showUpper || eye]);
    if (!s.aerial) {
      const way = wayOf(s);
      if (JSON.stringify(way) !== JSON.stringify(cur)) {
        console.log("at", time, s.id, JSON.stringify(await walk([...[...cur].reverse(), [0, -3.0], ...way])));
        cur = way;
      }
    }
    await page.evaluate(AIM, s.cam);
    await settle(page);
    await page.waitForTimeout(700);
    await page.evaluate(LABEL, { labels: s.labels, legend: s.legend, title: s.title, bend: aerial ? [0, 0] : [0.0032, 0.0011] });
    await page.screenshot({ path: join(outDir, `${time}-${s.id}.png`), clip: await rect() });
    console.log("shot", time, s.id);
  }

  // The prompts (by day): every station's E, on its own floor; the new stations' lines on screen.
  if (time === "day" && (!only || only.includes("prompts"))) {
    await load(time, false);
    L0.at = L.spawn;
    await hideUi(false);
    await page.evaluate(() => { document.getElementById("hq-labels")?.remove(); window.__hqShowUpper = false; window.__hqHideUpper = false; });
    const prompt = () => page.evaluate(() => [...document.querySelectorAll("button")].find(b => b.querySelector("kbd") && /^E/.test(b.textContent ?? ""))?.textContent ?? null);
    const ground = o.stations.filter(s => s.level === 0), upper = o.stations.filter(s => s.level === 1);
    // Round the furniture, along the taped paths.
    const ARM = [[0, -3.0], [5.85, -3.0], [5.85, 5.3]];
    const ROUTES = {
      exit: [[0, -3.0], [0, -7.2]], desk: [[0, -6.5], [4.2, -6.5]], coffee: [[0, -6.6], [-4.6, -6.9]],
      board: [[0, -3.0], [-8.6, -3.0], [-8.6, -1.7]], shelf: [[0, -3.0], [5.85, -3.0], [8.8, -3.0], [8.8, -2.2]],
      display: [[0, -3.0], [5.85, -3.0], [5.85, 4.5], [8.45, 4.5]], founder: [...ARM, [7.8, 5.55]], clock: [...ARM, [6.2, 6.85]],
      aquarium: [[0, -3.0], [0, 0.9], [4.6, 0.9], [4.6, 5.9], [0, 5.9]],
    };
    const SHOT = { coffee: "20-coffee-line", aquarium: "21-aquarium-line" };
    for (const st of ground) {
      const route = ROUTES[st.id] ?? [[0, -3.0], st.pos];
      await walk(route);
      const p = await prompt();
      log.push({ station: st.id, level: 0, prompt: p });
      console.log("prompt", st.id, JSON.stringify(p));
      if (SHOT[st.id]) {
        await page.keyboard.press("e");
        await page.waitForTimeout(700);
        await page.screenshot({ path: join(outDir, `day-${SHOT[st.id]}.png`) });
        await page.waitForTimeout(2600);   // the line fades by itself
      }
      await walk([...route].reverse());
    }
    // The workbench answers on its own (crafting/Workshop.tsx), from its approach spot.
    const BENCH = [[0, -3.0], [-8.0, -3.0], [-8.0, -5.6]];
    await walk(BENCH);
    const pb = await prompt();
    log.push({ station: "workbench", level: 0, prompt: pb });
    console.log("prompt", "workbench", JSON.stringify(pb));
    await walk([...BENCH].reverse());
    await walk(UP);
    await walk([[-6.9, 7.2], [-6.9, -4.95], [6.9, -4.95], [6.9, 2.4]]);
    for (const st of upper) {
      await walk([st.pos]);
      const p = await prompt();
      log.push({ station: st.id, level: 1, prompt: p });
      console.log("prompt", st.id, JSON.stringify(p));
      if (st.id === "admin") {
        await page.keyboard.press("e");
        await page.waitForTimeout(700);
        await page.screenshot({ path: join(outDir, `day-22-admin-locked.png`) });
        await page.waitForTimeout(2600);   // the line fades by itself
      }
    }
    writeFileSync(join(outDir, "prompts.json"), JSON.stringify(log, null, 1));
  }
}
await browser.close();
