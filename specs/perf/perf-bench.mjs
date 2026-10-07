// The performance pass's bench (specs/perf/2026-10-baseline.md, 2026-10-results.md): the same scenes before and after.
//   PORT=3149 node specs/perf/perf-bench.mjs [scenes] [outFile]
//   scenes: comma list of village, cafe, ruins-<kit> (default: village,cafe and the four heavy ults' kits).
//   Env: TIER=high|lite (default high), SECONDS (default 8), PROFILE=1 (a CPU profile after each run, top self time),
//   UNCAPPED=0 (keep the display's frame pacing; default off so the frame rate shows the real cost), SHOTS=dir (a
//   close-up and a wide screenshot per scene).
// Headed Chromium off to the side (--window-position=2400,0), muted, the real GPU (ANGLE on Metal), never brought to
// the front. Each scene runs on a fresh page, waits for the world to settle, then samples every frame for SECONDS
// (requestAnimationFrame) with window.__perf (components/game/PerfProbe.tsx, development builds and the measurement
// build) recording draw calls, triangles, mixers, skeletons and the main thread's frame time.
// The ruins: k5-perf.mjs's fight (a pack of 17 hunting you at 30x health, you can't fall, the kit's keys on a loop, the
// ult a second in), and its first ult's worst frame (the first-use hitch) and a second ult's (TWICE: on by default).
import { createRequire } from "node:module";
import { appendFileSync, mkdirSync } from "node:fs";
import { loadavg } from "node:os";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [SCENES = "village,cafe,ruins-summoner,ruins-illusionist,ruins-elementalist,ruins-marksman", OUT = "/tmp/perf-bench.jsonl"] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3149, W = 1280, H = 800, SECONDS = Number(process.env.SECONDS ?? 8), TIER_NAME = process.env.TIER ?? "high";
const UNCAPPED = process.env.UNCAPPED !== "0", PROFILE = process.env.PROFILE === "1", SHOTS = process.env.SHOTS ?? "";
const args = ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-precise-memory-info"];
if (UNCAPPED) args.push("--disable-gpu-vsync", "--disable-frame-rate-limit");
const browser = await chromium.launch({ headless: false, args });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const TIER = { high: { "tsi.liteMode.v1": "false", "tsi.shadows.v1": "true" }, lite: { "tsi.liteMode.v1": "true", "tsi.shadows.v1": "false" } }[TIER_NAME];
const BASE = "time=day&weather=clear&season=summer";
const ME = { x: 2, z: -16 }, AIM = { x: 2, z: -11.5 };
const PACK = [
  ...Array.from({ length: 5 }, (_, i) => ["shadow-fox", 2 + Math.cos(i * 1.3) * 3.2, -11 + Math.sin(i * 1.3) * 2.2]),
  ...Array.from({ length: 3 }, (_, i) => ["thorn-crab", -0.5 + i * 2.5, -9.2]),
  ...Array.from({ length: 3 }, (_, i) => ["mushroom-beast", -1 + i * 3, -7.6]),
  ...Array.from({ length: 3 }, (_, i) => ["rune-wisp", 0 + i * 2, -6.4]),
  ...Array.from({ length: 3 }, (_, i) => ["pollen-sprite", 1 + i * 1.1, -12.6]),
];
let ctx, page;
async function fresh() {
  await ctx?.close();
  ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([look, store]) => { try {
    localStorage.setItem("tsi.look.v1", look); localStorage.removeItem("tsi.combatKeys.v3"); localStorage.setItem("tsi.hud.full.v1", "true");
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 1.05, pitch: 0.62, zoom: 1.12, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
    for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
  } catch {} }, [LOOK, TIER]);
  page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
}
async function settle(extra) {
  await page.waitForSelector("canvas", { timeout: 240000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(extra) ? quiet + 1 : 0; }
  await page.waitForTimeout(4000); // shaders compiled, the shadow map baked, the quality probe done
}
const ready = {
  world: () => !!window.__perf && !!window.__move?.sim?.current && !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"),
  net: () => !!window.__perf && !!window.__move?.sim?.current && (window.__net?.remotes().length ?? 0) > 0,
  ruins: () => !!window.__perf && !!window.__move?.sim?.current && !!window.__combatDev?.screenOf && !!window.__combat?.rt?.v2,
};
async function stage() {
  await page.evaluate(([x, z, pack]) => {
    const rt = window.__combat.rt;
    window.__combatDev.reset();
    rt.enemies = rt.enemies.filter(e => e.type.kind === "boss").map(e => ({ ...e, state: "idle", x: e.spawnX, z: e.spawnZ }));
    rt.projectiles = []; rt.units = []; rt.floaters = []; rt.blasts = []; rt.banner = null; rt.fx = []; rt.hazards = [];
    Object.assign(rt.player, { hp: rt.player.maxHp, alive: true, energy: 999 });
    Object.assign(rt.v2, { cd: {}, meter: 0, cast: null });
    window.__move.teleport(x, z, 0);
    pack.forEach(([type, fx, fz], i) => window.__combatDev.spawn(type, fx, fz, `pb-${type}-${i}-${Math.random().toString(36).slice(2, 6)}`));
    for (const e of rt.enemies) if (e.type.kind !== "boss") e.hp = e.type.hp * 30;
    clearInterval(window.__pbgod);
    window.__pbgod = setInterval(() => { const p = window.__combat.rt.player; p.hp = p.maxHp; p.alive = true; p.energy = Math.max(p.energy, 60); window.__combat.rt.v2.cd = {}; }, 150);
    window.__publishCombat();
  }, [ME.x, ME.z, PACK]);
  const p = await page.evaluate(([x, z]) => window.__combatDev.screenOf(x, z), [AIM.x, AIM.z]);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(600);
}
/** Every frame's time over `seconds` (and __perf's per-frame counters); in the ruins the keys on a loop and the ult at 1 s (and 6 s). */
async function sample(seconds, fight) {
  const frames = page.evaluate(s => new Promise(r => {
    window.__perf.begin();
    const t = []; let last = performance.now(); const t0 = last; window.__pbt0 = t0;
    const tick = now => { t.push([now - t0, now - last]); last = now; if (now - t0 < s * 1000) requestAnimationFrame(tick); else r({ t: t.slice(1), perf: window.__perf.end() }); };
    requestAnimationFrame(tick);
  }), seconds);
  const ults = [];
  if (fight) {
    const keys = ["1", "2", "3", "4", "5"], t0 = Date.now(); let i = 0;
    const fire = async () => { await page.evaluate(() => { window.__combat.rt.v2.meter = 100; }); await page.keyboard.press("f"); ults.push(await page.evaluate(() => performance.now() - window.__pbt0)); };
    while (Date.now() - t0 < seconds * 1000 - 300) {
      if (ults.length === 0 && Date.now() - t0 > 1000) await fire();
      if (ults.length === 1 && Date.now() - t0 > 6000) await fire();
      await page.keyboard.press(keys[i++ % keys.length]);
      await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up();
      await page.waitForTimeout(160);
    }
  }
  const f = await frames;
  return { ...f, ults };
}
const pct = (s, q) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
/** Top self time from a CPU profile, by function and place. */
function topSelf(profile, n = 25) {
  const self = new Map(), byId = new Map(profile.nodes.map(x => [x.id, x]));
  const dt = profile.timeDeltas;
  let total = 0;
  for (let i = 0; i < profile.samples.length; i++) {
    const node = byId.get(profile.samples[i]), d = (dt[i + 1] ?? 0) / 1000;
    const cf = node.callFrame, name = cf.functionName || "(anonymous)";
    const key = name.startsWith("(") ? name : `${name} ${cf.url.split("/").pop().split("?")[0]}:${cf.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + d);
    if (name !== "(idle)") total += d;
  }
  return { totalMs: +total.toFixed(1), top: [...self].filter(([k]) => k !== "(idle)").sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, ms]) => [k, +ms.toFixed(1), +(100 * ms / total).toFixed(1)]) };
}
async function profile(seconds, fight) {
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 200 }); await cdp.send("Profiler.start");
  if (fight) { await stage(); await sample(seconds, true); } else await page.waitForTimeout(seconds * 1000);
  const { profile: p } = await cdp.send("Profiler.stop");
  await cdp.detach();
  return topSelf(p);
}
function summarise(scene, s) {
  const ft = s.t.map(([, d]) => d), sorted = [...ft].sort((a, b) => b - a), total = ft.reduce((a, b) => a + b, 0);
  const slow1 = sorted.slice(0, Math.max(1, Math.round(ft.length / 100)));
  const asc = [...ft].sort((a, b) => a - b);
  const after = at => Math.max(0, ...s.t.filter(([t]) => t >= at && t < at + 1500).map(([, d]) => d));
  return { scene, tier: TIER_NAME, uncapped: UNCAPPED, frames: ft.length, fps: +(ft.length / (total / 1000)).toFixed(1), median: +pct(asc, 0.5).toFixed(2), p95: +pct(asc, 0.95).toFixed(2),
    p99: +pct(asc, 0.99).toFixed(2), worst: +sorted[0].toFixed(1), low1: +(1000 / (slow1.reduce((a, b) => a + b, 0) / slow1.length)).toFixed(1), over33: ft.filter(x => x > 33.4).length,
    firstUlt: s.ults[0] !== undefined ? +after(s.ults[0]).toFixed(1) : null, secondUlt: s.ults[1] !== undefined ? +after(s.ults[1]).toFixed(1) : null, perf: s.perf };
}
const n = v => (typeof v === "number" ? +v.toFixed(2) : v);
for (const scene of SCENES.split(",")) {
  try {
    await fresh();
    const fight = scene.startsWith("ruins-"), kit = fight ? scene.slice(6) : null;
    const url = fight ? `/lab/island?${BASE}&ruins=1&combat=demo&classes=v2&subclass=${kit}&mastery=20&traits=all&tamed=all`
      : scene === "cafe" ? `/lab/island?${BASE}&cafe=inside&bots=24` : `/lab/island?${BASE}&bots=24`;
    await page.goto(`http://localhost:${PORT}${url}`, { waitUntil: "domcontentloaded" });
    await settle(fight ? ready.ruins : scene === "cafe" ? ready.world : ready.net);
    if (fight) await stage();
    const ult = fight ? await page.evaluate(() => window.__combat.rt.v2.ult.name) : null;
    const s = await sample(SECONDS, fight);
    const sceneCounts = await page.evaluate(() => window.__perf.scene());
    const heap = await page.evaluate(() => Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1048576));
    if (SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: `${SHOTS}/${scene}-${TIER_NAME}.png` }); }
    const row = { ...summarise(scene, s), ult, scene: scene, sceneCounts, heapMB: heap, load: loadavg()[0], at: new Date().toISOString() };
    if (PROFILE) row.profile = await profile(Math.min(SECONDS, 6), fight);
    appendFileSync(OUT, JSON.stringify(row) + "\n");
    const p = row.perf;
    console.log(`${scene}${ult ? ` (${ult})` : ""} ${TIER_NAME}: ${row.fps} FPS, 1% low ${row.low1}, median ${row.median} p95 ${row.p95} worst ${row.worst} ms; first ult ${row.firstUlt} second ${row.secondUlt}`
      + ` | calls ${n(p.calls.median)} (p95 ${n(p.calls.p95)}), tris ${Math.round(p.triangles.median)}, mixers ${n(p.mixers.median)}, skeletons ${n(p.skeletons.median)}, cpu ${n(p.cpu.median)} (p95 ${n(p.cpu.p95)}) render ${n(p.render.median)} ms`
      + ` | skinned ${sceneCounts.skinned}, instanced ${sceneCounts.instanced}, meshes ${sceneCounts.meshes}, lights ${sceneCounts.lights}, programs ${sceneCounts.programs} | heap ${heap} MB | load ${row.load.toFixed(2)}`);
    if (row.profile) for (const [k, ms, share] of row.profile.top.slice(0, 15)) console.log(`   ${share}%  ${ms} ms  ${k}`);
  } catch (err) { console.log("failed", scene, err.message.slice(0, 300)); }
}
await browser.close();
