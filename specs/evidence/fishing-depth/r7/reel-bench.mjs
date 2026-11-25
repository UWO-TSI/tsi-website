// fishing-depth round 7: the reel-in measured (David: "the current reel in is laggy and not smooth"). Headless Chromium
// (never a window), muted, signed out against a server on :3147 with the Supabase env blanked, the new world's wharf
// (/lab/island); the server's cast and landing are routed here (entry-perf/fish-check.mjs) so each cast is a Black Bass.
// Real (trusted) mouse presses play the reel from Node: hold while the fish is ahead of the window's middle.
// Per frame while the reel is up: the frame's interval, where the catch window and the fish are drawn (read from the
// styles the reel writes, at the frame they land in), every press and release, Event Timing and long tasks.
//   node reel-bench.mjs <out.json> [catches=3]   Env: WHY=1 (log which of the world's hooks and props change while reeling),
//   PROFILE=<file.cpuprofile> (a CPU profile of the first catch).
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
const { chromium } = createRequire("/opt/homebrew/lib/node_modules/")("playwright");

const [OUT, N = "3"] = process.argv.slice(2);
const HOST = "http://localhost:3147", FISH = "fish_black_bass";
const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"];
const browser = await chromium.launch({ channel: "chromium", headless: true, args });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  const rb = window.__rb = { on: false, frames: [], win: [], fish: [], inputs: [], events: [], longs: [] };
  const loop = t => { if (rb.on) rb.frames.push(t); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  for (const type of ["pointerdown", "pointerup"]) window.addEventListener(type, e => { if (rb.on) { rb.inputs.push({ t: e.timeStamp, down: type === "pointerdown" }); window.__why?.push(`${Math.round(performance.now())} input ${type}`); } }, { capture: true });
  new PerformanceObserver(l => { if (rb.on) for (const e of l.getEntries()) rb.events.push({ name: e.name, t: e.startTime, delay: e.processingStart - e.startTime, dur: e.duration }); }).observe({ type: "event", durationThreshold: 16, buffered: false });
  new PerformanceObserver(l => { if (rb.on) for (const e of l.getEntries()) rb.longs.push({ t: e.startTime, dur: e.duration }); }).observe({ type: "longtask" });
  // The window's and the fish's drawn place, stamped with the frame they were written in (document.timeline in a rAF).
  const num = s => Number(/translateX?\(([-\d.e]+)%/.exec(s)?.[1] ?? NaN);
  const mo = new MutationObserver(list => {
    if (!rb.on) return;
    const t = document.timeline.currentTime;
    for (const m of list) {
      const el = m.target;
      if (el === rb.w) rb.win.push([t, num(el.style.transform) / 100 * parseFloat(el.style.width) / 100]);
      else if (el === rb.m) rb.fish.push([t, num(el.style.transform) / 100]);
    }
  });
  rb.watch = () => {
    const track = document.querySelector('[aria-label="Fishing reel"] [data-in]');
    if (!track || track.children[0] === rb.w) return !!track;
    rb.w = track.children[0]; rb.m = track.children[1];
    mo.observe(rb.w, { attributes: true, attributeFilter: ["style"] });
    mo.observe(rb.m, { attributes: true, attributeFilter: ["style"] });
    return true;
  };
});
// WHY=1: on each React DOM commit while reeling, which of DefaultIslandWorldContent's hooks changed (index and value).
if (process.env.WHY === "1") await ctx.addInitScript(() => {
  const why = window.__why = [];
  const prev = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  const hook = prev ?? { renderers: new Map(), supportsFiber: true, inject: () => 1, onCommitFiberUnmount() {}, onPostCommitFiberRoot() {}, checkDCE() {} };
  const show = v => typeof v === "object" && v !== null ? (Array.isArray(v) ? `[${v.length}]` : `{${Object.keys(v).slice(0, 4).join(",")}}`) : String(v).slice(0, 40);
  hook.onCommitFiberRoot = (id, root) => {
    if (!window.__rb?.on) return;
    const dom = root.containerInfo instanceof Node, name = dom ? "DefaultIslandWorldContent" : "IslandScene";
    const find = top => { const st = [top]; while (st.length) { const f = st.pop(); if (f.type?.name === name) return f; if (f.sibling) st.push(f.sibling); if (f.child) st.push(f.child); } return null; };
    const f = dom ? (window.__whyDom ??= find(root.current)) : (window.__whyScene ??= find(root.current));
    if (!f || !f.alternate) return;
    const pa = f.memoizedProps, pb = f.alternate.memoizedProps;
    if (pa !== pb) { const keys = Object.keys(pa).filter(k => pa[k] !== pb[k]); if (keys.length) why.push(`${Math.round(performance.now())} ${name} props ${keys.join(",")}`); }
    let a = f.memoizedState, b = f.alternate.memoizedState, i = 0; const ch = [];
    while (a && b) { if (a.memoizedState !== b.memoizedState && !(a.queue === null && typeof a.memoizedState === "object")) ch.push(`${i}:${a.memoizedState?.gl && b.memoizedState ? "store " + Object.keys(a.memoizedState).filter(k => a.memoizedState[k] !== b.memoizedState[k]).join("/") : show(b.memoizedState) + ">" + show(a.memoizedState)}`); a = a.next; b = b.next; i++; }
    if (ch.length) why.push(`${Math.round(performance.now())} ${name} hooks ${ch.join(" ")}`);
  };
  if (!prev) window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = hook;
});
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", e => errors.push(e.message.slice(0, 200)));
await page.route("**/api/collections", route => {
  const req = route.request();
  if (req.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ collections: [] }) });
  const body = JSON.parse(req.postData() ?? "{}");
  if (body.action === "cast") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, catch: { item_key: FISH, size_cm: 40, roll: `bench-${Date.now()}` } }) });
  if (body.action === "land") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, catch: { item_key: FISH, size_cm: 40, total_collected: 1, new_record: false } }) });
  return route.fulfill({ status: 401, body: "{}" });
});
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.evaluate(([look]) => {
  localStorage.clear();
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  for (const [k, v] of Object.entries({ "tsi.look.v1": look, "tsi.pixelated.v1": "false", "tsi.welcomed.v1": "1", "tsi.gift.later": day,
    "tsi.held.v1": JSON.stringify({ held: "rod:rod_flimsy", last: null, pins: [], chosen: {} }) })) localStorage.setItem(k, v);
}, [JSON.stringify(LOOK)]);
await page.goto(`${HOST}/lab/island?time=day`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForSelector("canvas", { timeout: 300000 });
await page.waitForFunction(() => !!window.__move?.sim?.current && !/Tethos Island/.test([...document.querySelectorAll("[role=status]")].map(e => e.textContent).join("")), null, { timeout: 300000 });
await sleep(6000);
await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });

