// Volleyball phase 1 redo, round 2 (game/volleyball): the controls checked with REAL input, headless (muted, signed out),
// against a dev server on PORT with the Supabase env blanked.
//   PORT=3471 node specs/evidence/volleyball/p2input.mjs <out_dir> [scene,scene,...]
// Every action is pressed through Playwright's keyboard and mouse (CDP input events, the same DOM events a person
// makes); the pointer lock is emulated on the same calls the game makes (element.requestPointerLock and
// document.pointerLockElement), since headless Chromium has no real lock. The dev hook (window.__volley) is used to
// read the match, to pause and step it a 60th of a second at a time, and to place the ball for one action's check;
// never to press anything.
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT = "specs/evidence/volleyball/p3", ONLY] = process.argv.slice(2), PORT = process.env.PORT ?? 3471, BASE = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", extras: [], bangs: "", back: "hair_bob_pigtail", top: "top_tee", bottom: "bottom_shorts", onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {} });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const results = { checks: {} };
const check = (name, ok, detail = "") => { results.checks[name] = { ok: !!ok, detail }; console.log(ok ? "PASS" : "FAIL", name, detail); };

async function open(url, wait) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([look]) => {
    try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); } catch {}
    // The pointer lock, emulated on the game's own calls.
    let locked = null;
    Object.defineProperty(Document.prototype, "pointerLockElement", { get() { return locked; }, configurable: true });
    Element.prototype.requestPointerLock = function () { locked = this; queueMicrotask(() => document.dispatchEvent(new Event("pointerlockchange"))); return Promise.resolve(); };
    Document.prototype.exitPointerLock = function () { locked = null; queueMicrotask(() => document.dispatchEvent(new Event("pointerlockchange"))); };
  }, [LOOK]);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
  await page.goto(BASE + url);
  await page.waitForFunction(w => !!window[w], wait, { timeout: 300000 });
  await page.addStyleTag({ content: "nav, nextjs-portal, #island-options, [aria-controls='island-options'] { display: none !important; }" }).catch(() => {});
  return { ctx, page };
}
const shot = (page, name, clip) => page.screenshot({ path: `${OUT}/${name}.png`, ...(clip ? { clip } : {}) });
const V = page => ({
  pause: () => page.evaluate(() => { window.__volley.dev.paused = true; }),
  run: () => page.evaluate(() => { window.__volley.dev.paused = false; }),
  step: async (n = 1) => { await page.evaluate(k => { window.__volley.dev.steps = k; }, n); await page.waitForFunction(() => window.__volley.dev.steps === 0); await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))); },
  frame: () => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))),
  m: f => page.evaluate(`(() => { const m = window.__volley.match(); return (${f})(m); })()`),
  probe: (k, ...a) => page.evaluate(([k, a]) => window.__volley.probe[k](...a), [k, a]),
  log: () => page.evaluate(() => window.__volley.dev.log.length),
  since: k => page.evaluate(n => window.__volley.dev.log.slice(n), k),
  locked: () => page.evaluate(() => document.pointerLockElement?.tagName === "CANVAS"),
});
/** A real mouse click on the canvas's middle (down, then up), with a button. */
const click = async (page, button = "left") => { await page.mouse.move(640, 400); await page.mouse.down({ button }); await page.mouse.up({ button }); };

/** Put the match in a rally with the ball dropping onto you from `above` u over the hands of `how` (state set by the dev hook). */
const rallyFor = (page, how, above, inAir = false) => page.evaluate(([how, above, inAir]) => {
  const m = window.__volley.match(), p = m.players[0], side = p.s.z < 0 ? -1 : 1;
  m.phase = "rally"; m.touchTeam = 1; m.touches = 1; m.lastTouch = 2; m.lastTeam = 1; m.flight++;
  const hand = window.__volley.probe.hand()[how];
  Object.assign(m.ball, { x: p.s.x, y: p.s.y + hand + above, z: p.s.z, vx: 0, vy: -0.5, vz: 0, k: 1, cx: 0, cy: 0 });
  for (const q of m.players) { q.cd = 0; q.pend = null; q.dive = null; q.down = 0; }
  void side; void inAir;
}, [how, above, inAir]);

