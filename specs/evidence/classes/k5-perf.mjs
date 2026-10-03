// Classes v2, wave 5: performance in the worst case (design sheet §1.7 "Acceptance": 30 FPS minimum on integrated
// graphics in a full pack fight with an ult). For each kit and quality tier: the combat demo in the ruins at mastery 20,
// a full pack of 17 (foxes, crabs, mushrooms, wisps, pollen) hunting you (tanky, you can't fall), the kit's keys pressed
// on a loop, the ult fired a second in, and every frame's time over 8 s (requestAnimationFrame). The machine's load is
// sampled before, during and after each run (load average, swap, top processes by CPU).
//   PORT=3142 node specs/evidence/classes/k5-perf.mjs [kits] [tiers] [outFile]
//   kits: comma list (default: the four candidates per family below); tiers: high,lite (default both).
// Headed Chromium off to the side (--window-position=2400,0), muted, the real GPU (Metal); never brought to the front.
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { appendFileSync, writeFileSync } from "node:fs";
import { loadavg } from "node:os";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [KITS = "illusionist,necromancer,elementalist,marksman,shaman,summoner,assassin,juggernaut", TIERS = "high,lite", OUT = "/tmp/k5-perf.jsonl"] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3142, W = 1280, H = 800, SECONDS = Number(process.env.K5_SECONDS ?? 8);
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
/** High: no lite mode, shadow maps on. Lite: lite mode (no shadow map, no sway, half the combat particles, no FX lights). The pixel finish stays at the members' default. */
const TIER = { high: { "tsi.liteMode.v1": "false", "tsi.shadows.v1": "true" }, lite: { "tsi.liteMode.v1": "true", "tsi.shadows.v1": "false" } };
const ME = { x: 2, z: -16 }, AIM = { x: 2, z: -11.5 };
const PACK = [
  ...Array.from({ length: 5 }, (_, i) => ["shadow-fox", 2 + Math.cos(i * 1.3) * 3.2, -11 + Math.sin(i * 1.3) * 2.2]),
  ...Array.from({ length: 3 }, (_, i) => ["thorn-crab", -0.5 + i * 2.5, -9.2]),
  ...Array.from({ length: 3 }, (_, i) => ["mushroom-beast", -1 + i * 3, -7.6]),
  ...Array.from({ length: 3 }, (_, i) => ["rune-wisp", 0 + i * 2, -6.4]),
  ...Array.from({ length: 3 }, (_, i) => ["pollen-sprite", 1 + i * 1.1, -12.6]),
];
const run = promisify(execFile);
const sh = async (cmd, args) => { try { return (await run(cmd, args, { encoding: "utf8", timeout: 15000 })).stdout; } catch (e) { return String(e.stdout ?? ""); } };
/** The machine now (sampled without blocking the run): load average, swap used, memory, the top processes by CPU (ps's decaying %CPU; names can hold spaces). */
async function load() {
  const [swapOut, psOut, topOut] = await Promise.all([sh("sysctl", ["-n", "vm.swapusage"]), sh("ps", ["-Ao", "pid,pcpu,rss,comm", "-r"]), sh("top", ["-l", "1", "-n", "0"])]);
  const procs = psOut.split("\n").slice(1, 7).map(l => l.trim().match(/^(\d+)\s+([\d.]+)\s+(\d+)\s+(.*)$/)).filter(Boolean)
    .map(([, pid, cpu, rss, comm]) => `${comm.split("/").pop()} (${pid}) ${cpu}% ${Math.round(Number(rss) / 1024)}M`);
  return { load: loadavg().map(v => +v.toFixed(2)), swap: swapOut.match(/used = ([\d.]+M)/)?.[1] ?? "?", mem: (topOut.match(/PhysMem: ([^\n]+)/)?.[1] ?? "").trim(), procs };
}
let ctx, page;
async function fresh(store) {
  await ctx?.close();
  ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([look, store]) => { try {
    localStorage.setItem("tsi.look.v1", look); localStorage.removeItem("tsi.combatKeys.v3"); localStorage.setItem("tsi.hud.full.v1", "true");
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 1.05, pitch: 0.62, zoom: 1.12, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
    for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
  } catch {} }, [LOOK, store]);
  page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
}
async function open(kit) {
  await page.goto(`http://localhost:${PORT}/lab/island?time=day&weather=clear&season=summer&ruins=1&combat=demo&classes=v2&subclass=${kit}&mastery=20&traits=all&tamed=all`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(() => !!window.__move?.sim?.current && !!window.__combatDev?.screenOf && !!window.__combat?.rt?.v2 && !document.querySelector('[role="status"]')?.textContent?.includes("Preparing")) ? quiet + 1 : 0; }
  await page.waitForTimeout(3000); // shaders compiled, the shadow map baked
}
/** The pack round you, tanky and hunting; you can't fall; energy and cooldowns free; the meter empty. */
async function stage() {
  await page.evaluate(([x, z, pack]) => {
    const rt = window.__combat.rt;
    window.__combatDev.reset();
    rt.enemies = rt.enemies.filter(e => e.type.kind === "boss").map(e => ({ ...e, state: "idle", x: e.spawnX, z: e.spawnZ }));
    rt.projectiles = []; rt.units = []; rt.floaters = []; rt.blasts = []; rt.banner = null; rt.fx = []; rt.hazards = [];
    Object.assign(rt.player, { hp: rt.player.maxHp, alive: true, energy: 999 });
    Object.assign(rt.v2, { cd: {}, meter: 0, cast: null });
    window.__move.teleport(x, z, 0);
    pack.forEach(([type, fx, fz], i) => window.__combatDev.spawn(type, fx, fz, `k5-${type}-${i}-${Math.random().toString(36).slice(2, 6)}`));
    for (const e of rt.enemies) if (e.type.kind !== "boss") e.hp = e.type.hp * 30;
    clearInterval(window.__k5god);
    window.__k5god = setInterval(() => { const p = window.__combat.rt.player; p.hp = p.maxHp; p.alive = true; p.energy = Math.max(p.energy, 60); window.__combat.rt.v2.cd = {}; }, 150);
    window.__publishCombat();
  }, [ME.x, ME.z, PACK]);
  const p = await page.evaluate(([x, z]) => window.__combatDev.screenOf(x, z), [AIM.x, AIM.z]);
  await page.mouse.move(p.x, p.y);
  await page.waitForTimeout(600);
}
/** Frame times (ms) over `seconds`, the kit's keys on a loop (and clicks: the basic), the ult a second in. */
/** TWICE=1: the ult a second time at 6 s, to tell a first-use hitch (a shader compiled, a texture uploaded) from one every cast pays. */
const TWICE = !!process.env.TWICE;
async function measure(seconds) {
  // Frame times, and when each frame over 33 ms ended (ms since the sampling started).
  const frames = page.evaluate(s => new Promise(r => { const t = [], long = []; let last = performance.now(); const t0 = last; window.__k5t0 = t0; const tick = now => { t.push(now - last); if (now - last > 33.4) long.push([Math.round(now - t0), Math.round(now - last)]); last = now; if (now - t0 < s * 1000) requestAnimationFrame(tick); else r({ t: t.slice(1), long }); }; requestAnimationFrame(tick); }), seconds);
  const keys = ["1", "2", "3", "4", "5"], ults = [];
  const t0 = Date.now(); let i = 0, ult = 0, mid = null;
  const fire = async () => { await page.evaluate(() => { window.__combat.rt.v2.meter = 100; }); await page.keyboard.press("f"); ults.push(await page.evaluate(() => Math.round(performance.now() - window.__k5t0))); ult++; };
  while (Date.now() - t0 < seconds * 1000 - 300) {
    if (ult === 0 && Date.now() - t0 > 1000) await fire();
    if (TWICE && ult === 1 && Date.now() - t0 > 6000) await fire();
    if (!mid && Date.now() - t0 > seconds * 500) mid = load(); // a promise: the keys keep going
    await page.keyboard.press(keys[i++ % keys.length]);
    await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up();
    await page.waitForTimeout(160);
  }
  const f = await frames;
  return { frames: f.t, long: f.long, ults, mid: await mid };
}
const pct = (s, q) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
/** Agents take /private/tmp/claude-501/uwotsi-heavy.lock around tsc, the full test suite and long batches: measure outside them (wait up to 5 min, then go on and say so). */
async function quiet() {
  const { existsSync, readFileSync } = await import("node:fs"), L = "/private/tmp/claude-501/uwotsi-heavy.lock";
  for (let waited = 0; waited < 300; waited += 5) { if (!existsSync(L)) return { heavy: null, waited }; await new Promise(r => setTimeout(r, 5000)); }
  let owner = "?"; try { owner = readFileSync(`${L}/owner`, "utf8").trim(); } catch {}
  return { heavy: owner, waited: 300 };
}
const results = [];
for (const tier of TIERS.split(",")) for (const kit of KITS.split(",")) {
  try {
    const before = await load();
    await fresh(TIER[tier]); await open(kit); await stage();
    const ultName = await page.evaluate(() => window.__combat.rt.v2.ult.name);
    const calm = await quiet(); if (calm.waited) await stage(); // a long wait: set the pack again
    const { frames, long, ults, mid } = await measure(SECONDS);
    const after = await load(), sorted = [...frames].sort((a, b) => a - b), total = frames.reduce((n, x) => n + x, 0);
    const row = { kit, tier, ult: ultName, fps: +(frames.length / (total / 1000)).toFixed(1), p50: +pct(sorted, 0.5).toFixed(1), p95: +pct(sorted, 0.95).toFixed(1), p99: +pct(sorted, 0.99).toFixed(1),
      worst: +sorted.at(-1).toFixed(1), over33: frames.filter(f => f > 33.4).length, frames: frames.length, low1s: +(1000 / Math.max(...windows(frames, 1000))).toFixed(1), long, ults, before, mid, after, calm, at: new Date().toISOString() };
    results.push(row); appendFileSync(OUT, JSON.stringify(row) + "\n");
    console.log(`${kit} ${tier} (${ultName}): ${row.fps} FPS, p50 ${row.p50} p95 ${row.p95} p99 ${row.p99} worst ${row.worst} ms, ${row.over33} frames over 33 ms; slowest 1 s window ${row.low1s} FPS | F at ${ults.join(", ")} ms, frames over 33 ms ending at ${long.map(([t, d]) => `${t} (${d})`).join(", ") || "none"} | load ${before.load[0]} → ${mid?.load[0]} → ${after.load[0]}, swap ${after.swap}${calm.heavy ? ` | heavy lock held by ${calm.heavy}` : ""}${calm.waited ? ` (waited ${calm.waited} s)` : ""}`);
  } catch (err) { console.log("failed", kit, tier, err.message.slice(0, 200)); }
}
/** Mean frame time of each 1 s window (the slowest stretch, e.g. the ult's freeze and burst). */
function windows(frames, ms) { const out = []; let sum = 0, n = 0; for (const f of frames) { sum += f; n++; if (sum >= ms) { out.push(sum / n); sum = 0; n = 0; } } return out.length ? out : [frames.reduce((a, b) => a + b, 0) / frames.length]; }
await browser.close();
writeFileSync(OUT.replace(/\.jsonl$/, ".done"), JSON.stringify(results.map(r => ({ kit: r.kit, tier: r.tier, fps: r.fps })), null, 1));
