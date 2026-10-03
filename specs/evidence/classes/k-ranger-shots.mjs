// Classes v2, the Ranger wave's evidence (specs/classes/design-sheet.md §4 "Evidence"): each kit's basic attack and keys
// 1–5 as frame strips (anticipation, release, impact, follow-through), each ult beat by beat (Reduce flashing off and
// on), and the HUD with each kit's gauges.
//   PORT=3131 node specs/evidence/classes/k-ranger-shots.mjs [outDir] [only,only2,...]   (only: marksman, sniper, hunter, gunslinger, ult, hud)
// Headed Chromium off to the side (--window-position=2400,0), muted, real GPU; never brought to the front. The combat demo
// (?combat=demo&classes=v2&subclass=<kit>&mastery=3): a level-10 member on the kit with the classes_v2 flag on, signed
// out. Frames are held with the encounter's freeze (window.__combat.freeze: the tick and the FX stop) and the ult's
// clock (window.__classDev.holdUlt), and tiled into WebPs with ImageMagick.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/classes", ONLY_LIST] = process.argv.slice(2);
const ONLY = ONLY_LIST ? new Set(ONLY_LIST.split(",")) : null;
const wanted = name => !ONLY || ONLY.has(name);
const TMP = "/tmp/classes-ranger-evidence";
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT ?? 3131, W = 1280, H = 940;
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
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
const shot = async (clip) => { const file = `${TMP}/${n++}.png`; await page.screenshot({ path: file, ...(clip ? { clip } : {}) }); return file; };
const ME = { x: 2, z: -16 };
/** Clear the field, stand at ME with the kit's weapon, fill energy, reset cooldowns, the cylinder and the meter, and set still foes. */
async function stage(weapon, foes = [], type = "shadow-fox", hp = 9999) {
  await page.evaluate(([x, z, weapon, foes, type, hp]) => {
    const rt = window.__combat.rt, v = rt.v2;
    rt.enemies = rt.enemies.filter(e => e.type.kind === "boss").map(e => ({ ...e, state: "idle", x: e.spawnX, z: e.spawnZ }));
    rt.projectiles = []; rt.units = []; rt.floaters = []; rt.blasts = []; rt.banner = null; rt.fx = []; rt.buffs = [];
    if (!rt.player.owned.includes(weapon)) rt.player.owned.push(weapon);
    Object.assign(rt.player, { hp: rt.player.maxHp, alive: true, energy: 100, weapon });
    v.cd = {}; v.meter = 0; v.cast = null;
    Object.assign(v.live, { focus: 0, since: 99, idle: 99, dropped: true, reload: null, tried: false, bonus: 0, loaded: [], cock: 0, cockEvery: 0, window: 0, streak: 0, dots: [] });
    Object.assign(rt.field, { zones: [], stealth: 0, ambush: 0, ambushFor: 0 }); // the shared zones and stealth (primitives.ts)
    if (v.kit.fire?.ammo) { v.live.ammo = v.kit.fire.ammo.size; v.live.chamber = 0; }
    window.__move.teleport(x, z, 0);
    foes.forEach(([fx, fz], i) => window.__combatDev.spawn(type, fx, fz, `kr-${type}-${i}-${Math.random().toString(36).slice(2, 6)}`));
    window.__publishCombat();
  }, [ME.x, ME.z, weapon, foes, type, hp]);
  await page.waitForTimeout(500);
  await page.evaluate(hp => { for (const e of window.__combat.rt.enemies) { e.status.hold = 99; e.hp = hp; } }, hp);
}
const aimAt = async (x, z) => { const p = await page.evaluate(([x, z]) => window.__combatDev.screenOf(x, z), [x, z]); await page.mouse.move(p.x, p.y); return p; };
const around = async (x, z, w = 620, h = 380) => { const p = await page.evaluate(([x, z]) => window.__combatDev.screenOf(x, z), [x, z]); return { x: Math.max(0, Math.min(W - w, Math.round(p.x - w / 2))), y: Math.max(0, Math.min(H - h - 250, Math.round(p.y - h * 0.5))), width: w, height: h }; };
const freeze = on => page.evaluate(on => { window.__combat.freeze = on; }, on);
/** Run `act`, then hold the encounter at each of `at` (ms after the act) for a frame. */
async function strip(label, act, at, foes, aim = { x: 2, z: -11.5 }, setup) {
  const files = [], labels = [], names = ["anticipation", "release", "impact", "follow-through"];
  await stage(KIT.weapon, foes);
  if (setup) await setup();
  await aimAt(aim.x, aim.z);
  const crop = await around(ME.x, ME.z + 2.4);
  const t0 = Date.now();
  await act();
  for (const [i, ms] of at.entries()) {
    const wait = ms - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await freeze(true);
    files.push(await shot(crop)); labels.push(`${label} · ${names[i] ?? ""} ${ms} ms`);
    await freeze(false);
  }
  return { files, labels };
}
const press = key => async () => { await page.keyboard.press(key); };
const holdKey = (key, ms) => async () => { await page.keyboard.down(key); setTimeout(() => page.keyboard.up(key).catch(() => {}), ms); };
const holdMouse = ms => async () => { await page.mouse.down(); setTimeout(() => page.mouse.up().catch(() => {}), ms); };
const click = async () => { await page.mouse.down(); await page.mouse.up(); };
const LINE = [[2, -12], [2.2, -9.5], [1.8, -7]], GROUP = [[2, -11.5], [3.2, -11], [0.9, -11.2], [2.4, -10.2]], ONE = [[2, -11.5]];
let KIT = null;