// Stand on the spawn (the wharf) and turn until the rod has water ahead (fish-check.mjs).
const spawn = await page.evaluate(() => { const s = window.__move.sim.current.state; return [s.x, s.z]; });
let at = spawn;
const stand = yaw => page.evaluate(([[x, z], y]) => { window.__move.teleport(x, z, 0); window.__orbit.orbit.target.yaw = y; window.__orbit.orbit.view.yaw = y; window.__move.sim.current.state.yaw = y; }, [at, yaw]);
const phase = () => page.evaluate(() => document.querySelector("[data-member-fishing]")?.getAttribute("data-member-fishing") ?? "idle");
const PROMPT = [640, 707];
let yaw = null;
// The spawn, then the sea off the deck and the old sea sign's shore (round 5).
for (const where of [spawn, [78.2, 41.1], [71.74, 24.5], [-38.0, 46.0]]) {
  at = where;
  for (const y of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4]) {
    await stand(y); await sleep(900);
    await page.mouse.move(...PROMPT); await page.mouse.down(); await sleep(400);
    const p = await phase();
    await page.mouse.up(); await sleep(400);
    if (p !== "idle") { yaw = y; break; }
  }
  if (yaw !== null) break;
}
console.log("stand", at, "yaw", yaw);
if (yaw === null) { await page.screenshot({ path: OUT.replace(/\.json$/, "-no-water.png") }); console.log("no water"); process.exit(1); }
await page.waitForFunction(() => !document.querySelector("[data-member-fishing]"), null, { timeout: 60000 }).catch(() => {});

const cdp = await ctx.newCDPSession(page);
const catches = [];
for (let c = 0; c < Number(N); c++) {
  await stand(yaw); await sleep(1500);
  await page.mouse.move(...PROMPT); await page.mouse.down(); await sleep(900); await page.mouse.up();
  if (!await page.waitForSelector('[data-member-fishing="bite"]', { timeout: 40000 }).then(() => true, () => false)) { console.log("no bite"); continue; }
  await sleep(150);
  await page.mouse.move(640, 300); await page.mouse.down(); await sleep(60); await page.mouse.up();
  if (!await page.waitForFunction(() => window.__rb.watch(), null, { timeout: 8000, polling: 16 }).then(() => true, () => false)) { console.log("no reel"); continue; }
  if (c === 0 && process.env.PROFILE) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start"); }
  await page.evaluate(() => { const rb = window.__rb; rb.frames = []; rb.win = []; rb.fish = []; rb.inputs = []; rb.events = []; rb.longs = []; rb.on = true; });
  // The bot: hold while the fish is ahead of the window's middle; a real press each time it changes its mind.
  let held = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 40000) {
    const s = await page.evaluate(() => {
      const rb = window.__rb;
      if (!rb.w?.isConnected || !document.querySelector('[aria-label="Fishing reel"]')) return null;
      const w = rb.w.getBoundingClientRect(), f = rb.m.firstElementChild.getBoundingClientRect();
      return f.left + f.width / 2 > w.left + w.width / 2;
    });
    if (s === null) break;
    if (s !== held) { held = s; if (s) await page.mouse.down(); else await page.mouse.up(); }
    await sleep(30);
  }
  if (held) await page.mouse.up();
  const rec = await page.evaluate(() => { const rb = window.__rb; rb.on = false; return { frames: rb.frames, win: rb.win, fish: rb.fish, inputs: rb.inputs, events: rb.events, longs: rb.longs }; });
  if (c === 0 && process.env.PROFILE) { const { profile } = await cdp.send("Profiler.stop"); writeFileSync(process.env.PROFILE, JSON.stringify(profile)); }
  if (process.env.WHY === "1") console.log((await page.evaluate(() => window.__why.splice(0))).join("\n"));
  catches.push(rec);
  console.log("catch", c, "frames", rec.frames.length, "inputs", rec.inputs.length);
  await page.waitForSelector('[data-catch-card]', { timeout: 20000 }).catch(() => {});
  await sleep(2500);
  for (let i = 0; i < 3 && await page.locator('[data-catch-card]').count(); i++) { await page.locator('[data-catch-card] button').last().click({ timeout: 3000 }).catch(() => {}); await sleep(900); }
  await page.waitForFunction(() => !document.querySelector("[data-member-fishing]"), null, { timeout: 15000 }).catch(() => {});
  await sleep(1000);
}
await browser.close();

