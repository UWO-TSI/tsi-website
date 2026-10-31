// Entering the game (specs/lanes/entry-perf.md): a member opens the title, clicks Play, and walks on the island.
// Headless Chromium, muted, 1280 x 800 at DPR 1, against a real production build (`npm run build`, not the measurement
// build: no dev gates, so it reads the scene through three's devtools hook only) on `next start -p $PORT`.
//
//   PORT=3322 NET=none|campus CACHE=cold|warm DWELL=3 OUT=<dir> node specs/perf/entry-trace.mjs <label>
//
// NET: none is unthrottled; campus is a laptop on campus wifi (20 Mbps down, 40 ms, CPU 2x; the CPU throttle covers the
// page's main thread, not its workers). CACHE=warm walks the whole way once untimed in the same browser first. DWELL is
// the seconds on the title before Play (a signed-in member clicks it within a few). Play is a navigation to
// /student/dashboard, where /student/go sends a member (that hop, a redirect after one Supabase getUser, is not timed).
// The build must serve the dashboard signed out: build with NEXT_PUBLIC_MEMBER_WORLD=open and a dead Supabase
// (NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:9), then drop the dashboard from .next/server/middleware-manifest.json's
// matchers. Never deploy that build.
//
// Milestones (ms from Play): the loading screen; the first island frame (the loading screen gone); the first frame you
// can move in (W held from the first island frame until the camera moves). Per milestone: bytes and requests by kind.
// Also: long animation frames over 50 ms with their scripts, WebGL program compile and link time, the API and Supabase
// requests in order, the JS heap, and the GPU memory the page uploaded (textures and buffers, an estimate from the
// upload calls' sizes; three's renderer.info counts).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const LABEL = process.argv[2] ?? "run";
const PORT = process.env.PORT ?? 3322, BASE = `http://localhost:${PORT}`;
const NET = process.env.NET ?? "none", CACHE = process.env.CACHE ?? "cold", DWELL = Number(process.env.DWELL ?? 3) * 1000;
const OUT = process.env.OUT ?? "specs/evidence/entry-perf/runs";
const PROFILE = process.env.PROFILE === "1";
const NETS = { campus: { net: { offline: false, latency: 40, downloadThroughput: 20e6 / 8, uploadThroughput: 5e6 / 8 }, cpu: 2 } };

