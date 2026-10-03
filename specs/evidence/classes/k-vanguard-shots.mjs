// Classes v2, the Vanguard wave's in-game evidence (specs/classes/design-sheet.md §4 "Evidence"): each kit's keys and basic
// chain as frame strips at a staged pack (zone-1 mobs; the Thorn Crab's shell for the Guardian and the Assassin), each ult
// beat by beat (the finisher's beats too for the first-last ones), and the HUD with each kit.
//   PORT=3132 node specs/evidence/classes/k-vanguard-shots.mjs [outDir] [only,only2,...]
// only: guardian, juggernaut, monk, assassin (kits), ult, hud. Headed Chromium off to the side (--window-position=2400,0),
// muted, never brought to the front. The combat demo (?combat=demo&classes=v2&subclass=<key>): a level-10 member on the
// kit with the classes_v2 flag on, signed out. The ult's clock is held per beat (window.__classDev.holdUlt).
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/classes", ONLY_LIST] = process.argv.slice(2);
const ONLY = ONLY_LIST ? new Set(ONLY_LIST.split(",")) : null;
const TMP = "/tmp/classes-vanguard-evidence";
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT ?? 3132, W = 1280, H = 1400; // tall: the action sits clear above the HUD panel
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const KITS = {
  guardian: { weapon: "aegis-gilt", foe: "thorn-crab" },
  juggernaut: { weapon: "warhammer-gilt", foe: "shadow-fox" },
  monk: { weapon: "handwraps-gilt", foe: "shadow-fox" },
  assassin: { weapon: "tanto-gilt", foe: "thorn-crab" },
};
let ctx, page;
async function fresh(store = {}) {
  await ctx?.close();
  ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([look, store]) => { try {
    localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.liteMode.v1", "false");
    localStorage.removeItem("tsi.combatKeys.v3"); localStorage.setItem("tsi.hud.full.v1", "true");
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 1.05, pitch: 0.62, zoom: 1.12, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
    for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
  } catch {} }, [LOOK, store]);
  page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|404/.test(m.text())) console.log("console", m.text().slice(0, 300)); });
}
async function open(query) {
  await page.goto(`http://localhost:${PORT}/lab/island?time=day&weather=clear&season=summer&ruins=1&combat=demo&classes=v2&${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(() => !!window.__move?.sim?.current && !!window.__combatDev?.screenOf && !!window.__combat?.rt?.v2 && !document.querySelector('[role="status"]')?.textContent?.includes("Preparing")) ? quiet + 1 : 0; }
  await page.waitForTimeout(3000);
}
const tile = (files, labels, name, cols, geometry) => {
  const args = ["montage"];
  files.forEach((f, i) => args.push("-label", labels[i], f));
  args.push("-tile", `${cols}x`, "-geometry", geometry, "-background", "#0b0e14", "-fill", "#f1ffff", "-font", "/System/Library/Fonts/Monaco.ttf", "-pointsize", "13", "-quality", "70", `${OUT}/${name}.webp`);
  execFileSync("magick", args);
  console.log("wrote", `${OUT}/${name}.webp`);
};
let n = 0;
const shot = async clip => { const file = `${TMP}/${n++}.png`; await page.screenshot({ path: file, ...(clip ? { clip } : {}) }); return file; };
const wanted = name => !ONLY || ONLY.has(name);
/** Screen-up as a world direction (the fixed camera): foes are set ahead of you on screen, the action above the HUD. */
let F = { x: 0, z: 1 };
async function screenUp() {
  F = await page.evaluate(([x, z]) => {
    const s = window.__combatDev.screenOf, o = s(x, z), a = s(x + 1, z), b = s(x, z + 1);
    const ax = a.x - o.x, ay = a.y - o.y, bx = b.x - o.x, by = b.y - o.y, det = ax * by - ay * bx, u = bx / det, v = -ax / det, l = Math.hypot(u, v);
    return { x: u / l, z: v / l };
  }, [ME.x, ME.z]);
}
/** A point `f` u ahead of you on screen and `s` u to its right. */
const at = (f, s = 0) => [ME.x + F.x * f + F.z * s, ME.z + F.z * f - F.x * s];
/** Clear the field, stand at (x, z) with the kit's weapon in hand and full energy, and set foes at points ([ahead, side]). */
async function stage(x, z, local, type, weapon) {
  const foes = local.map(([f, s]) => at(f, s));
  await page.evaluate(([x, z, foes, type, weapon]) => {
    const rt = window.__combat.rt;
    rt.enemies = rt.enemies.filter(e => e.type.kind === "boss").map(e => ({ ...e, state: "idle", x: e.spawnX, z: e.spawnZ }));
    rt.projectiles = []; rt.units = []; rt.floaters = []; rt.blasts = []; rt.banner = null; rt.fx = []; rt.buffs = [];
    if (!rt.player.owned.includes(weapon)) rt.player.owned.push(weapon);
    Object.assign(rt.player, { hp: rt.player.maxHp, alive: true, energy: 100, weapon });
    rt.v2.cd = {}; rt.v2.meter = 0; rt.v2.stock = {}; rt.v2.chain = { i: 0, gap: 99, stacks: 0 };
    window.__move.teleport(x, z, 0);
    foes.forEach(([fx, fz], i) => window.__combatDev.spawn(type, fx, fz, `kv-${type}-${i}-${Math.random().toString(36).slice(2, 6)}`));
    window.__publishCombat();
  }, [x, z, foes, type, weapon]);
  await page.waitForTimeout(700);
  return foes;
}
const hold = () => page.evaluate(() => { for (const e of window.__combat.rt.enemies) { e.status.hold = 99; e.hp = 9999; } });
const aimAt = async (x, z) => { const p = await page.evaluate(([x, z]) => window.__combatDev.screenOf(x, z), [x, z]); await page.mouse.move(p.x, p.y); return p; };
const around = async (x, z, w = 620, h = 400) => { const p = await page.evaluate(([x, z]) => window.__combatDev.screenOf(x, z), [x, z]); return { x: Math.max(0, Math.min(W - w, Math.round(p.x - w / 2))), y: Math.max(0, Math.min(H - h - 340, Math.round(p.y - h * 0.5))), width: w, height: h }; };
const click = async () => { await page.mouse.down(); await page.mouse.up(); };
const ME = { x: 2, z: -16 }, PACK = [[1.6, 0], [2.1, 1.1], [2.1, -1.1]]; // [ahead, side] of you

/** Each kit's keys and its chain: `steps` = [label, act, wait, foes?]. */
async function kit(key, steps) {
  const k = KITS[key];
  await fresh();
  await open(`subclass=${key}&mastery=3`);
  await screenUp();
  const files = [], labels = [];
  for (const [label, act, wait, local = PACK] of steps) {
    const foes = await stage(ME.x, ME.z, local, k.foe, k.weapon);
    await hold();
    await aimAt(foes[0][0], foes[0][1]);
    await act();
    await page.waitForTimeout(wait);
    files.push(await shot(await around(...at(1)))); labels.push(label);
  }
  tile(files, labels, `K-vanguard-${key === "monk" ? "martial-artist" : key}-kit`, 3, "620x400+4+4");
}
const press = k => async () => { await page.keyboard.press(k); };
// Each click once the last swing is done (a press more than 0.15 s early is dropped, so a fixed beat skipped slow weapons' steps).
const chain = n => async () => { for (let i = 0; i < n; i++) { await page.waitForFunction(() => window.__combat.rt.player.attackCd <= 0.05, null, { timeout: 3000 }); await click(); await page.waitForTimeout(60); } };

if (wanted("guardian")) await kit("guardian", [
  ["basic: 3-hit sword combo (the third, the thrust)", chain(3), 60],
  ["1 Block / Parry: held, the shield's shards", async () => { await page.keyboard.down("1"); await page.waitForTimeout(150); }, 0],
  ["1 Parry: a crab's hit inside 0.25 s, negated, the counter-slash", async () => { await page.keyboard.up("1"); await page.evaluate(() => { const v = window.__combat.rt.v2; v.cd = {}; v.holding = v.holding.map(() => null); }); await page.keyboard.down("1"); await page.waitForTimeout(90); await page.evaluate(() => { const e = window.__combat.rt.enemies.find(x => x.type.id === "thorn-crab"); window.__combatDev.hit(14, e.x, e.z); }); }, 110],
  ["2 Challenge: the taunt ring, armour up", press("2"), 220],
  ["3 Shield Rush: shield first through the pack", press("3"), 260],
  ["4 Aegis Dome: the dome stops shots", press("4"), 500],
  ["5 Shield Throw: bouncing to three", press("5"), 420],
]);
if (wanted("juggernaut")) await kit("juggernaut", [
  ["basic: the hammer swing (2% of max HP a hit)", chain(1), 180],
  ["basic: the overhead", chain(2), 120],
  ["1 Charge: a bull rush through the line", press("1"), 260],
  ["2 Ground Slam: cracked ground, everything stunned", press("2"), 140],
  ["3 War Cry: enemies come, temporary health", press("3"), 260],
  ["4 Seismic Drop (from a jump): the quake", async () => { await page.keyboard.down(" "); await page.waitForTimeout(120); await page.keyboard.up(" "); await page.waitForTimeout(200); await page.keyboard.press("4"); }, 300],
]);
if (wanted("monk")) await kit("monk", [
  ["basic chain: jab, cross, hook, body kick", chain(4), 80],
  ["1 Teep after a hook (mid-chain, +40%)", async () => { await chain(2)(); await page.keyboard.press("1"); }, 140],
  ["2 Elbow mid-chain: the slash and the cut", async () => { await chain(1)(); await page.keyboard.press("2"); }, 120],
  ["3 Clinch Knees: held for the whole technique", press("3"), 760],
  ["4 Roundhouse: the shin across the pack", press("4"), 260],
  ["5 Flying Knee (off a dash)", async () => { await page.keyboard.press("q"); await page.waitForTimeout(120); await page.keyboard.press("5"); }, 300],
]);
if (wanted("assassin")) await kit("assassin", [
  ["basic: twin tanto cuts up close", chain(2), 60],
  ["basic past 3.2 u: a thrown kunai", async () => { await aimAt(...at(5)); await click(); }, 160, [[5, 0], [5.5, 1]]],
  ["1 Shadow Step: behind the crab, its shell turned away", press("1"), 260, [[3.5, 0]]],
  ["2 Kunai Blink: thrown, stuck, then blink to its back", async () => { await page.keyboard.press("2"); await page.waitForTimeout(450); await page.keyboard.press("2"); }, 260, [[4, 0]]],
  ["3 Ink Lotus: three red-ink cuts round you", press("3"), 340],
  ["4 Smoke Bomb: the ink veil, the pack loses you", press("4"), 600],
]);

// ── Each ult beat by beat: anticipation, the flash frame, the freeze's lines, slow motion, follow-through (and the finisher's) ──
async function ultStrip(key) {
  const k = KITS[key];
  await fresh({ "tsi.reduceFlashing.v1": "false", "tsi.screenShake.v1": "full" });
  await open(`subclass=${key}&mastery=3`);
  await screenUp();
  const foes = await stage(ME.x, ME.z, [[1.8, 0], [1.3, 1], [1.3, -1], [2.5, 0.8], [2.5, -0.8]], k.foe, k.weapon);
  await hold();
  await aimAt(foes[0][0], foes[0][1]);
  await page.evaluate(() => { window.__combat.rt.v2.meter = 100; });
  await page.waitForTimeout(300);
  await page.keyboard.press("f");
  await page.waitForFunction(() => !!window.__combat.rt.v2.cast, null, { timeout: 3000 });
  await page.evaluate(() => { window.__classDev.holdUlt = true; });
  const { A, span } = await page.evaluate(() => { const u = window.__combat.rt.v2.ult; return { A: u.anticipation_ms / 1000, span: u.impacts === "first-last" ? u.duration ?? 0 : 0 }; });
  const beats = [["anticipation", A * 0.6, 350], ["flash frame", A + 0.01, 40], ["freeze, lines", A + 0.08, 30], ["slow motion, shake", A + 0.25, 80], ["follow-through", A + 0.9, 600]];
  if (span) beats.push(["the window", A + span * 0.5, 500], ["finisher: flash", A + span + 0.01, 40], ["finisher: lines", A + span + 0.1, 40], ["finisher: follow", A + span + 0.8, 600]);
  const files = [], labels = [];
  for (const [label, t, wait] of beats) {
    await page.evaluate(t => { window.__combat.rt.v2.cast.t = t; }, t);
    await page.waitForTimeout(wait);
    files.push(await shot(await around(...at(1.2), 760, 440))); labels.push(`${label} ${Math.round(t * 1000)} ms`);
  }
  await page.evaluate(() => { window.__classDev.holdUlt = false; });
  tile(files, labels, `K-vanguard-ult-${key === "monk" ? "martial-artist" : key}`, 3, "760x440+4+4");
}
if (wanted("ult")) for (const key of Object.keys(KITS)) await ultStrip(key);

// ── The HUD with each kit: the keys with their icons, the ult slot filling, charges, a locked key at mastery 2 ──
if (wanted("hud")) {
  const files = [], labels = [];
  const crop = { x: (W - 760) / 2, y: H - 342, width: 760, height: 340 };
  for (const [key, k] of Object.entries(KITS)) {
    await fresh();
    await open(`subclass=${key}&mastery=2`);
    await page.evaluate(([w]) => { const rt = window.__combat.rt; if (!rt.player.owned.includes(w)) rt.player.owned.push(w); rt.player.weapon = w; rt.v2.meter = 65; rt.v2.progress = { into: 400, needed: 1100 }; window.__publishCombat(); }, [k.weapon]);
    await page.waitForTimeout(600);
    files.push(await shot(crop)); labels.push(`${key === "monk" ? "Martial Artist" : key[0].toUpperCase() + key.slice(1)}: mastery 2 (key at 3 locked), meter 65%`);
  }
  tile(files, labels, "K-vanguard-hud", 2, "760x340+4+4");
}
await ctx?.close();
await browser.close();
