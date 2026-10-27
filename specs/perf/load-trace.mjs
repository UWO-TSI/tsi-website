// Title page to walking in the world (specs/lanes/loading.md step 1): the time it takes, what it is made of, and the
// long frames on the way (the title, the loading screen, the arrival's cutscenes, the first minute of play).
// Headless Chromium, muted, 1280 x 800 at DPR 1, against the measurement build (`specs/perf/measure-build.sh`, built
// with NEXT_PUBLIC_GAME_WORLD=new NEXT_PUBLIC_MEMBER_WORLD=open) on `next start -p $PORT`.
//
//   PORT=3151 NET=fast|slow|none CACHE=cold|warm DWELL=10 PROFILE=1 OUT=<dir> node specs/perf/load-trace.mjs <label>
//
// NET: fast is a good home line (100 Mbps down, 15 ms), slow a weaker one (12 Mbps, 60 ms). CACHE=warm runs the whole
// way once untimed in the same browser first. DWELL is the seconds spent on the title page (signing in). PROFILE=1
// samples the CPU (0.5 ms) and names what each long frame spent its time on (build with --no-mangling for names).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const LABEL = process.argv[2] ?? "run";
const PORT = process.env.PORT ?? 3151, BASE = `http://localhost:${PORT}`;
const NET = process.env.NET ?? "fast", CACHE = process.env.CACHE ?? "cold", DWELL = Number(process.env.DWELL ?? 10) * 1000;
const PROFILE = process.env.PROFILE === "1", PLAY_S = Number(process.env.PLAY ?? 60);
const OUT = process.env.OUT ?? "specs/evidence/loading/runs";
const NETS = {
  fast: { offline: false, latency: 15, downloadThroughput: 100e6 / 8, uploadThroughput: 20e6 / 8 },
  slow: { offline: false, latency: 60, downloadThroughput: 12e6 / 8, uploadThroughput: 3e6 / 8 },
};
const LONG = 50;

const browser = await chromium.launch({ channel: "chromium", headless: true,
  args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-precise-memory-info"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

// In the page: every frame's length and the WebGL work in it (program compiles and links, texture and buffer uploads),
// the long-animation-frame entries with their scripts, the heap, and when each milestone showed.
await ctx.addInitScript(() => {
  performance.setResourceTimingBufferSize(10000);
  const lt = window.__lt = { frames: [], loaf: [], marks: [], heap: [], gl: { sh: 0, shN: 0, tex: 0, texN: 0, buf: 0, bufN: 0 } };
  const SH = ["compileShader", "linkProgram", "getProgramParameter", "getShaderParameter", "getProgramInfoLog", "getShaderInfoLog", "getUniformLocation", "getAttribLocation", "getActiveUniform", "getActiveAttrib", "getUniformBlockIndex"];
  const TEX = ["texImage2D", "texSubImage2D", "texImage3D", "texSubImage3D", "texStorage2D", "texStorage3D", "compressedTexImage2D", "compressedTexSubImage2D", "generateMipmap"];
  const BUF = ["bufferData", "bufferSubData"];
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    for (const [names, key] of [[SH, "sh"], [TEX, "tex"], [BUF, "buf"]]) for (const n of names) {
      const f = C.prototype[n];
      if (!f) continue;
      C.prototype[n] = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { lt.gl[key] += performance.now() - t; lt.gl[key + "N"]++; } };
    }
  }
  let last = performance.now();
  const tick = now => {
    const g = lt.gl;
    lt.frames.push([Math.round(now), +(now - last).toFixed(1), +g.sh.toFixed(1), g.shN, +g.tex.toFixed(1), g.texN, +g.buf.toFixed(1), g.bufN]);
    g.sh = g.shN = g.tex = g.texN = g.buf = g.bufN = 0;
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) lt.loaf.push({ t: Math.round(e.startTime), d: Math.round(e.duration), block: Math.round(e.blockingDuration),
      scripts: e.scripts.sort((a, b) => b.duration - a.duration).slice(0, 4).map(s => ({ d: Math.round(s.duration), inv: s.invoker, fn: s.sourceFunctionName, url: (s.sourceURL || "").split("/").pop(), at: s.sourceCharPosition })) }); })
      .observe({ type: "long-animation-frame", buffered: true });
  } catch {}
  const seen = new Set();
  const mark = (name, when = performance.now()) => { if (!seen.has(name)) { seen.add(name); lt.marks.push([Math.round(when), name]); } };
  lt.mark = mark;
  let phase = null, trip = null;
  setInterval(() => {
    if (document.querySelector("main[data-ready]")) mark("title ready");
    if (document.querySelector("canvas")) mark("first canvas");
    const loading = [...document.querySelectorAll("[role=status]")].find(e => e.textContent.includes("Preparing the island"));
    if (loading) { mark("loading screen"); mark(`loading: ${loading.querySelector("p")?.textContent}`); if (loading.hasAttribute("data-leaving")) mark("world ready"); }
    else if (seen.has("loading screen")) mark("world ready");
    const s = window.__arrival?.state?.();
    if (s && s.phase !== phase) { phase = s.phase; mark(`arrival: ${phase}`); }
    if (s?.trip && s.trip.phase !== trip) { trip = s.trip.phase; mark(`boat: ${trip}`); }
    lt.phase = phase;
    if (performance.memory) lt.heap.push([Math.round(performance.now()), Math.round(performance.memory.usedJSHeapSize / 1e6)]);
  }, 50);
});