const browser = await chromium.launch({ channel: "chromium", headless: true,
  args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-precise-memory-info"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

await ctx.addInitScript(() => {
  performance.setResourceTimingBufferSize(10000);
  // A returning member: their look is cached on this device (lib/game/character/lookStore.ts), so no creator.
  try { if (!localStorage.getItem("tsi.look.v1")) { localStorage.setItem("tsi.look.v1", "{}"); localStorage.setItem("tsi.welcomed.v1", "1"); } } catch {}
  const et = window.__et = { marks: [], loaf: [], gl: { compile: 0, link: 0, programs: 0, tex: 0, buf: 0 }, cams: [], renderers: [] };
  const seen = new Set();
  et.mark = (name, at = performance.now()) => { if (!seen.has(name)) { seen.add(name); et.marks.push([Math.round(at), name]); } };
  // three's devtools hook: the renderers, so the camera of every render is known (the player's follow camera moves when W walks).
  const hook = window.__THREE_DEVTOOLS__ = new EventTarget();
  hook.addEventListener("observe", e => {
    const r = e.detail;
    if (r?.isScene) (et.scenes ??= []).push(r);
    if (!r?.isWebGLRenderer || et.renderers.includes(r)) return;
    et.renderers.push(r);
    const render = r.render;
    r.render = function (scene, cam) {
      if (cam?.isPerspectiveCamera && scene?.children?.length > 20) { const p = cam.matrixWorld.elements; et.cam = [p[12], p[13], p[14]]; }
      return render.call(this, scene, cam);
    };
  });
  // The GL work: compile and link time, and the bytes uploaded (an estimate of GPU memory: textures at 4 bytes a texel
  // unless compressed, mip chains at 4/3, buffers at their size).
  const bpp = 4, mips = n => (n > 1 ? 4 / 3 : 1);
  const sizeOf = (a, i) => { const v = a[i]; return v?.byteLength ?? (typeof v === "number" ? v : 0); };
  for (const C of [window.WebGL2RenderingContext, window.WebGLRenderingContext]) {
    if (!C) continue;
    const wrap = (n, after) => { const f = C.prototype[n]; if (f) C.prototype[n] = function (...a) { const t = performance.now(); try { return f.apply(this, a); } finally { after?.(a, performance.now() - t); } }; };
    wrap("compileShader", (a, ms) => { et.gl.compile += ms; });
    wrap("linkProgram", (a, ms) => { et.gl.link += ms; et.gl.programs++; });
    wrap("getProgramParameter", (a, ms) => { et.gl.link += ms; }); // three's async link check: the wait lands here
    wrap("texStorage2D", a => { et.gl.tex += a[3] * a[4] * bpp * mips(a[1]); });
    wrap("texStorage3D", a => { et.gl.tex += a[3] * a[4] * a[5] * bpp * mips(a[1]); });
    wrap("texImage2D", a => { if (a[1] === 0) et.gl.tex += a.length >= 9 ? a[3] * a[4] * bpp : ((a[5]?.width ?? 0) * (a[5]?.height ?? 0) * bpp); });
    wrap("compressedTexImage2D", a => { et.gl.tex += sizeOf(a, 6); });
    wrap("compressedTexSubImage2D", a => { if (a[1] === 0) et.gl.tex += sizeOf(a, 7); });
    wrap("bufferData", a => { et.gl.buf += sizeOf(a, 1); });
  }
  try {
    new PerformanceObserver(l => { for (const e of l.getEntries()) et.loaf.push({ t: Math.round(e.startTime), d: Math.round(e.duration),
      scripts: e.scripts.sort((a, b) => b.duration - a.duration).slice(0, 3).map(s => `${Math.round(s.duration)} ${s.invoker} ${(s.sourceURL || "").split("/").pop()}`) }); })
      .observe({ type: "long-animation-frame", buffered: true });
  } catch {}
  setInterval(() => {
    if (document.querySelector("main[data-ready]")) et.mark("title ready");
    const screen = [...document.querySelectorAll("[role=status]")].find(e => /Tethos Island/.test(e.textContent));
    if (screen) {
      et.mark("loading screen");
      for (const [w, n] of [["Sweeping", "stage: files"], ["Lighting", "stage: warm-up"]]) if (screen.textContent.includes(w)) et.mark(n);
    }
    if (document.querySelector("canvas")) et.mark("canvas");
    // The island shows as the loading screen starts its fade (data-leaving), or once it is gone.
    if (seen.has("canvas") && (!screen || screen.hasAttribute("data-leaving"))) et.mark("first island frame");
  }, 25);
});

const page = await ctx.newPage();
const logs = [];
page.on("console", m => { if (m.type() === "error" || /^\[warm\]/.test(m.text())) logs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
const cdp = await ctx.newCDPSession(page);
await cdp.send("Network.enable");
const throttle = NETS[NET];
const KINDS = ["doc", "js", "css", "glb", "ktx2", "png", "webp", "jpg", "audio", "font", "api", "supabase", "other"];
const kind = u => {
  const p = new URL(u).pathname;
  if (!u.startsWith(BASE)) return /127\.0\.0\.1:9|supabase/.test(u) ? "supabase" : "other";
  if (p.startsWith("/api/")) return "api";
  const ext = (p.match(/\.(\w+)$/)?.[1] ?? "").toLowerCase();
  return { js: "js", css: "css", glb: "glb", gltf: "glb", bin: "glb", ktx2: "ktx2", png: "png", webp: "webp", jpg: "jpg", jpeg: "jpg",
    ogg: "audio", mp3: "audio", wav: "audio", m4a: "audio", woff2: "font", woff: "font", ttf: "font" }[ext] ?? (ext ? "other" : "doc");
};

async function snap() {
  return page.evaluate(() => ({
    nav: performance.getEntriesByType("navigation")[0]?.toJSON(),
    paint: Object.fromEntries(performance.getEntriesByType("paint").map(p => [p.name, Math.round(p.startTime)])),
    res: performance.getEntriesByType("resource").map(r => ({ url: r.name, type: r.initiatorType, t0: Math.round(r.startTime), t1: Math.round(r.responseEnd), wire: r.transferSize, body: r.encodedBodySize })),
    entered: performance.getEntriesByName("island entered")[0]?.startTime, marks: window.__et.marks, loaf: window.__et.loaf, gl: window.__et.gl,
    heap: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null,
    info: window.__et.renderers.map(r => ({ ...r.info.memory, programs: r.info.programs?.length ?? 0 })),
    // The biggest textures on the GPU: width x height and where they came from.
    textures: (() => {
      const r = window.__et.renderers[0], seen = new Map();
      for (const s of window.__et.scenes ?? []) s.traverse(o => { for (const m of [o.material].flat()) if (m) for (const v of Object.values(m)) if (v?.isTexture && v.image?.width) seen.set(v, `${v.image.width}x${v.image.height} ${v.name || v.image.currentSrc || v.image.src || ""}`.slice(0, 140)); });
      return [...seen.entries()].sort((a, b) => b[0].image.width * b[0].image.height - a[0].image.width * a[0].image.height).slice(0, 15).map(e => e[1]);
    })(),
  }));
}
const waitMark = (name, ms) => page.waitForFunction(n => window.__et?.marks.some(m => m[1] === n), name, { timeout: ms, polling: 50 })
  .then(() => page.evaluate(n => window.__et.marks.find(m => m[1] === n)[0], name), async e => {
    console.error(`no "${name}" at ${page.url()}: marks`, JSON.stringify(await page.evaluate(() => window.__et?.marks)), await page.evaluate(() => document.body.innerText.slice(0, 300)));
    await page.screenshot({ path: `${OUT}/${LABEL}-stuck.png`, scale: "css" }).catch(() => {});
    throw e;
  });

/** Play: the island page, its first frame, then W held until the camera moves. */
async function enter(record) {
  await page.goto(`${BASE}/student/dashboard`, { waitUntil: "commit" });
  await waitMark("first island frame", Number(process.env.WAIT ?? 300) * 1000);
  // SHOT=<s>: a screenshot that many seconds after the first island frame, standing at the spawn (the camera and the
  // lamps nearest you are then the same every run), for before and after comparisons. It delays "can move".
  if (record && process.env.SHOT) { await page.waitForTimeout(Number(process.env.SHOT) * 1000); await page.screenshot({ path: `${OUT}/${LABEL}.png`, scale: "css" }); }
  const start = await page.evaluate(() => window.__et.cam);
  await page.keyboard.down("w");
  await page.waitForFunction(s => { const c = window.__et.cam; return c && s && Math.hypot(c[0] - s[0], c[2] - s[2]) > 0.3; }, start, { timeout: 60000, polling: "raf" })
    .then(() => page.evaluate(() => window.__et.mark("can move")), async () => { if (record) await page.screenshot({ path: `${OUT}/${LABEL}-stuck.png`, scale: "css" }); });
  await page.keyboard.up("w");
  if (record) await page.waitForTimeout(3000); // the frames just after, and the heap once it settles

}

async function title() {
  await page.goto(`${BASE}/student`, { waitUntil: "commit" });
  await waitMark("title ready", 120000);
  await page.waitForTimeout(DWELL);
}

mkdirSync(OUT, { recursive: true });
if (CACHE === "warm") { await title(); await enter(false); await page.goto("about:blank"); }
if (throttle) { await cdp.send("Network.emulateNetworkConditions", throttle.net); await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle.cpu }); }
await title();
const t = await snap();
if (PROFILE) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 1000 }); await cdp.send("Profiler.start"); }
await enter(true);
const w = await snap();
const profile = PROFILE ? (await cdp.send("Profiler.stop")).profile : null;
await browser.close();