// ── A kit's strips: its basic attack and keys 1–5 ──
const KITS = {
  marksman: { weapon: "recurve-1", rows: [
    ["Focus: hold fire (1.5 → 8/s)", holdMouse(4400), [300, 1500, 3000, 4300], GROUP],
    ["1 Homing Arrows (off-line foe)", async () => { await page.keyboard.press("1"); await page.waitForTimeout(150); await page.mouse.down(); setTimeout(() => page.mouse.up().catch(() => {}), 1800); }, [120, 600, 1000, 1700], [[4.5, -11]], { x: 2, z: -11 }],
    ["2 Flame Arrows: burning ground", async () => { await page.keyboard.press("2"); await page.waitForTimeout(150); await page.mouse.down(); setTimeout(() => page.mouse.up().catch(() => {}), 1600); }, [120, 700, 1300, 2600], ONE],
    ["3 Swift Arrows: flat, pierce one", async () => { await page.keyboard.press("3"); await page.waitForTimeout(150); await page.mouse.down(); setTimeout(() => page.mouse.up().catch(() => {}), 1500); }, [120, 400, 800, 1400], LINE],
    ["4 Back Hop, firing", async () => { await page.mouse.down(); await page.waitForTimeout(600); await page.keyboard.press("4"); setTimeout(() => page.mouse.up().catch(() => {}), 1200); }, [650, 800, 1050, 1400], ONE],
  ] },
  sniper: { weapon: "rifle-1", rows: [
    ["basic: heavy shot, head crits", click, [40, 90, 200, 600], ONE],
    ["1 Scope (held): zoom, steadier", async () => { await page.keyboard.down("1"); setTimeout(async () => { await click(); }, 500); setTimeout(() => page.keyboard.up("1").catch(() => {}), 1300); }, [120, 450, 650, 1200], ONE],
    ["2 Piercing Round: the whole line", press("2"), [60, 120, 260, 650], LINE],
    ["3 Cluster Round: four bomblets", press("3"), [60, 260, 480, 950], GROUP],
    ["4 Smoke Roll", press("4"), [60, 220, 480, 900], [[2, -14.2]], { x: 2, z: -14 }],
    ["5 Tripwire: the mine blasts", press("5"), [60, 140, 320, 750], GROUP, { x: 2, z: -11.3 }],
  ] },
  hunter: { weapon: "harpoon-1", rows: [
    ["basic: harpoon bolt", click, [40, 150, 300, 600], ONE],
    ["1 Camouflage: unseen, first shot +60%", async () => { await page.keyboard.press("1"); setTimeout(() => click().catch(() => {}), 900); }, [120, 600, 1050, 1300], ONE],
    ["2 Snare Trap: roots 2 s", press("2"), [60, 160, 420, 900], ONE],
    ["3 Spike Trap: burst, bleed", press("3"), [60, 160, 420, 900], GROUP],
    ["4 Mark Prey: seen through walls", press("4"), [60, 220, 520, 950], ONE],
    ["5 Harpoon: dragged in", press("5"), [60, 250, 450, 800], [[2, -8]], { x: 2, z: -8 }],
  ] },
  gunslinger: { weapon: "sixgun-1", rows: [
    ["basic: six rounds, the 6th crits, reload", holdMouse(2600), [60, 900, 1700, 2400], ONE],
    ["1 Fan the Hammer", press("1"), [40, 110, 280, 700], GROUP],
    ["2 Trick Shot: ricochets", press("2"), [50, 200, 400, 800], [[2, -12], [4.5, -11], [6.5, -12.5], [8.5, -11.5]]],
    ["3 Special Rounds: explosive", async () => { await page.keyboard.press("3"); await page.waitForTimeout(250); await click(); }, [120, 330, 520, 900], GROUP],
    ["4 Roll Reload", press("4"), [50, 200, 400, 800], ONE],
    ["5 Quickdraw (after a reload)", press("5"), [40, 110, 260, 600], ONE, undefined,
      async () => { await page.evaluate(() => { const l = window.__combat.rt.v2.live; l.ammo = 6; l.reload = null; l.sinceReload = 0.2; }); }],
  ] },
};
for (const [key, kit] of Object.entries(KITS)) {
  if (!wanted(key)) continue;
  KIT = kit;
  await fresh();
  await open(`subclass=${key}&mastery=3`);
  const files = [], labels = [];
  for (const [label, act, at, foes, aim, setup] of kit.rows) {
    const s = await strip(label, act, at, foes, aim, setup);
    files.push(...s.files); labels.push(...s.labels);
  }
  tile(files, labels, `K-ranger-${key}-kit`, 4, "620x380+4+4");
}