const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
if (NETS[NET]) await cdp.send("Network.emulateNetworkConditions", NETS[NET]);

const cat = u => {
  const p = u.split("?")[0];
  if (/\/(height|surface)\.[0-9a-f]*\.?png$|\/media\/(height|surface)/.test(p)) return "world";
  if (/\.js$/.test(p)) return "js";
  if (/\.css$/.test(p)) return "css";
  if (/\.(glb|gltf|bin)$/.test(p)) return "model";
  if (/\.(png|jpe?g|webp|ktx2|avif|svg|basis)$/.test(p)) return "texture";
  if (/\.(mp3|ogg|wav|m4a|opus)$/.test(p)) return "audio";
  if (/\.(woff2?|ttf|otf)$/.test(p)) return "font";
  if (/\/api\//.test(p)) return "api";
  return "other";
};

/** What a page loaded: per kind, the count, bytes over the wire, and when the first started and the last finished. */
async function pageData() {
  const d = await page.evaluate(() => ({
    nav: performance.getEntriesByType("navigation")[0]?.toJSON(),
    res: performance.getEntriesByType("resource").map(r => ({ url: r.name, t0: Math.round(r.startTime), t1: Math.round(r.responseEnd), wire: r.transferSize, size: r.encodedBodySize, type: r.initiatorType })),
    frames: window.__lt.frames, loaf: window.__lt.loaf, marks: window.__lt.marks, heap: window.__lt.heap,
    gpu: (() => { const gl = document.createElement("canvas").getContext("webgl2"); const e = gl?.getExtension("WEBGL_debug_renderer_info"); return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : "?"; })(),
  }));
  const kinds = {};
  for (const r of d.res) {
    const k = kinds[cat(r.url)] ??= { n: 0, wire: 0, size: 0, cached: 0, t0: Infinity, t1: 0 };
    k.n++; k.wire += r.wire; k.size += r.size; if (r.wire === 0) k.cached++; k.t0 = Math.min(k.t0, r.t0); k.t1 = Math.max(k.t1, r.t1);
  }
  return { ...d, kinds };
}

async function waitMark(name, ms) {
  await page.waitForFunction(n => window.__lt?.marks.some(m => m[1] === n), name, { timeout: ms, polling: 100 });
  return page.evaluate(n => window.__lt.marks.find(m => m[1] === n)[0], name);
}

/** The arrival through, as a player: Yes in the water after a moment's look, the crossing watched, the walk-along left, then a minute's walk. */
async function play(record) {
  await waitMark("world ready", 240000);
  await page.waitForSelector("[data-testid=reflection-yes]", { timeout: 60000 });
  await page.waitForTimeout(record ? 3000 : 300);
  await page.click("[data-testid=reflection-yes]");
  if (!record) return;
  await page.waitForSelector("[data-testid=arrival-leave-tour]", { timeout: 90000 });
  await page.waitForTimeout(4000);
  await page.click("[data-testid=arrival-leave-tour]");
  await page.evaluate(() => window.__lt.mark("play"));
  const walk = [["w", 5000], ["d", 1200], ["w", 6000], ["a", 2400], ["w", 6000], ["d", 1200], ["w", 6000]];
  const end = Date.now() + PLAY_S * 1000;
  for (let i = 0; Date.now() < end; i++) {
    const [k, ms] = walk[i % walk.length];
    await page.keyboard.down(k); if (k !== "w") await page.keyboard.down("w");
    await page.waitForTimeout(Math.min(ms, Math.max(0, end - Date.now())));
    await page.keyboard.up(k); if (k !== "w") await page.keyboard.up("w");
  }
  await page.evaluate(() => window.__lt.mark("end"));
}

if (CACHE === "warm") {
  await page.goto(`${BASE}/student`);
  await waitMark("title ready", 120000);
  await page.goto(`${BASE}/student/dashboard?arrival=1`);
  await play(false);
  await page.goto("about:blank");
}

// The title page.
const titleNav = Date.now();
await page.goto(`${BASE}/student`, { waitUntil: "commit" });
await waitMark("title ready", 120000);
await page.waitForTimeout(DWELL);
const title = await pageData();

// Signed in: the island (as /student/go sends a member), with the arrival.
if (PROFILE) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 500 }); await cdp.send("Profiler.start"); }
await page.goto(`${BASE}/student/dashboard?arrival=1`, { waitUntil: "commit" });
await play(true);
const world = await pageData();
let profile = null, endPage = 0;
if (PROFILE) { endPage = await page.evaluate(() => performance.now()); profile = (await cdp.send("Profiler.stop")).profile; }
await browser.close();