// ── Report ──────────────────────────────────────────────────────────────────────────────────────────────────────────
const lines = [], out = s => { lines.push(s); console.log(s); };
const mb = n => (n / 1048576).toFixed(2);
const at = (d, n) => d.marks.find(m => m[1] === n)?.[0];
function table(d, milestones) {
  out(`| before | ${KINDS.join(" | ")} | all |\n|---|${KINDS.map(() => "---|").join("")}---|`);
  for (const [name, ms] of milestones) {
    if (ms === undefined) { out(`| ${name} | not reached |`); continue; }
    const by = Object.fromEntries(KINDS.map(k => [k, { n: 0, wire: 0 }]));
    const rs = d.res.filter(r => r.t0 <= ms);
    for (const r of rs) { const b = by[kind(r.url)]; b.n++; b.wire += r.wire; }
    if (d.nav && name !== "") { by.doc.n++; by.doc.wire += d.nav.transferSize; }
    const all = Object.values(by).reduce((a, b) => ({ n: a.n + b.n, wire: a.wire + b.wire }), { n: 0, wire: 0 });
    out(`| ${name} (${ms} ms) | ${KINDS.map(k => (by[k].n ? `${by[k].n} / ${mb(by[k].wire)}` : "")).join(" | ")} | ${all.n} / ${mb(all.wire)} |`);
  }
  out(`(requests / MB over the wire; requests started before the milestone)`);
}
function longs(d, from, to) {
  const L = d.loaf.filter(l => l.d > 50 && l.t >= from && l.t <= to);
  return { n: L.length, ms: L.reduce((s, l) => s + l.d, 0), worst: L.sort((a, b) => b.d - a.d).slice(0, 5) };
}

