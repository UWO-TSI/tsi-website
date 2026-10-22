// HQ interior, phase 4 evidence (specs/interiors/hq.md, row 316; David's phase 3 review, 2026-10-22): the gallery grown
// to 24 x 18, the big lounge before the tank, the study upstairs, the big windows, the one admin door under the stair,
// more lamps, materials that meet the light. Headless and muted, against a dev server with the Supabase env blanked.
// Run from web/:
//   PORT=3189 node ../specs/evidence/hq-interior/phase4/shots.mjs <out-dir> [day,night] [name,name,...]
// Per time of day: top-down plans of each floor (labelled), from the door (the walking camera), the lounge before the
// tank, the bridge, the study, the windows, the admin door, the corners, material close-ups. Then, by day, the prompts:
// every station's E (logged) and the admin door's line on screen. The player walks with the room's
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
  const HUB = [0, -3.4];
  const UP = [HUB, ...P("to-stair"), ...P("flight"), P("upper")[0]];
  const DOWN = [...UP].reverse();
  const top = f => {
    const xs = f.blocks.flatMap(b => [b.at[0] - b.size[0] / 2, b.at[0] + b.size[0] / 2]), zs = f.blocks.flatMap(b => [b.at[2] - b.size[2] / 2, b.at[2] + b.size[2] / 2]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, f.level * F + Math.min(2.2, Math.max(...f.blocks.map(b => b.at[1] + b.size[1]))) + 0.05, (Math.min(...zs) + Math.max(...zs)) / 2];
  };
  const fixtureLabels = level => o.fixtures.filter(f => f.level === level && f.label).map(f => ({ text: f.label, at: top(f) }));
  const zoneLabels = level => L.zones.filter(z => z.level === level).map(z => ({ text: z.text, at: [z.at[0], level * F + 0.05, z.at[1]], style: "section" }));
  const badges = level => o.stations.filter(s => s.level === level).map(s => ({ text: "E", at: [s.pos[0], level * F + 0.05, s.pos[1]], style: "badge" }));
  const aq = o.aquarium;
  const W2 = 2 * L.o.upper[0].x1, D2 = 2 * L.o.upper[1].z1;
  const LEGEND = [`The room ${W2} x ${D2} (was 20 x 16), each storey ${F}, the ceiling at ${TOP}`, "Walnut: satin, its grain catching the light; the floor's seams",
    "Brown velvet with a sheen; leather with a soft highlight", "Green marble polished; chrome and brass metal; clear glass", "Big windows: thin black frames, no curtains",
    `Lamps: ${o.lamps.length} (floor, table, desk, sconces), strips, track spots; six real lights`, "E: a station"];
  // Where the player waits during the eye-level views: by the front wall past the coffee bar, or in the library aisle.
  const PARK = [HUB, [-7.4, -3.4], [-7.4, -7.3]];
  const AISLE = [HUB, [7.0, -3.4], [10.7, -3.4], [10.7, 2.6]];
  const SHOTS = [
    { id: "01-plan-ground", title: `Ground floor from above (${time})`, aerial: true, hideUpper: true, cam: { pos: [-4.4, 80, 0.05], target: [-4.4, 0, 0.05], up: [0, 0, 1], fov: 17 },
      labels: [...zoneLabels(0), ...fixtureLabels(0), { text: "Aquarium (the back wall, both storeys)", at: [0, 0.4, aq.z0 + 0.6] }, ...badges(0)], legend: LEGEND },
    { id: "02-plan-upper", title: `Upper floor from above (${time})`, aerial: true, showUpper: true, cam: { pos: [-4.4, 80 + F, 0.05], target: [-4.4, F, 0.05], up: [0, 0, 1], fov: 17 },
      labels: [...zoneLabels(1), ...fixtureLabels(1), ...badges(1)] },
    { id: "03-overview", title: `Both floors (${time})`, aerial: true, showUpper: true, cam: { pos: [23, 31, -27], target: [0, 2.5, 1.0], fov: 40 }, labels: [] },
    { id: "04-door", title: "From the door (the walking camera)", route: [[0, -7.4]], cam: null, labels: [] },
    { id: "05-lounge", title: "The big lounge before the tank: the sectional, beanbags, the big rug", park: PARK, cam: { pos: [5.7, 2.9, -0.6], target: [-0.6, 0.4, 4.4], fov: 62 }, labels: [] },
    { id: "06-lounge-close", title: "On the sectional's corner: velvet, the pillows, the beanbags by the glass", park: PARK, cam: { pos: [-1.6, 1.5, 6.9], target: [1.2, 0.5, 2.6], fov: 62 }, labels: [] },
    { id: "07-study", title: "Upstairs, the study on the left arm: the long table, monitors, chairs, shelves, the whiteboard", park: AISLE, cam: { pos: [7.1, F + 2.0, -3.4], target: [10.0, F + 0.6, 6.4], fov: 64 }, labels: [] },
    { id: "08-study-close", title: "At the study's table", park: AISLE, cam: { pos: [7.6, F + 1.45, 0.4], target: [10.2, F + 0.8, 3.6], fov: 62 }, labels: [] },
    { id: "09-bridge", title: "The bridge's lounge looking at the tank, under the walnut oval ceiling", park: PARK, cam: { pos: [-10.8, F + 2.3, -8.3], target: [1.5, F + 0.2, 4.5], fov: 70 }, labels: [] },
    { id: "10-windows-upper", title: "Big modern windows: the right wall over the stair, from the bridge", park: AISLE, cam: { pos: [-3.6, F + 1.7, -6.6], target: [-12.0, F + 2.3, 1.2], fov: 66 }, labels: [] },
    { id: "11-windows-ground", title: "Big modern windows: the front wall and the work lounge's pane", park: PARK, cam: { pos: [1.5, 1.9, -1.8], target: [9.0, 1.9, -8.6], fov: 66 }, labels: [] },
    { id: "12-admin-door", title: "The one admin door, under the stair (locked)", park: AISLE, cam: { pos: [-6.4, 1.65, 2.4], target: [-10.2, 1.5, 5.6], fov: 60 }, labels: [] },
    { id: "13-corner-nook", title: "Corner: the window nook and the workbench, front right", park: AISLE, cam: { pos: [-5.6, 2.0, -2.6], target: [-11.4, 0.8, -7.6], fov: 62 }, labels: [] },
    { id: "14-corner-founder", title: "Corner: the Founder's desk, the clock, the trophy case, back left", park: PARK, cam: { pos: [5.9, 1.8, 3.4], target: [10.6, 1.2, 8.6], fov: 62 }, labels: [] },
    { id: "15-corner-bridge", title: "Corner: the bridge's right end", park: AISLE, cam: { pos: [-3.0, F + 1.8, -4.6], target: [-11.4, F + 0.8, -8.4], fov: 62 }, labels: [] },
    { id: "16-corner-landing", title: "Corner: the right arm, the landing and the canvas", park: AISLE, cam: { pos: [-7.2, F + 1.8, -2.4], target: [-9.6, F + 1.0, 8.6], fov: 62 }, labels: [] },
    { id: "17-mat-velvet", title: "Close: velvet's sheen and the shag", park: PARK, cam: { pos: [-2.2, 0.95, 0.6], target: [-3.4, 0.45, 2.9], fov: 50 }, labels: [] },
    { id: "18-mat-leather", title: "Close: leather (the work lounge)", park: PARK, cam: { pos: [7.4, 1.05, -4.6], target: [10.4, 0.5, -6.8], fov: 50 }, labels: [] },
    { id: "19-mat-marble", title: "Close: polished green marble, the chrome espresso machine", park: AISLE, cam: { pos: [-2.9, 1.55, -8.0], target: [-4.6, 1.0, -6.1], fov: 50 }, labels: [] },
    { id: "20-mat-walnut", title: "Close: satin walnut, the floor's planks, the library", park: PARK, cam: { pos: [8.3, 1.3, -3.4], target: [11.4, 0.6, -0.4], fov: 52 }, labels: [] },
    { id: "21-mat-metal-glass", title: "Close: the chrome arc lamp, clear glass rail", park: AISLE, cam: { pos: [-4.6, F + 1.5, -5.3], target: [-1.2, F + 1.4, -7.2], fov: 56 }, labels: [] },
    { id: "22-walk-hall", title: "The walking camera in the hall, at the lounge", route: [HUB, [0, 0.5], [5.8, 0.5], [5.8, 6.95], [1.0, 6.95]], cam: null, labels: [] },
    { id: "23-walk-study", title: "The walking camera upstairs, at the study", upstairs: true, route: [[-7.4, 7.75], [-7.4, -5.8], [7.25, -5.8], [7.25, 2.6]], cam: null, labels: [] },
  ].filter(s => !only || only.split(",").includes(s.id));

  // Every shot's way from the hub (0, -3) in the hall: walk the last one back, then this one.
  const SPAWN_WAY = [[0, -7.4]];
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
        console.log("at", time, s.id, JSON.stringify(await walk([...[...cur].reverse(), HUB, ...way])));
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
    const ARM = [HUB, [7.0, -3.4], [7.0, 6.4]];
    const ROUTES = {
      exit: [HUB, [0, -8.2]], desk: [[0, -7.5], [4.6, -7.5]], coffee: [[0, -7.6], [-4.8, -7.6], [-4.8, -7.9]],
      board: [HUB, [-10.6, -3.4], [-10.6, -1.6]], shelf: [HUB, [7.0, -3.4], [10.7, -3.4], [10.7, -3.0]],
      display: [HUB, [7.0, -3.4], [10.7, -3.4], [10.7, 2.8], [10.4, 4.6]], founder: [...ARM, [9.4, 6.5]], clock: [...ARM, [7.4, 7.6]],
      aquarium: [HUB, [0, 0.5], [5.8, 0.5], [5.8, 6.95], [0, 6.95]], admin: [HUB, [-7.4, -3.4], [-7.4, 5.4], [-9.35, 5.4]],
    };
    const SHOT = { coffee: "24-coffee-line", aquarium: "25-aquarium-line", admin: "26-admin-locked" };
    for (const st of ground) {
      const route = ROUTES[st.id] ?? [HUB, st.pos];
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
    const BENCH = [HUB, [-8.6, -3.4], [-8.6, -7.6], [-10.0, -7.9]];
    await walk(BENCH);
    const pb = await prompt();
    log.push({ station: "workbench", level: 0, prompt: pb });
    console.log("prompt", "workbench", JSON.stringify(pb));
    await walk([...BENCH].reverse());
    // Upstairs: nothing answers there now (the admin door moved under the stair); walk the gallery to the study.
    await walk(UP);
    const at = await walk(P("upper").slice(1));
    log.push({ station: "upstairs walk", level: 1, prompt: await prompt(), at });
    for (const st of upper) {
      await walk([st.pos]);
      const p = await prompt();
      log.push({ station: st.id, level: 1, prompt: p });
      console.log("prompt", st.id, JSON.stringify(p));
    }
    writeFileSync(join(outDir, "prompts.json"), JSON.stringify(log, null, 1));
  }
}
await browser.close();
