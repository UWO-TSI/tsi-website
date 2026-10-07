// What the long frames in the ruins fight are made of (specs/perf/): perf-bench's fight for one kit under the CPU
// profiler (100 µs samples), then, for every frame over 40 ms, the functions that took its time (self time of the
// samples inside it).   PORT=3149 node specs/perf/hitch-trace.mjs <kit> [tier]
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [KIT = "summoner", TIER = "high"] = process.argv.slice(2), PORT = process.env.PORT ?? 3149;
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist", ...(process.env.UNCAPPED === "1" ? ["--disable-gpu-vsync", "--disable-frame-rate-limit"] : [])] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await ctx.addInitScript(lite => { try {
  localStorage.setItem("tsi.liteMode.v1", String(lite)); localStorage.setItem("tsi.shadows.v1", String(!lite)); localStorage.setItem("tsi.hud.full.v1", "true");
  localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 1.05, pitch: 0.62, zoom: 1.12, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
} catch {} }, TIER === "lite");
const page = await ctx.newPage();
await page.goto(`http://localhost:${PORT}/lab/island?time=day&weather=clear&season=summer&ruins=1&combat=demo&classes=v2&subclass=${KIT}&mastery=20&traits=all&tamed=all`);
await page.waitForFunction(() => !!window.__perf && !!window.__combatDev?.screenOf && !!window.__combat?.rt?.v2, null, { timeout: 240000 });
await page.waitForTimeout(7000);
await page.evaluate(() => {
  const rt = window.__combat.rt;
  window.__combatDev.reset();
  rt.enemies = rt.enemies.filter(e => e.type.kind === "boss");
  Object.assign(rt.v2, { cd: {}, meter: 0, cast: null });
  window.__move.teleport(2, -16, 0);
  const pack = [["shadow-fox", 5], ["thorn-crab", 3], ["mushroom-beast", 3], ["rune-wisp", 3], ["pollen-sprite", 3]];
  let k = 0;
  for (const [type, n] of pack) for (let i = 0; i < n; i++, k++) window.__combatDev.spawn(type, 2 + Math.cos(k) * 3, -10 + Math.sin(k) * 2.5, `ht-${k}`);
  for (const e of rt.enemies) if (e.type.kind !== "boss") e.hp = e.type.hp * 30;
  setInterval(() => { const p = window.__combat.rt.player; p.hp = p.maxHp; p.alive = true; p.energy = 99; window.__combat.rt.v2.cd = {}; }, 150);
});
const aim = await page.evaluate(() => window.__combatDev.screenOf(2, -11.5));
await page.mouse.move(aim.x, aim.y);
await page.waitForTimeout(500);
const cdp = await ctx.newCDPSession(page);
await cdp.send("Profiler.enable"); await cdp.send("Profiler.setSamplingInterval", { interval: 100 });
await cdp.send("Profiler.start");
const pageT0 = await page.evaluate(() => performance.now());
const frames = page.evaluate(() => new Promise(r => { const t = []; let last = performance.now(); const t0 = last; const tick = now => { t.push([now, now - last]); last = now; if (now - t0 < 9000) requestAnimationFrame(tick); else r(t); }; requestAnimationFrame(tick); }));
const keys = ["1", "2", "3", "4", "5"], t0 = Date.now(), ults = [];
let i = 0;
while (Date.now() - t0 < 8700) {
  const t = Date.now() - t0;
  if ((ults.length === 0 && t > 1000) || (ults.length === 1 && t > 5500)) { await page.evaluate(() => { window.__combat.rt.v2.meter = 100; }); await page.keyboard.press("f"); ults.push(await page.evaluate(() => performance.now())); }
  await page.keyboard.press(keys[i++ % keys.length]);
  await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up(); await page.waitForTimeout(160);
}
const list = await frames;
const { profile } = await cdp.send("Profiler.stop");
// Profile time (µs) to page time (ms): its first sample is at about pageT0.
const byId = new Map(profile.nodes.map(n => [n.id, n])), parent = new Map();
for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
let at = profile.startTime;
const samples = profile.samples.map((id, k) => { at += profile.timeDeltas[k]; return [pageT0 + (at - profile.startTime) / 1000, id]; });
const label = n => { const cf = n.callFrame, name = cf.functionName || "(anonymous)"; return name.startsWith("(") ? name : `${name} ${cf.url.split("/").pop().split("?")[0].replace(/_[0-9a-f]{8}\._?\.js|\.js/g, "")}:${cf.lineNumber + 1}`; };
console.log(`${KIT} ${TIER}: ults at ${ults.map(u => Math.round(u - pageT0)).join(", ")} ms; frames over 40 ms:`);
for (const [end, dur] of list) {
  if (dur < 40) continue;
  const self = new Map(), owners = new Map();
  for (const [t, id] of samples) if (t > end - dur && t <= end) {
    const n = byId.get(id), k = label(n);
    self.set(k, (self.get(k) ?? 0) + 0.1);
    // The nearest of our own frames up the stack (components/, lib/): who asked for it.
    for (let p = id; p !== undefined; p = parent.get(p)) { const u = byId.get(p).callFrame.url; if (/components_|lib_|app_/.test(u)) { const o = label(byId.get(p)); owners.set(o, (owners.get(o) ?? 0) + 0.1); break; } }
  }
  const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, ms]) => `${ms.toFixed(1)} ${k}`);
  const who = [...owners].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, ms]) => `${ms.toFixed(1)} ${k}`);
  console.log(`\n${Math.round(end - dur - pageT0)} ms: ${dur.toFixed(1)} ms\n  self: ${top.join("\n        ")}\n  ours: ${who.join("\n        ")}`);
}
await browser.close();