// ── Report ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const phaseAt = (marks, t) => { let p = "start"; for (const [at, name] of marks) if (at <= t && !name.startsWith("loading:") && !name.startsWith("boat:")) p = name; return p; };
const longs = (d, from = 0) => d.frames.filter(f => f[1] > LONG && f[0] > from).map(([t, dt, sh, shN, tex, texN, buf, bufN]) => {
  const loaf = d.loaf.find(l => l.t <= t && l.t + l.d >= t - dt);
  return { t, dt, phase: phaseAt(d.marks, t), sh, shN, tex, texN, buf, bufN, scripts: loaf?.scripts.map(s => `${s.d} ${s.inv}`).join("; ") ?? "" };
});
const kb = n => (n / 1024).toFixed(0);
const lines = [];
const out = s => { lines.push(s); console.log(s); };
out(`## ${LABEL}: NET=${NET} CACHE=${CACHE} DWELL=${DWELL / 1000}s ${PROFILE ? "PROFILE" : ""} (${world.gpu})`);
for (const [name, d] of [["title", title], ["world", world]]) {
  out(`\n### ${name} page (ms from its navigation)`);
  out(`nav: ttfb ${Math.round(d.nav.responseStart)}, DOMContentLoaded ${Math.round(d.nav.domContentLoadedEventEnd)}, load ${Math.round(d.nav.loadEventEnd)}`);
  out(`marks: ${d.marks.map(([t, n]) => `${n} ${t}`).join(" | ")}`);
  out(`| kind | files | KB over the wire | KB body | from cache | first start | last end |\n|---|---|---|---|---|---|---|`);
  for (const [k, v] of Object.entries(d.kinds).sort((a, b) => b[1].size - a[1].size)) out(`| ${k} | ${v.n} | ${kb(v.wire)} | ${kb(v.size)} | ${v.cached} | ${v.t0} | ${v.t1} |`);
  const L = longs(d);
  const sum = L.reduce((n, f) => n + f.dt, 0);
  out(`\nframes: ${d.frames.length}, over ${LONG} ms: ${L.length} (${Math.round(sum)} ms in all)`);
  const byPhase = {};
  for (const f of L) { const p = byPhase[f.phase] ??= { n: 0, worst: 0, sh: 0, tex: 0, buf: 0 }; p.n++; p.worst = Math.max(p.worst, f.dt); p.sh += f.sh; p.tex += f.tex; p.buf += f.buf; }
  out(`| phase | long frames | worst ms | in shader compile/link ms | in texture upload ms | in buffer upload ms |\n|---|---|---|---|---|---|`);
  for (const [p, v] of Object.entries(byPhase)) out(`| ${p} | ${v.n} | ${Math.round(v.worst)} | ${Math.round(v.sh)} | ${Math.round(v.tex)} | ${Math.round(v.buf)} |`);
  out(`\nlong frames: t, ms, phase, shader ms (calls), texture ms (calls), buffer ms (calls), scripts`);
  for (const f of L) out(`- ${f.t} ${f.dt} ${f.phase} sh ${f.sh} (${f.shN}) tex ${f.tex} (${f.texN}) buf ${f.buf} (${f.bufN}) ${f.scripts}`);
}