// ── Each ult beat by beat (§1.6): Reduce flashing off and on ──
async function ultStrip(key, reduce) {
  KIT = KITS[key];
  await fresh(reduce ? { "tsi.reduceFlashing.v1": "true" } : { "tsi.reduceFlashing.v1": "false", "tsi.screenShake.v1": "full" });
  await open(`subclass=${key}&mastery=3`);
  const foes = key === "hunter" ? [[2, -11.5], [3.4, -10.8], [0.8, -11]] : GROUP;
  await stage(KIT.weapon, foes);
  if (key === "hunter") { // three traps out round the pack (clear of it, so they wait), then the hunt springs them all
    for (const [x, z, k] of [[-1, -13, "2"], [2, -8.4, "3"], [5, -13, "2"]]) { await aimAt(x, z); await page.evaluate(() => { window.__combat.rt.v2.cd = {}; window.__combat.rt.player.energy = 100; }); await page.keyboard.press(k); await page.waitForTimeout(250); }
  }
  await aimAt(2, -11.2);
  const crop = await around(ME.x, ME.z + 2.5, 900, 500);
  await page.evaluate(() => { window.__combat.rt.v2.meter = 100; window.__publishCombat(); });
  await page.waitForTimeout(250);
  const files = [await shot(crop)], labels = ["ready (edge glow)"];
  await page.keyboard.press("f");
  await page.waitForFunction(() => !!window.__combat.rt.v2.cast, null, { timeout: 3000 });
  await page.evaluate(() => { window.__classDev.holdUlt = true; });
  const A = await page.evaluate(() => window.__combat.rt.v2.ult.anticipation_ms / 1000);
  let shift = 0;
  if (key === "gunslinger") { // the spin, then the warhead wherever it lands: the sequence plays from there
    await page.evaluate(t => { window.__combat.rt.v2.cast.t = t; }, A * 0.7);
    await page.waitForTimeout(300);
    files.push(await shot(crop)); labels.push(`the spin ${Math.round(A * 700)} ms`);
    await page.evaluate(() => { window.__classDev.holdUlt = false; });
    await page.waitForFunction(() => window.__combat.rt.v2.live.cockEvery > 0, null, { timeout: 3000 });
    await page.evaluate(() => { const l = window.__combat.rt.v2.live; l.loaded = ["warhead", "gold", "gold", "gold", "gold", "gold"]; l.cock = 0; });
    await click();
    await page.waitForFunction(() => window.__combat.rt.v2.cast?.shift !== undefined, null, { timeout: 4000 });
    shift = await page.evaluate(() => { window.__classDev.holdUlt = true; return window.__combat.rt.v2.cast.shift; });
  }
  const beats = [["anticipation", A * 0.7, 350], ["flash frame (A)", A + 0.01, 40], ["speed lines, freeze", A + 0.08, 30], ["slow motion, shake", A + 0.25, 60], ["lines fade", A + 0.32, 60], ["follow-through", A + 1.1, 700]];
  for (const [label, t, wait] of key === "gunslinger" ? beats.slice(1) : beats) {
    await page.evaluate(t => { window.__combat.rt.v2.cast.t = t; }, t + shift);
    await page.waitForTimeout(wait);
    files.push(await shot(crop)); labels.push(`${key === "gunslinger" ? "warhead · " : ""}${label} ${Math.round(t * 1000)} ms`);
  }
  if (key === "marksman") { // Thousand Arrows: 20 arrows a second for 6 s, then the falling volley with the sequence again
    await page.evaluate(() => { window.__classDev.holdUlt = false; });
    await page.waitForTimeout(2200);
    await page.evaluate(() => { window.__classDev.holdUlt = true; });
    files.push(await shot(crop)); labels.push("the surge: 20 arrows a second");
    const span = 6;
    for (const [label, t, wait] of beats) {
      await page.evaluate(t => { window.__combat.rt.v2.cast.t = t; }, t + span);
      await page.waitForTimeout(wait + 40);
      files.push(await shot(crop)); labels.push(`volley · ${label} ${Math.round((t + span) * 1000)} ms`);
    }
  }
  await page.evaluate(() => { window.__classDev.holdUlt = false; });
  return { files, labels };
}
if (wanted("ult")) for (const key of Object.keys(KITS)) {
  const off = await ultStrip(key, false), on = await ultStrip(key, true);
  tile([...off.files, ...on.files], [...off.labels, ...on.labels.map(l => `Reduce flashing · ${l}`)], `K-ranger-${key}-ult`, 7, "450x250+4+4");
}