out(`## ${LABEL}: NET=${NET} CACHE=${CACHE} DWELL=${DWELL / 1000}s`);
out(`\n### Title (ms from its navigation)`);
out(`first paint ${t.paint["first-paint"]}, first contentful paint ${t.paint["first-contentful-paint"]}, interactive (title ready) ${at(t, "title ready")}, DOMContentLoaded ${Math.round(t.nav.domContentLoadedEventEnd)}`);
table(t, [["title ready", at(t, "title ready")], ["Play", at(t, "title ready") + DWELL]]);
const tl = longs(t, 0, 1e9);
out(`long frames over 50 ms: ${tl.n} (${tl.ms} ms); worst: ${tl.worst.map(l => `${l.d} [${l.scripts.join("; ")}]`).join(" | ")}`);

out(`\n### Play to walking (ms from Play)`);
const M = ["loading screen", "canvas", "stage: files", "stage: warm-up", "first island frame", "can move"];
out(M.map(n => `${n} ${at(w, n) ?? "-"}`).join(" | "));
table(w, M.map(n => [n, at(w, n)]));
const end = at(w, "can move") ?? at(w, "first island frame") ?? 1e9;
const wl = longs(w, 0, end);
out(`long frames over 50 ms before can move: ${wl.n} (${wl.ms} ms); worst: ${wl.worst.map(l => `${l.t}+${l.d} [${l.scripts.join("; ")}]`).join(" | ")}`);
const after = longs(w, end, 1e9);
out(`long frames in the 3 s after: ${after.n}${after.worst[0] ? `, worst ${after.worst[0].d}` : ""}`);
out(`WebGL: ${w.gl.programs} programs linked; compile ${Math.round(w.gl.compile)} ms, link and its waits ${Math.round(w.gl.link)} ms (main thread)`);
out(`memory once in: JS heap ${w.heap} MB; GPU uploads ~${mb(w.gl.tex)} MB textures + ${mb(w.gl.buf)} MB buffers; three: ${JSON.stringify(w.info)}`);
const calls = w.res.filter(r => ["api", "supabase"].includes(kind(r.url))).map(r => `${r.t0}-${r.t1} ${r.url.replace(BASE, "")}`);
out(`API and Supabase requests (${calls.length}):\n${calls.map(c => `- ${c}`).join("\n")}`);
const big = [...w.res].filter(r => r.t0 <= end && r.wire > 200e3).sort((a, b) => b.wire - a.wire).slice(0, 12);
out(`largest over the wire before can move:\n${big.map(r => `- ${mb(r.wire)} MB ${r.url.replace(BASE, "")} (${r.t0}-${r.t1})`).join("\n")}`);