if (profile) {
  // Profile time to page time: the profile ends at about Profiler.stop, read on the page's clock just before it.
  const byId = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  let at = profile.startTime;
  const offset = endPage - (profile.endTime - profile.startTime) / 1000;
  const samples = profile.samples.map((id, k) => { at += profile.timeDeltas[k]; return [offset + (at - profile.startTime) / 1000, id, profile.timeDeltas[k] / 1000]; });
  const label = n => { const cf = n.callFrame, name = cf.functionName || "(anonymous)"; return name.startsWith("(") ? name : `${name} ${cf.url.split("/").pop().split("?")[0]}:${cf.lineNumber + 1}`; };
  const breakdown = (from, to) => {
    const self = new Map(), owners = new Map();
    for (const [t, id, dt] of samples) if (t > from && t <= to) {
      const n = byId.get(id), k = label(n);
      if (k === "(idle)") continue;
      self.set(k, (self.get(k) ?? 0) + dt);
      for (let p = parent.get(id); p !== undefined; p = parent.get(p)) { const pn = byId.get(p); if (pn.callFrame.functionName && pn.callFrame.url) { const o = label(pn); owners.set(o, (owners.get(o) ?? 0) + dt); break; } }
    }
    return { self: [...self].sort((a, b) => b[1] - a[1]).slice(0, 10), owners: [...owners].sort((a, b) => b[1] - a[1]).slice(0, 6) };
  };
  const marks = Object.fromEntries(world.marks.map(([t, n]) => [n, t]));
  out(`\n### Main thread, by function (self ms), page start to world ready`);
  const load = breakdown(0, marks["world ready"] ?? 1e9);
  for (const [k, ms] of load.self) out(`- ${ms.toFixed(0)} ${k}`);
  out(`\n### Long frames, what they ran (self ms; then the caller)`);
  for (const f of longs(world)) {
    const b = breakdown(f.t - f.dt, f.t);
    out(`\n${f.t} ${f.phase}: ${f.dt} ms\n  self: ${b.self.slice(0, 6).map(([k, ms]) => `${ms.toFixed(1)} ${k}`).join("\n        ")}\n  callers: ${b.owners.slice(0, 4).map(([k, ms]) => `${ms.toFixed(1)} ${k}`).join("\n           ")}`);
  }
}

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/${LABEL}.md`, lines.join("\n") + "\n");
writeFileSync(`${OUT}/${LABEL}.json`, JSON.stringify({ title, world }));