const SCENES = {
  /** The island: E starts the match, the zoom-in, then every action from its real key in its real stance. */
  async inputs() {
    const { ctx, page } = await open(`/lab/island?fixture=v2&at=-8.9,104.6&time=day&weather=clear&season=summer&vbseed=7`, "__move");
    await page.waitForTimeout(9000);
    await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
    // The island's mouse-look takes the pointer first (a click on the canvas), as a player would have.
    await click(page);
    await page.waitForTimeout(400);
    check("island: a click takes the mouse", await V(page).locked());
    await page.keyboard.press("e");
    const started = await page.waitForFunction(() => !!window.__volley?.match(), null, { timeout: 30000 }).then(() => true, () => false);
    check("island: E at the net starts the match", started);
    if (!started) { await ctx.close(); return; }
    const v = V(page);
    // The camera's glide into the court: frames through it.
    for (const [i, ms] of [[0, 0], [1, 350], [2, 700], [3, 1100]]) { if (ms) await page.waitForTimeout(ms - [0, 0, 350, 700][i]); await shot(page, `p3-zoom-${i}`); }
    await page.waitForTimeout(1200);
    check("camera: the glide in finishes", (await v.probe("intro")) >= 1);
    await shot(page, "p3-camera");

    // The serve (seed 7: you serve).
    await v.pause();
    check("serve: you serve first (seed 7)", (await v.probe("stance")) === "serve");
    // The curve: hold the right button and move.
    await page.mouse.move(640, 400); await page.mouse.down({ button: "right" });
    await page.mouse.move(700, 370, { steps: 6 }); await v.frame();
    const spin = await page.evaluate(() => ({ ...window.__volley.controls.spin }));
    await page.mouse.up({ button: "right" });
    check("serve: right-drag sets the contact point (curve)", spin.x > 0.2 && spin.y > 0.1, JSON.stringify(spin));
    check("serve: the right button keeps the mouse (orbit never sees it)", await v.locked());
    // The power: hold left, the meter fills (strip), release tosses.
    await page.mouse.down();
    for (let i = 0; i < 6; i++) { await v.step(6); await shot(page, `p3-meter-${i}`, { x: 730, y: 540, width: 240, height: 260 }); }
    const meter = await v.m("m => m.meter");
    await page.mouse.up(); await v.step(1);
    check("serve: holding the left button fills the meter", meter > 0, `held ${meter}`);
    check("serve: releasing tosses", (await v.probe("stance")) === "toss");
    // The ring: move the mouse to aim, then click as the ring closes.
    await page.mouse.move(760, 400, { steps: 6 }); await v.frame();
    const ring = await page.evaluate(() => ({ ...window.__volley.controls.ring }));
    check("serve: in the toss the mouse moves the ring's cursor", ring.x > 0.3, JSON.stringify(ring));
    let e = await v.probe("serveErr");
    for (let i = 0; i < 400 && e < -0.12; i++) { await v.step(1); e = await v.probe("serveErr"); }
    await shot(page, "p3-ring");
    for (let i = 0; i < 400 && e < -0.01; i++) { await v.step(1); e = await v.probe("serveErr"); }
    let n = await v.log();
    await page.mouse.down(); await page.mouse.up(); await v.step(1);
    const served = (await v.since(n)).find(x => x.kind === "serve");
    check("serve: a click on time serves", served && (served.judge === "perfect" || served.judge === "good"), JSON.stringify(served));

    // Each rally action from its real control.
    const act = async (name, how, above, press, expectFn, air = false) => {
      await rallyFor(page, how, above);
      if (air) { await page.keyboard.down(" "); await v.step(2); await page.keyboard.up(" "); await v.step(18); await rallyFor(page, how, 0.05); }
      await shot(page, `p3-bar-${name}`, { x: 300, y: 600, width: 680, height: 200 });
      const k = await v.log();
      await press(); await v.step(1); await v.step(20);
      const ev = await v.since(k);
      check(`rally: ${name}`, expectFn(ev), ev.filter(x => x.who === 0 || x.kind === "contact").map(x => `${x.kind}:${x.how ?? ""}`).join(" ").slice(0, 160));
    };
    const contact = h => ev => ev.some(x => x.kind === "contact" && x.who === 0 && x.how === h);
    await act("bump (left click)", "bump", 0.05, () => click(page), contact("bump"));
    await act("set (E)", "set", 0.05, () => page.keyboard.press("e"), contact("set"));
    await act("early bump waits for the ball", "bump", 0.5, () => click(page), contact("bump"));
    await act("call (right click)", "bump", 3, () => click(page, "right"), ev => ev.some(x => x.kind === "call" && x.who === 0));
    check("rally: the right click kept the mouse", await v.locked());
    await act("dive (Q)", "bump", 3, async () => { await page.keyboard.down("w"); await page.keyboard.press("q"); await page.keyboard.up("w"); }, ev => ev.some(x => x.kind === "dive" && x.who === 0));
    await v.step(150);
    check("rally: Ctrl does nothing in a match", await (async () => { await rallyFor(page, "bump", 3); const k = await v.log(); await page.keyboard.press("Control"); await v.step(4); return !(await v.since(k)).some(x => x.who === 0 && x.kind === "dive"); })());
    // A clutch dive: a ball dropping 2.6 u to your right, out of reach on foot; Q with a push roughly that way digs it.
    {
      await page.evaluate(() => { const m = window.__volley.match(), p = m.players[0];
        m.phase = "rally"; m.touchTeam = 1; m.touches = 1; m.lastTouch = 2; m.lastTeam = 1; m.flight++;
        for (const q of m.players) { q.cd = 0; q.pend = null; q.dive = null; q.down = 0; }
        Object.assign(m.ball, { x: p.s.x + 2.4, y: p.s.y + 1.4, z: p.s.z, vx: 0, vy: -2, vz: 0, k: 1, cx: 0, cy: 0 }); });
      const k = await v.log();
      const dirKey = await page.evaluate(() => { const P = window.__volley.probe, yaw = P.yaw(), spot = window.__volley.spot, c = Math.cos(spot.yaw), sn = Math.sin(spot.yaw);
        const wx = c, wz = -sn, fx = Math.sin(yaw), fz = Math.cos(yaw), f = wx * fx + wz * fz, r = -(wx * -fz + wz * fx);
        return Math.abs(f) > Math.abs(r) ? (f > 0 ? "w" : "s") : (r > 0 ? "a" : "d"); });
      // Round 5: the dig turns your avatar white for a beat (meshes held white), with no impact frame, then gives it back.
      await page.evaluate(() => { const w = window; w.__seen = { blink: 0, impact: 0, on: true }; const el = document.querySelector("[class*=impact]");
        const tick = () => { if (!w.__seen.on) return; w.__seen.blink = Math.max(w.__seen.blink, w.__volleyFx?.probe().blink ?? 0); w.__seen.impact += el?.dataset.on !== undefined ? 1 : 0; requestAnimationFrame(tick); }; tick(); });
      await page.keyboard.down(dirKey); await page.keyboard.press("q"); await page.keyboard.up(dirKey);
      await v.step(60);
      await page.waitForTimeout(400);
      const seen = await page.evaluate(() => { window.__seen.on = false; return { ...window.__seen, after: window.__volleyFx?.probe().blink }; });
      check("rally: your dig flashes your avatar white (no impact frame) and gives its look back", seen.blink > 0 && seen.impact === 0 && seen.after === 0, JSON.stringify(seen));
      const ev = await v.since(k);
      check("rally: a clutch dive (Q) digs a ball out of reach on foot", ev.some(x => x.kind === "dive" && x.who === 0 && x.onBall) && ev.some(x => x.kind === "contact" && x.who === 0 && x.how === "dig"), ev.filter(x => x.who === 0).map(x => `${x.kind}:${x.how ?? ""}${x.onBall ? ":onBall" : ""}`).join(" "));
      await v.step(150);
    }
    // In the air, the ball arriving for real (a lob dropping toward your jump's top, not placed at the hands): jump with
    // Space, press as it comes, and the press must meet it.
    const airAct = async (name, how, key, gap) => {
      await page.evaluate(() => { const m = window.__volley.match(), p = m.players[0], side = p.s.z < 0 ? -1 : 1;
        m.phase = "rally"; m.touchTeam = 0; m.touches = 2; m.lastTouch = 1; m.lastTeam = 0; m.flight++;
        for (const q of m.players) { q.cd = 0; q.pend = null; q.dive = null; q.down = 0; }
        p.s = { ...p.s, z: side * 1.2, vx: 0, vz: 0 };
        const hand = window.__volley.probe.hand();
        Object.assign(m.ball, { x: p.s.x + 0.2, y: p.s.y + 1.75 + hand.spike + 1.6, z: p.s.z, vx: 0, vy: 0, vz: 0, k: 1, cx: 0, cy: 0 }); });
      await page.keyboard.down(" "); await v.step(1); await page.keyboard.up(" ");
      const hand = (await v.probe("hand"))[how === "spike" ? "spike" : "set"];
      for (let i = 0; i < 120; i++) { const g = await v.m(`m => m.ball.y - (m.players[0].s.y + ${hand})`); if (g <= gap) break; await v.step(1); }
      const air = await v.m("m => m.players[0].s.mode");
      await shot(page, `p3-air-${how}`, { x: 300, y: 560, width: 680, height: 240 });
      const k = await v.log();
      if (key === "click") await click(page); else await page.keyboard.press(key);
      await v.step(1); await v.step(50);
      const ev = await v.since(k);
      const hit = ev.find(x => x.kind === "contact" && x.who === 0);
      check(`air: ${name}`, air === "air" && hit?.how === how && !ev.some(x => x.kind === "whiff" && x.who === 0), `${air} ${hit ? `${hit.how}:${hit.timing}` : "no contact"} ${ev.filter(x => x.who === 0).map(x => x.kind).join(" ")}`);
      await v.step(120);
    };
    await airAct("spike pressed on the way up meets the ball (Space, left click)", "spike", "click", 0.5);
    await airAct("spike pressed early still meets it (graded early)", "spike", "click", 1.6);
    await airAct("jump set in the air meets the ball (Space, E)", "jumpset", "e", 0.4);
    // Block: at the net, jump, right click, and their spike driven through the tape's height into your arms.
    {
      await page.evaluate(() => { const m = window.__volley.match(), p = m.players[0], side = p.s.z < 0 ? -1 : 1;
        m.phase = "rally"; m.touchTeam = 1; m.touches = 3; m.lastTouch = 2; m.lastTeam = 1; m.flight++;
        for (const q of m.players) { q.cd = 0; q.pend = null; q.dive = null; q.down = 0; q.block = 0; }
        p.s = { ...p.s, z: side * 0.5, vx: 0, vz: 0 };
        Object.assign(m.ball, { x: p.s.x, y: 6, z: -side * 3, vx: 0, vy: 0, vz: 0, k: 1, cx: 0, cy: 0 }); });
      await page.keyboard.down(" "); await v.step(1); await page.keyboard.up(" "); await v.step(30);
      const k = await v.log();
      await click(page, "right"); await v.step(2);
      await page.evaluate(() => { const m = window.__volley.match(), p = m.players[0], side = p.s.z < 0 ? -1 : 1;
        Object.assign(m.ball, { x: p.s.x + 0.3, y: 2.17 + 0.35, z: -side * 0.9, vx: 0, vy: -1, vz: side * 14, k: 1 }); });
      await v.step(1); await v.step(20);
      const ev = await v.since(k);
      check("air: block (Space, right click) stops their spike at the net", ev.some(x => x.kind === "block" && x.who === 0) && ev.some(x => x.kind === "contact" && x.who === 0 && x.how === "block"), ev.filter(x => x.who === 0).map(x => `${x.kind}:${x.how ?? ""}`).join(" "));
      check("rally: the block's right click kept the mouse", await v.locked());
      await v.step(120);
    }
    // Space and Q reach the court (they were taken by the island's own keys before).
    await rallyFor(page, "bump", 3);
    await page.keyboard.press(" "); await v.step(4);
    check("rally: Space jumps", await v.m("m => m.players[0].s.mode") === "air");
    await v.step(90);
    check("rally: Q never dashes in a match", await v.m("m => m.players[0].s.dashT === 0"));
    // The island's own keys stand back: Tab (tool wheel) and G (emotes) do nothing visible; E never opens a prompt.
    await page.keyboard.press("Tab"); await page.keyboard.press("g"); await v.frame();
    const wheels = await page.evaluate(() => !!document.querySelector('[class*="wheel" i][data-open], [aria-label*="wheel" i][data-open]'));
    check("island: Tab and G don't open the wheels in a match", !wheels);
    // The bar follows the jump: sampled every frame in the page, the row shown against your stance, both ways.
    await v.step(60); await rallyFor(page, "bump", 8);
    await v.run();
    const watch = page.evaluate(() => new Promise(res => {
      const out = []; let n = 0;
      const tick = () => { const m = window.__volley.match(), st = m.players[0].s.mode === "air" ? "air" : "ground";
        out.push([st, document.querySelector("[data-active][role=group]")?.dataset.row ?? ""]); if (++n < 150) requestAnimationFrame(tick); else res(out); };
      requestAnimationFrame(tick); }));
    await page.waitForTimeout(120);
    await page.keyboard.press(" ");
    const rows = await watch;
    const lag = rows.filter(([st, row], i) => i > 0 && st !== row).length;
    const flips = rows.filter((r, i) => i && r[1] !== rows[i - 1][1]).length;
    check("bar: a jump swaps ground to air the frame you leave the sand and back the frame you land", rows.some(r => r[1] === "air") && lag <= 2 && flips === 2, `frames out of step ${lag}, flips ${flips}`);
    await shot(page, "p3-bar-air", { x: 300, y: 600, width: 680, height: 200 });
    await v.pause();
    results.inputs = { spin, ring, meter, served };
    await ctx.close();
  },

  /** Debug: the serve ring on the island. */
  async ringdbg() {
    const { ctx, page } = await open(`/lab/island?fixture=v2&at=-8.9,104.6&time=day&weather=clear&season=summer&vbseed=7`, "__move");
    await page.waitForTimeout(9000);
    await click(page); await page.waitForTimeout(300);
    await page.keyboard.press("e");
    await page.waitForFunction(() => !!window.__volley?.match(), null, { timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up(); await page.waitForTimeout(250);
    console.log(JSON.stringify(await page.evaluate(() => ({ phase: window.__volley.match().phase, ring: window.__volley.probe.ring(), ball: window.__volley.match().ball, spot: window.__volley.spot }))));
    await shot(page, "dbg-ring");
    await ctx.close();
  },

  /** A whole rally played with real keys and clicks by a little pilot (it reads the match, it presses keys). */
  async rally() {
    const { ctx, page } = await open(`/lab/island?fixture=v2&at=-8.9,104.6&time=day&weather=clear&season=summer&vbseed=2`, "__move");
    await page.waitForTimeout(9000);
    await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
    await click(page); await page.waitForTimeout(300);
    await page.keyboard.press("e");
    await page.waitForFunction(() => !!window.__volley?.match(), null, { timeout: 30000 });
    await page.waitForTimeout(2500);
    const v = V(page);
    const held = new Set();
    const hold = async keys => { for (const k of ["w", "a", "s", "d"]) { const on = keys.includes(k); if (on && !held.has(k)) { await page.keyboard.down(k); held.add(k); } if (!on && held.has(k)) { await page.keyboard.up(k); held.delete(k); } } };
    const start = await v.log();
    let shotN = 0, last = 0, mine = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 45000) {
      const s = await page.evaluate(() => {
        const m = window.__volley.match(), me = m.players[0], P = window.__volley.probe;
        if (!m) return null;
        const yaw = P.yaw(), spot = window.__volley.spot, c = Math.cos(spot.yaw), sn = Math.sin(spot.yaw);
        // The landing (court frame) to a world direction, then to the camera's forward/right.
        const L = m.landing, mySide = me.s.z < 0 ? -1 : 1, mineNow = m.phase === "rally" && L && Math.sign(L.z) === mySide && m.receiver[0] === 0;
        let dir = null;
        if (mineNow) {
          const dx = L.x - me.s.x, dz = L.z - me.s.z, wx = dx * c + dz * sn, wz = -dx * sn + dz * c, d = Math.hypot(wx, wz);
          if (d > 0.35) { const fx = Math.sin(yaw), fz = Math.cos(yaw); dir = { f: (wx * fx + wz * fz) / d, r: (wx * -fz + wz * fx) / d * -1 }; }
        }
        const n = m.touchTeam === 0 ? m.touches + 1 : 1;
        return { phase: m.phase, stance: P.stance(), mine: !!mineNow, dir, bump: P.reach("bump"), set: P.reach("set"), n, serveErr: P.serveErr(), meter: m.meter, points: m.score.points };
      });
      if (!s || s.phase === "over") break;
      const keys = [];
      if (s.dir) { if (s.dir.f > 0.35) keys.push("w"); if (s.dir.f < -0.35) keys.push("s"); if (s.dir.r > 0.35) keys.push("a"); if (s.dir.r < -0.35) keys.push("d"); }
      await hold(keys);
      if (s.stance === "serve" && s.meter === null) { await page.mouse.down(); await page.waitForTimeout(500); await page.mouse.up(); }
      else if (s.stance === "toss" && s.serveErr > -0.08) { await page.mouse.down(); await page.mouse.up(); }
      else if (s.mine && (s.bump !== null || s.set !== null)) {
        // First touch a bump, the second a set.
        if (s.n >= 2 && s.set !== null) await page.keyboard.press("e"); else await page.mouse.down().then(() => page.mouse.up());
        mine++;
      }
      if (Date.now() - last > 450 && s.phase === "rally" && shotN < 12) { last = Date.now(); await shot(page, `p3-rally-${String(shotN++).padStart(2, "0")}`); }
      if (s.points[0] + s.points[1] >= 3 && mine > 2) break;
    }
    await hold([]);
    const ev = await v.since(start);
    const myTouches = ev.filter(e => e.kind === "contact" && e.who === 0).map(e => `${e.how}:${e.quality.toFixed(2)}`);
    check("rally: the pilot played touches with real input", myTouches.length > 0, myTouches.join(" "));
    results.rally = { myTouches, points: await v.m("m => m.score.points"), events: ev.filter(e => e.kind !== "press").slice(0, 80).map(e => `${e.kind}${e.who !== undefined ? e.who : ""}${e.how ? ":" + e.how : ""}`).join(" ") };
    await ctx.close();
  },

  /** Close-ups in the lab: the ball's squash on a touch, frame by frame, cropped round the ball. */
  async lab() {
    const { ctx, page } = await open("/lab/volleyball?seed=7", "__volley");
    await page.waitForTimeout(6000);
    const v = V(page);
    await v.pause();
    await click(page);
    await page.evaluate(() => { window.__volley.dev.pitch = 0.1; });
    // The ball a little in front of you, at the bump's height and falling onto the forearms.
    await rallyFor(page, "bump", 0.05);
    await page.evaluate(() => { const m = window.__volley.match(), p = m.players[0], side = p.s.z < 0 ? -1 : 1; m.ball.z = p.s.z - side * 0.35; m.ball.x = p.s.x + side * 0.15; });
    await page.evaluate(() => { window.__volley.dev.side = [1.4, 0.15, 0]; });
    await v.step(1);
    const crop = async name => { const [x, y] = await v.probe("screen"); await shot(page, name, { x: Math.max(0, Math.min(1280 - 320, x - 160)), y: Math.max(0, Math.min(800 - 320, y - 160)), width: 320, height: 320 }); };
    await crop("p3-squish-0");
    await click(page);
    for (let i = 1; i < 7; i++) { await v.step(1); await crop(`p3-squish-${i}`); }
    await ctx.close();
  },

  /** The court on the island: the bench and the leaderboard board. */
  async court() {
    for (const [name, q] of (process.env.ONLY_BENCH ? [["p3-bench", "&at=-4.5,92.5"]] : [["p3-bench", "&at=-4.5,92.5"], ["p3-board", "&at=5.5,101.5"], ["p3-board-open", "&at=5.5,101.5&sheet=vboard"]])) {
      const { ctx, page } = await open(`/lab/island?fixture=v2&time=day&weather=clear&season=summer${q}`, "__move");
      await page.waitForTimeout(9000);
      await page.evaluate(([n]) => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } const o = window.__orbit?.orbit; if (o) { o.target.yaw = o.view.yaw = n === "p3-bench" ? 0 : -Math.PI / 2; o.idle = -1e9; } }, [name]);
      await page.waitForTimeout(2500);
      await shot(page, name);
      await ctx.close();
    }
  },
};

for (const [name, fn] of Object.entries(SCENES)) {
  if (ONLY && !ONLY.split(",").includes(name)) continue;
  try { await fn(); console.log("done", name); } catch (e) { console.log("failed", name, e.message.slice(0, 300)); }
}
writeFileSync(`${OUT}/input-results.json`, JSON.stringify(results, null, 1));
await browser.close();