// Every game file the title and the island ask for should carry its version (lib/assetUrl.ts): the bare ones, which the
// browser revalidates on every visit.
const bare = [...new Set([...t.res, ...w.res].map(r => new URL(r.url)).filter(u => u.origin === BASE && /^\/(assets|models|audio)\//.test(u.pathname) && !u.searchParams.has("v")).map(u => u.pathname))];
out(`game files without a version: ${bare.length}${bare.length ? `\n${bare.slice(0, 20).map(p => `- ${p}`).join("\n")}` : ""}`);
out(`console (errors and warm-up lines, ${logs.length}):\n${[...new Set(logs)].slice(0, 12).map(l => `- ${l}`).join("\n")}`);
out(`biggest textures in the scene:\n${w.textures.map(t => `- ${t}`).join("\n")}`);
if (profile) {
  // Self time by function from Play to the first island frame (profile time is µs since its start, about Play).
  const byId = new Map(profile.nodes.map(n => [n.id, n])), self = new Map(), first = at(w, "first island frame") ?? 1e9;
  let tAt = 0;
  profile.samples.forEach((id, k) => {
    tAt += profile.timeDeltas[k] / 1000;
    if (tAt > first) return;
    const cf = byId.get(id).callFrame, key = cf.functionName.startsWith("(") ? cf.functionName : `${cf.functionName || "(anon)"} ${cf.url.split("/").pop()}:${cf.lineNumber + 1}:${cf.columnNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + profile.timeDeltas[k] / 1000);
  });
  const buckets = new Map();
  tAt = 0;
  profile.samples.forEach((id, k) => {
    tAt += profile.timeDeltas[k] / 1000;
    if (tAt > first) return;
    const b = Math.floor(tAt / 500) * 500, cf = byId.get(id).callFrame, m = buckets.get(b) ?? new Map();
    const key = cf.functionName.startsWith("(") ? cf.functionName : `${cf.functionName || "(anon)"} ${cf.url.split("/").pop()}:${cf.columnNumber + 1}`;
    m.set(key, (m.get(key) ?? 0) + profile.timeDeltas[k] / 1000); buckets.set(b, m);
  });
  out(`main thread by half second (ms busy; top three):\n${[...buckets].map(([b, m]) => { const all = [...m].filter(([k]) => k !== "(idle)"); return `- ${b}: ${Math.round(all.reduce((n, [, v]) => n + v, 0))} busy; ${all.sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, v]) => `${Math.round(v)} ${k}`).join(", ")}`; }).join("\n")}`);
  out(`main thread self time, Play to first island frame (ms):\n${[...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, ms]) => `- ${ms.toFixed(0)} ${k}`).join("\n")}`);
}
writeFileSync(`${OUT}/${LABEL}.md`, lines.join("\n") + "\n");
writeFileSync(`${OUT}/${LABEL}.json`, JSON.stringify({ title: t, world: w }));

// MANIFEST=1: the island's own static files that its first frame waited for (requested before it was entered), in the order it asked for them,
// less the ones the title page loads itself (not its prefetches), for the title to prefetch (web/lib/game/preloadAssets.ts). Built files
// (/_next) are left to the title, which reads them from the build itself.
if (process.env.MANIFEST === "1") {
  const first = w.entered ?? at(w, "first island frame"), own = new Set(t.res.filter(r => r.type === "fetch" || r.type === "img").map(r => new URL(r.url).pathname));
  const asset = u => u.origin === BASE && /\.(glb|gltf|bin|png|jpe?g|webp|ktx2|ogg|mp3|wav|m4a)$/.test(u.pathname) && !u.pathname.startsWith("/_next/");
  const before = w.res.filter(r => r.t0 <= first).sort((a, b) => a.t0 - b.t0).map(r => new URL(r.url)).filter(asset);
  const list = [...new Set(before.map(u => u.pathname))].filter(p => !own.has(p) && !(p.startsWith("/audio/") && !p.startsWith("/audio/sfx/")));
  const readyFiles = new Set(before.filter(u => /\.(glb|gltf|png|jpe?g|webp|ktx2)$/.test(u.pathname)).map(u => u.pathname)).size;
  writeFileSync("web/lib/game/preloadAssets.ts", `// Generated by specs/perf/entry-trace.mjs (MANIFEST=1, ${new Date().toISOString().slice(0, 10)}): the files the member island's first
// frame waits for that the title page doesn't load itself, in the order the island asks for them. The title page
// prefetches them (components/title/preloadGame.ts). Regenerate after adding or moving what the island loads up front;
// preloadAssets.test.ts fails on a file that is gone.
export const GAME_ASSETS: readonly string[] = [
${list.map(p => `  ${JSON.stringify(p)},`).join("\n")}
];

/** How many models and textures the island had asked for when its loading screen lifted: the loading screen's floor for "of how many". */
export const READY_FILES = ${readyFiles};
`);
  console.log(`wrote web/lib/game/preloadAssets.ts: ${list.length} files, READY_FILES ${readyFiles}`);
}