// ── The HUD with each kit: Focus ramped, the cylinder mid-reload (the gold span), the Killstreak, the traps ──
if (wanted("hud")) {
  const files = [], labels = [];
  for (const [key, label, setup] of [
    ["marksman", "Marksman: Focus at 6.8/s, Swift on", l => { l.focus = 0.8; l.since = 0; l.idle = 0; }],
    ["sniper", "Sniper: Killstreak 3, Scope held", l => { l.streak = 3; l.streakT = 6; }],
    ["hunter", "Hunter: traps 2/3, unseen", null],
    ["gunslinger", "Gunslinger: reloading, the gold span on the bar", l => { l.ammo = 0; l.reload = 0.5; l.reloadLen = 1.2; }],
    ["gunslinger", "Gunslinger: Russian Roulette, hammer cocked", l => { l.ammo = 4; l.chamber = 2; l.loaded = ["gold", "warhead", "gold", "gold"]; l.cockEvery = 0.6; l.cock = 0; l.window = 6.4; }],
  ]) {
    KIT = KITS[key];
    await fresh();
    await open(`subclass=${key}&mastery=3`);
    await stage(KIT.weapon, ONE);
    await aimAt(2, -11.5);
    if (key === "marksman") { await page.keyboard.press("3"); }
    if (key === "sniper") { await page.keyboard.down("1"); }
    if (key === "hunter") { await aimAt(0, -12); await page.keyboard.press("2"); await page.waitForTimeout(200); await aimAt(4, -12); await page.evaluate(() => { window.__combat.rt.v2.cd = {}; }); await page.keyboard.press("2"); await page.waitForTimeout(200); await page.keyboard.press("1"); }
    await page.waitForTimeout(400);
    await page.evaluate(src => { const v = window.__combat.rt.v2; if (src) (0, eval)(`(${src})`)(v.live); v.meter = 64; v.progress = { into: 700, needed: 1400 }; window.__publishCombat(); }, setup ? setup.toString() : null);
    await page.waitForTimeout(350);
    const box = await page.locator('section[aria-label="Combat status"]').boundingBox();
    files.push(await shot({ x: Math.max(0, box.x - 6), y: Math.max(0, box.y - 6), width: Math.min(W, box.width + 12), height: Math.min(H - box.y + 6, box.height + 12) })); labels.push(label);
    if (key === "sniper") await page.keyboard.up("1");
  }
  tile(files, labels, "K-ranger-hud", 1, "+4+4");
}
await ctx?.close();
await browser.close();