// ── The numbers ──
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const r1 = x => Math.round(x * 10) / 10;
const all = { intervals: [], stalls: 0, doubles: 0, moving: 0, jitter: [], latency: [], evDur: [], evDelay: [], longs: 0, longMs: 0, seconds: 0 };
for (const rec of catches) {
  const f = rec.frames;
  for (let i = 1; i < f.length; i++) all.intervals.push(f[i] - f[i - 1]);
  all.seconds += (f.at(-1) - f[0]) / 1000;
  // The window's drawn place in each frame (the last write that frame), carried over frames with no write.
  const byFrame = new Map(); for (const [t, x] of rec.win) byFrame.set(t, x);
  const xs = f.map(t => byFrame.get(t));
  for (let i = 1; i < xs.length; i++) if (xs[i] === undefined) xs[i] = xs[i - 1];
  // Per frame: how far the window moved, against the frame's share of its speed around it (frames i-2..i+2).
  const v = []; for (let i = 1; i < xs.length; i++) v[i] = (xs[i] - xs[i - 1]) / ((f[i] - f[i - 1]) / 1000);
  for (let i = 3; i < xs.length - 2; i++) {
    const around = [v[i - 2], v[i - 1], v[i + 1], v[i + 2]];
    const mean = around.reduce((a, b) => a + b, 0) / 4;
    if (Math.abs(mean) < 0.05 || around.some(u => Math.sign(u) !== Math.sign(mean))) continue; // still, or turning
    all.moving++;
    const ratio = v[i] / mean;
    if (Math.abs(ratio) < 0.3) all.stalls++; else if (ratio > 1.6) all.doubles++;
    all.jitter.push(Math.abs(ratio - 1));
  }
  // Input to the window answering it: the first frame after the press (release) whose speed rose (fell) on the frame before.
  for (const inp of rec.inputs) {
    const i0 = f.findIndex(t => t > inp.t);
    if (i0 < 2) continue;
    for (let i = i0; i < Math.min(f.length, i0 + 30); i++) {
      if (v[i] === undefined || v[i - 1] === undefined) continue;
      const dv = v[i] - v[i - 1];
      if (inp.down ? dv > 1e-4 : dv < -1e-4) { all.latency.push(f[i] - inp.t); break; }
    }
  }
  for (const e of rec.events) if (/pointer|mouse/.test(e.name)) { all.evDur.push(e.dur); all.evDelay.push(e.delay); }
  all.longs += rec.longs.length; all.longMs += rec.longs.reduce((a, l) => a + l.dur, 0);
}
const iv = all.intervals;
const result = {
  mode: "60 Hz", catches: catches.length, seconds: r1(all.seconds), frames: iv.length, errors: errors.slice(0, 5),
  frameMs: { mean: r1(iv.reduce((a, b) => a + b, 0) / iv.length), p50: r1(pct(iv, 0.5)), p95: r1(pct(iv, 0.95)), p99: r1(pct(iv, 0.99)), max: r1(Math.max(...iv)), over25: iv.filter(x => x > 25).length, over50: iv.filter(x => x > 50).length },
  longTasks: { count: all.longs, ms: Math.round(all.longMs) },
  smooth: { movingFrames: all.moving, stalledPct: r1(100 * all.stalls / all.moving), doubledPct: r1(100 * all.doubles / all.moving), speedJitterPct: r1(100 * all.jitter.reduce((a, b) => a + b, 0) / all.jitter.length) },
  inputToMoveMs: { n: all.latency.length, p50: r1(pct(all.latency, 0.5)), p95: r1(pct(all.latency, 0.95)), max: r1(Math.max(...all.latency)) },
  eventTiming: { n: all.evDur.length, durP50: r1(pct(all.evDur, 0.5)), durMax: r1(Math.max(0, ...all.evDur)), delayP50: r1(pct(all.evDelay, 0.5)) },
};
writeFileSync(OUT, JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
