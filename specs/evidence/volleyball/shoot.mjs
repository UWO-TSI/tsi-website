// Volleyball phase 1 evidence (game/volleyball; specs/minigames/beach-volleyball.md): headless Chromium (WebGL), muted,
// signed out, against a dev server on PORT with the Supabase env blanked.
//   PORT=3471 node specs/evidence/volleyball/shoot.mjs <out_dir> [scene,scene,...]
// Lab scenes drive /lab/volleyball through its dev hook (window.__volley: scripted inputs, the look, pause and step a
// 60th of a second at a time, the event log). Island scenes stand you on the new world (/lab/island?fixture=v2) and time
// frames with the perf probe (window.__perf) and requestAnimationFrame.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT = "specs/evidence/volleyball/p1", ONLY] = process.argv.slice(2), PORT = process.env.PORT ?? 3471, BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", extras: [], bangs: "", back: "hair_bob_pigtail", top: "top_tee", bottom: "bottom_shorts", onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {} });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const results = {};

async function open(url, wait = "__volley") {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([look]) => { try {
    localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true");
  } catch {} }, [LOOK]);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
  await page.goto(BASE + url);
  await page.waitForFunction(w => !!window[w], wait, { timeout: 300000 });
  await page.addStyleTag({ content: "nav, nextjs-portal, #island-options, [aria-controls='island-options'] { display: none !important; }" }).catch(() => {});
  return { ctx, page };
}
const V = page => ({
  pause: () => page.evaluate(() => { window.__volley.dev.paused = true; }),
  run: () => page.evaluate(() => { window.__volley.dev.paused = false; }),
  input: inp => page.evaluate(i => { window.__volley.dev.input = i; }, inp),
  look: (yaw, pitch) => page.evaluate(([y, p]) => { window.__volley.dev.yaw = y; window.__volley.dev.pitch = p; }, [yaw, pitch]),
  step: async (n = 1) => { await page.evaluate(k => { window.__volley.dev.steps = k; }, n); await page.waitForFunction(() => window.__volley.dev.steps === 0); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); },
  /** One frame's press: set, step one, clear. */
  press: async (inp, n = 1) => { await page.evaluate(i => { window.__volley.dev.input = i; window.__volley.dev.steps = 1; }, inp); await page.waitForFunction(() => window.__volley.dev.steps === 0); await page.evaluate(() => { window.__volley.dev.input = {}; }); if (n > 1) await V(page).step(n - 1); },
  m: f => page.evaluate(`(() => { const m = window.__volley.match(); return (${f})(m); })()`),
  logLen: () => page.evaluate(() => window.__volley.dev.log.length),
  since: k => page.evaluate(n => window.__volley.dev.log.slice(n), k),
});
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` });
/** The serve's timing error now (s; negative early): match.ts HAND.serve 1.55, ball.ts GRAVITY 13. */
const ERR = `m => { const b = m.ball, p = m.players[0].s, dy = b.y - (p.y + 1.55); return dy >= 0 ? -((b.vy + Math.sqrt(b.vy * b.vy + 26 * dy)) / 13) : -dy / Math.max(0.5, -b.vy); }`;

async function serveTo(page, err, prefix) {
  const v = V(page);
  await v.pause();
  await v.press({ left: true, leftPressed: true });
  await v.input({ left: true });
  await v.step(32);
  if (prefix) await shot(page, `${prefix}-1-power`);
  await v.press({ leftReleased: true });
  await v.step(10);
  if (prefix) await shot(page, `${prefix}-2-toss`);
  let e = await v.m(ERR);
  while (e < err - 0.12) { await v.step(1); e = await v.m(ERR); }
  if (prefix) await shot(page, `${prefix}-3-ring`);
  while (e < err) { await v.step(1); e = await v.m(ERR); }
  await v.press({ leftPressed: true });
  return e;
}

const SCENES = {
  async camera() {
    const { ctx, page } = await open("/lab/volleyball?seed=7");
    await page.waitForTimeout(6000);
    await V(page).pause();
    await shot(page, "camera");
    await ctx.close();
  },
  async serve() {
    const { ctx, page } = await open("/lab/volleyball?seed=7");
    await page.waitForTimeout(6000);
    const v = V(page), k = await v.logLen();
    const e = await serveTo(page, 0, "serve");
    await v.step(6); await shot(page, "serve-4-good");
    await v.step(30); await shot(page, "serve-5-flight");
    results.serveGood = { err: +e.toFixed(3), events: (await v.since(k)).filter(x => x.kind === "serve") };
    await ctx.close();
  },
  async late() {
    const { ctx, page } = await open("/lab/volleyball?seed=7");
    await page.waitForTimeout(5000);
    const v = V(page), k = await v.logLen();
    const e = await serveTo(page, 0.11);
    for (let i = 0; i < 90 && !(await v.since(k)).some(x => x.kind === "net"); i++) await v.step(1);
    await v.step(4); await shot(page, "serve-late-net");
    await v.step(30);
    results.serveLate = { err: +e.toFixed(3), events: (await v.since(k)).filter(x => ["serve", "net", "point"].includes(x.kind)) };
    await ctx.close();
  },
  async early() {
    const { ctx, page } = await open("/lab/volleyball?seed=7");
    await page.waitForTimeout(5000);
    const v = V(page), k = await v.logLen();
    const e = await serveTo(page, -0.2);
    for (let i = 0; i < 200 && !(await v.since(k)).some(x => x.kind === "land"); i++) await v.step(1);
    await v.step(2); await shot(page, "serve-early-out");
    await v.step(20);
    results.serveEarly = { err: +e.toFixed(3), events: (await v.since(k)).filter(x => ["serve", "land", "point"].includes(x.kind)) };
    await ctx.close();
  },
  async receive() {
    const { ctx, page } = await open("/lab/volleyball?seed=2");
    await page.waitForTimeout(5000);
    const v = V(page);
    await page.waitForFunction(() => window.__volley.match().phase === "rally", null, { timeout: 30000 });
    await v.pause();
    // A ball from the far side dropping 2 u to your right and a little ahead: its landing circle, then you walk in and bump.
    await v.m("m => { const p = m.players[0].s, side = p.z < 0 ? -1 : 1; Object.assign(m.ball, { x: p.x - 1.6, y: 7, z: p.z - side * 1.2, vx: 0, vy: 0, vz: 0 }); Object.assign(m, { touchTeam: null, touches: 0, lastTouch: 2, lastTeam: 1, lastBlock: false }); m.players[0].call = 1.5; m.flight++; }");
    await v.step(1);
    const k = await v.logLen();
    await v.step(8); await shot(page, "receive-1-circle");
    const where = "m => { const p = m.players[0].s, b = m.ball; return [b.x - p.x, b.z - p.z, b.y - (p.y + 0.55)]; }";
    let two = false;
    for (let i = 0; i < 200; i++) {
      const [dx, dz, dy] = await v.m(where), d = Math.hypot(dx, dz);
      await v.input(d > 0.2 ? { x: dx / d, z: dz / d } : {});
      if (!two && dy < 1.6) { await shot(page, "receive-2-closing"); two = true; }
      if (d < 0.7 && dy < 0.08) break;
      await v.step(1);
    }
    await v.press({ leftPressed: true });
    await v.step(6); await shot(page, "receive-3-bump");
    results.receive = (await v.since(k)).filter(x => ["contact", "whiff"].includes(x.kind));
    await ctx.close();
  },
  async rally() {
    const { ctx, page } = await open("/lab/volleyball?seed=11&bots=1");
    await page.waitForTimeout(5000);
    const v = V(page);
    await v.pause();
    // Bot play from your place: shoot your team's bump, set and spike as they happen, and a block.
    const want = ["bump", "set", "spike"], got = {};
    let k = await v.logLen(), block = false;
    for (let i = 0; i < 6000 && (Object.keys(got).length < 3 || !block); i++) {
      await v.step(2);
      const ev = await v.since(k); k += ev.length;
      for (const e of ev) {
        if (e.kind === "point") for (const w of want) if (got[w] && Object.keys(got).length < 3) delete got[w];
        if (e.kind !== "contact") continue;
        const team = e.who < 2 ? 0 : 1;
        if (team === 0 && want.includes(e.how) && !got[e.how] && (e.how === "bump" || got[want[want.indexOf(e.how) - 1]])) { await v.step(3); await shot(page, `rally-${want.indexOf(e.how) + 1}-${e.how}`); got[e.how] = true; }
        if (e.how === "block" && !block) { await v.step(2); await shot(page, "block"); block = true; }
      }
    }
    results.rally = { got, block };
    await ctx.close();
  },
  async dive() {
    const { ctx, page } = await open("/lab/volleyball?seed=2");
    await page.waitForTimeout(5000);
    const v = V(page), k = await v.logLen();
    await page.waitForFunction(() => window.__volley.match().phase === "rally", null, { timeout: 30000 });
    await v.pause();
    // A low ball out to your right, too far to bump: dive for it (Ctrl), then a slide dive (Q then Ctrl) for the next.
    const drop = (dx, h) => v.m(`m => { const p = m.players[0].s, side = p.z < 0 ? -1 : 1; Object.assign(m.ball, { x: p.x - ${dx}, y: ${h}, z: p.z, vx: 0, vy: 0, vz: 0 }); Object.assign(m, { touchTeam: null, touches: 0, lastTouch: 2, lastTeam: 1, lastBlock: false }); m.players[0].down = 0; m.players[0].dive = null; m.flight++; }`);
    await v.look(-Math.PI / 2 + 0.6, 0.12);
    await drop(2.2, 1.1);
    await v.press({ x: -1, z: 0, ctrlPressed: true });
    await v.input({ x: -1, z: 0 });
    await v.step(8); await shot(page, "dive");
    await v.input({}); await v.step(40);
    await drop(4.2, 1.6);
    await v.press({ x: -1, z: 0, dashPressed: true });
    await v.input({ x: -1, z: 0 });
    await v.step(4);
    await v.press({ x: -1, z: 0, ctrlPressed: true });
    await v.step(10); await shot(page, "slide-dive");
    await v.input({});
    results.dive = (await v.since(k)).filter(x => x.kind === "dive" || (x.kind === "contact" && x.how === "dig"));
    await ctx.close();
  },
  async point() {
    const { ctx, page } = await open("/lab/volleyball?seed=7");
    await page.waitForTimeout(5000);
    const v = V(page);
    // A rally ball dropping into the far court: your point (then, from 20 to 17, the win).
    const drop = pts => v.m(`m => { m.score.points = ${JSON.stringify(pts)}; m.phase = "rally"; const side = m.players[2].s.z < 0 ? -1 : 1; Object.assign(m.ball, { x: 2.4, y: 0.5, z: side * 1.2, vx: 0, vy: -3, vz: 0 }); m.lastTeam = 0; m.lastTouch = 0; m.touchTeam = 0; m.flight++; return side; }`);
    await drop([10, 8]);
    await page.waitForTimeout(450); await shot(page, "point");
    await page.waitForTimeout(2600);
    await drop([20, 17]);
    await page.waitForTimeout(900); await shot(page, "win-1");
    await page.waitForTimeout(2200); await shot(page, "win-2");
    await ctx.close();
  },
  async island() {
    // The court on the new world: a passer-by 20 m off, the prompt at the net, the match; frame times for each.
    const measure = async (page, label) => {
      await page.evaluate(() => window.__perf?.begin());
      const raf = await page.evaluate(() => new Promise(res => { const d = []; let last = performance.now(); const t0 = last; const f = now => { d.push(now - last); last = now; if (now - t0 < 6000) requestAnimationFrame(f); else { d.sort((a, b) => a - b); res({ avg: +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(2), p95: +d[Math.floor(d.length * 0.95)].toFixed(2), frames: d.length }); } }; requestAnimationFrame(f); }));
      const perf = await page.evaluate(() => window.__perf?.end());
      results[label] = { raf, cpu: perf?.cpu, render: perf?.render, calls: perf?.calls, triangles: perf?.triangles };
      console.log(label, JSON.stringify(results[label]));
    };
    const at = (q, x, z) => `/lab/island?fixture=v2&at=${x},${z}&time=day&weather=clear&season=summer${q}`;
    for (const [label, q] of [["before-passerby", "&vbcourt=0"], ["after-passerby", ""]]) {
      const { ctx, page } = await open(at(q, 12.5, 103.8), "__move");
      await page.waitForTimeout(9000);
      await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } const o = window.__orbit?.orbit; if (o) { o.target.yaw = o.view.yaw = -Math.PI / 2; o.idle = -1e9; } });
      await page.waitForTimeout(2500);
      await shot(page, `island-${label}`);
      await measure(page, label);
      await ctx.close();
    }
    const { ctx, page } = await open(at("", -8.9, 104.6), "__move");
    await page.waitForTimeout(9000);
    await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } const o = window.__orbit?.orbit; if (o) { o.target.yaw = o.view.yaw = Math.PI; o.idle = -1e9; } });
    await page.waitForTimeout(2000);
    await shot(page, "island-prompt");
    await page.keyboard.press("e");
    await page.waitForFunction(() => !!window.__volley, null, { timeout: 30000 });
    await page.waitForTimeout(5000);
    await shot(page, "island-match");
    await measure(page, "player-in-match");
    await ctx.close();
  },
};

for (const [name, fn] of Object.entries(SCENES)) {
  if (ONLY && !ONLY.split(",").includes(name)) continue;
  try { await fn(); console.log("done", name); } catch (e) { console.log("failed", name, e.message.slice(0, 300)); }
}
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 1));
await browser.close();
