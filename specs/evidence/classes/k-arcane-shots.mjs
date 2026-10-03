// Classes v2, the Arcane wave's evidence (specs/classes/design-sheet.md §4 "Evidence per wave"): each kit's abilities
// as frame strips, each ult beat by beat (Reduce flashing off and on), the HUD per kit with the Cataclysm mash, FPS with
// the clones, the army and the Joker's mirror out, and the auras with nameplates in the village.
//   PORT=3133 node specs/evidence/classes/k-arcane-shots.mjs [outDir] [only,only2,...]
// Headed Chromium off to the side (--window-position=2400,0), muted, real GPU; never brought to the front. The combat demo
// (?combat=demo&classes=v2&subclass=<kit>): a level-10 member with the classes_v2 flag on, signed out. The ult's clock is
// held per beat (window.__classDev.holdUlt, window.__combat.freeze) and frames tiled into WebPs with ImageMagick.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/classes", ONLY_LIST] = process.argv.slice(2);
const ONLY = ONLY_LIST ? new Set(ONLY_LIST.split(",")) : null;
const TMP = "/tmp/classes-arcane-evidence";
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT ?? 3133, W = 1280, H = 940;
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const WEAPON = { elementalist: "prism-staff-3", illusionist: "trick-deck-3", necromancer: "bone-tome-3", transmuter: "tooth-charm-3" };
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
async function open(kit, query = "", ruins = true) {
  await page.goto(`http://localhost:${PORT}/lab/island?time=day&weather=clear&season=summer${ruins ? "&ruins=1" : ""}&combat=demo&classes=v2&subclass=${kit}&${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(r => !!window.__move?.sim?.current && (!r || (!!window.__combatDev?.screenOf && !!window.__combat?.rt?.v2)) && !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), ruins) ? quiet + 1 : 0; }
  await page.waitForTimeout(2500);
}
const tile = (files, labels, name, cols, geometry) => {
  const args = ["montage"];
  files.forEach((f, i) => args.push("-label", labels[i], f));
  args.push("-tile", `${cols}x`, "-geometry", geometry, "-background", "#0b0e14", "-fill", "#f1ffff", "-font", "/System/Library/Fonts/Monaco.ttf", "-pointsize", "13", "-quality", "72", `${OUT}/${name}.webp`);
  execFileSync("magick", args);
  console.log("wrote", `${OUT}/${name}.webp`);
};
let n = 0;
const shot = async (clip) => { const file = `${TMP}/${n++}.png`; await page.screenshot({ path: file, ...(clip ? { clip } : {}) }); return file; };
const wanted = name => !ONLY || ONLY.has(name);
/** Clear the field, stand at (x, z) with the kit's weapon, full energy and health, and set held foes round the aim. */
async function stage(kit, x, z, foes = [], type = "shadow-fox", hold = true) {
  await page.evaluate(([x, z, foes, type, weapon, hold]) => {
    const rt = window.__combat.rt;
    rt.enemies = rt.enemies.filter(e => e.type.kind === "boss").map(e => ({ ...e, state: "idle", x: e.spawnX, z: e.spawnZ }));
    rt.projectiles = []; rt.units = []; rt.floaters = []; rt.blasts = []; rt.banner = null; rt.fx = []; rt.hazards = [];
    Object.assign(rt.field, { zones: [], walls: [], sweeps: [], timers: [], marks: {}, counter: null, stealth: 0, surf: null, order: { mode: "free", target: null } });
    if (!rt.player.owned.includes(weapon)) rt.player.owned.push(weapon);
    Object.assign(rt.player, { hp: rt.player.maxHp, alive: true, energy: 999, weapon });
    Object.assign(rt.v2, { cd: {}, meter: 0, cast: null, channel: null, form: null });
    window.__move.teleport(x, z, 0);
    foes.forEach(([fx, fz], i) => window.__combatDev.spawn(type, fx, fz, `ka-${type}-${i}-${Math.random().toString(36).slice(2, 6)}`));
    if (hold) for (const e of rt.enemies) if (e.type.kind !== "boss") { e.status.hold = 99; e.hp = e.type.hp * 20; }
    window.__publishCombat();
  }, [x, z, foes, type, WEAPON[kit], hold]);
  await page.waitForTimeout(500);
}
const aimAt = async (x, z) => { const p = await page.evaluate(([x, z]) => window.__combatDev.screenOf(x, z), [x, z]); await page.mouse.move(p.x, p.y); return p; };
const around = async (x, z, w = 760, h = 470) => { const p = await page.evaluate(([x, z]) => window.__combatDev.screenOf(x, z), [x, z]); return { x: Math.max(0, Math.min(W - w, Math.round(p.x - w / 2))), y: Math.max(0, Math.min(H - h - 250, Math.round(p.y - h * 0.5))), width: w, height: h }; };
const keys = async (...ks) => { for (const k of ks) { await page.keyboard.down(k); await page.waitForTimeout(40); } for (const k of ks) await page.keyboard.up(k); };
const ME = { x: 2, z: -16 }, AIM = { x: 2, z: -11.5 }, PACK = [[2, -11], [3.2, -12], [0.8, -12.2], [2.8, -10.2], [1.2, -10.4]];

/** An ability's moments: fire it with `act`, then capture at each delay (ms after the act). */
async function strip(kit, label, act, delays, foes = PACK, type = "shadow-fox", opts = {}) {
  await stage(kit, opts.me?.x ?? ME.x, opts.me?.z ?? ME.z, foes, type, opts.hold ?? true);
  if (opts.before) await opts.before();
  await aimAt(opts.aim?.x ?? AIM.x, opts.aim?.z ?? AIM.z);
  await act();
  const files = [], labels = [];
  let t = 0;
  for (const [d, what] of delays) { await page.waitForTimeout(Math.max(0, d - t)); t = d; files.push(await shot(await around(opts.focus?.x ?? ME.x, opts.focus?.z ?? ME.z + 2.4, 520, 330))); labels.push(`${label} · ${what} ${d} ms`); }
  return { files, labels };
}
async function kitSheet(kit, name, entries, mastery = 9) {
  await fresh();
  await open(kit, `mastery=${mastery}`);
  const files = [], labels = [];
  for (const e of entries) { const r = await strip(kit, ...e); files.push(...r.files); labels.push(...r.labels); }
  tile(files, labels, name, 4, "520x330+3+3");
}
const BEATS = [[60, "anticipation"], [220, "release"], [420, "impact"], [800, "follow-through"]];

if (wanted("elementalist")) await kitSheet("elementalist", "K-arcane-elementalist", [
  ["1 Fireball", () => keys("1"), [[450, "flight"], [650, "burst at the aim"], [900, "burning ground"], [1500, "embers"]]],
  ["2 Tidal Wave", () => keys("2"), [[480, "the wave rolls out"], [620, "shove"], [800, "soaked"], [1100, "spray settles"]]],
  ["3 Stone Javelin (heavy)", () => keys("3"), [[450, "heave"], [620, "flight"], [760, "impact: lines, ring"], [1100, "debris"]]],
  ["4 Gale Step", () => keys("4"), [[420, "burst"], [520, "launched"], [700, "carried"], [1000, "landing"]], [[2, -14.5], [3.5, -15]]],
  ["1+2 Steam Veil", () => keys("1", "2"), [[200, "steam rises"], [700, "veil"], [1500, "enemies inside miss"], [2600, "still on you"]], [[2, -14.8], [3.2, -15.5]]],
  ["1+4 Fire Tornado", () => keys("1", "4"), [[200, "forms at the aim"], [700, "wanders in"], [1500, "dragging"], [2500, "burning"]]],
  ["1+3 Molten Pillars", () => keys("1", "3"), [[180, "eruption"], [400, "pillars"], [900, "lava left"], [2000, "lava"]]],
  ["2+3 Spring Grove", () => keys("2", "3"), [[200, "rune"], [600, "flowers"], [1600, "healing pulse"], [3000, "still blooming"]], [[2, -9]]],
  ["2+4 Riptide (tap)", () => keys("2", "4"), [[150, "the whip"], [300, "pulled"], [500, "at your feet"], [900, "slowed"]], [[2, -9], [4, -8]]],
  ["3+4 Rampart", () => keys("3", "4"), [[150, "bursts up"], [350, "the ramp"], [900, "standing"], [3000, "holding"]], [[2, -8]]],
]);
if (wanted("illusionist")) await kitSheet("illusionist", "K-arcane-illusionist", [
  ["1 Mirror Clone", () => keys("1"), [[300, "cards burst"], [700, "the double"], [1500, "strafing, throwing"], [2600, "a dash"]], PACK, "shadow-fox", { hold: false }],
  ["2 Swap", async () => { await keys("1"); await page.waitForTimeout(1300); await keys("2"); }, [[1450, "shards"], [1600, "traded places"], [1800, "momentum kept"], [2200, "settled"]], [[2, -9]]],
  ["3 Mirror Ward", async () => { await keys("3"); await page.evaluate(() => { const rt = window.__combat.rt, me = window.__move.sim.current.state; rt.projectiles.push({ id: rt.seq++, x: me.x, z: me.z + 3, vx: 0, vz: -11, life: 1, from: "enemy", damage: 12, kind: "rune", radius: 0.3 }); }); }, [[120, "the mirror"], [300, "reflected"], [500, "back to its shooter"], [800, "hit"]], [[2, -9]]],
  ["4 Trick Card", async () => { await keys("4"); await page.waitForTimeout(450); await keys("4"); }, [[200, "the card"], [430, "in flight"], [600, "teleported to it"], [900, "after"]], [[2, -9]]],
  ["5 Vanish", () => keys("5"), [[250, "cards thrown up"], [600, "gone"], [1500, "a shimmer only"], [2600, "still unseen"]], [[2, -8]]],
], 9);
if (wanted("necromancer")) await kitSheet("necromancer", "K-arcane-necromancer", [
  ["1 Raise Dead", async () => { await page.evaluate(() => { const rt = window.__combat.rt; for (const e of rt.enemies) if (e.id.startsWith("ka-")) { e.state = "dead"; e.hp = 0; e.deadFor = 1; } }); await keys("1"); }, [[150, "graves crack"], [500, "they claw up"], [1200, "skeletons"], [2400, "their guard"]]],
  ["2 Command", async () => { await page.evaluate(() => { const rt = window.__combat.rt; for (const e of rt.enemies.slice(0, 3)) if (e.id.startsWith("ka-")) { e.state = "dead"; e.hp = 0; e.deadFor = 1; } }); await keys("1"); await page.waitForTimeout(900); await keys("2"); }, [[1000, "charge!"], [1500, "marching on it"], [2200, "swarming"], [3000, "on it"]]],
  ["3 Corpse Explosion", async () => { await page.evaluate(() => { const rt = window.__combat.rt; for (const e of rt.enemies.slice(0, 3)) if (e.id.startsWith("ka-")) { e.state = "dead"; e.hp = 0; e.deadFor = 1; } }); await keys("3"); }, [[80, "the corpse bursts"], [250, "the chain"], [500, "bone"], [900, "after"]]],
  ["4 Dark Pact", async () => { await page.evaluate(() => { const rt = window.__combat.rt; rt.player.hp = rt.player.maxHp * 0.5; const e = rt.enemies.find(x => x.id.startsWith("ka-")); e.state = "dead"; e.hp = 0; e.deadFor = 1; }); await keys("1"); await page.waitForTimeout(900); await keys("4"); }, [[1000, "consumed"], [1150, "drained"], [1400, "bone shield"], [1900, "after"]]],
  ["5 Bone Surf", async () => { await page.keyboard.down("w"); await page.keyboard.down("Shift"); await page.waitForTimeout(650); await page.keyboard.down("c"); await page.waitForTimeout(90); await keys("5"); }, [[900, "hands rise"], [1100, "surfing"], [1400, "ploughing"], [1700, "carried"]], [[2, -12], [1.5, -10]], "shadow-fox", { aim: { x: 2, z: -4 } }],
], 9);
await page?.keyboard.up("w").catch(() => {}); await page?.keyboard.up("Shift").catch(() => {}); await page?.keyboard.up("c").catch(() => {});
if (wanted("transmuter")) await kitSheet("transmuter", "K-arcane-transmuter", [
  ["1 Fox Form: Lunge", () => keys("1"), [[120, "the shift"], [300, "lunge"], [600, "the fox"], [1100, "bite combo"]]],
  ["2 Crab Form: Block", async () => { await page.waitForTimeout(3200); await keys("2"); }, [[3300, "shell up"], [3500, "the crab"], [3900, "blocking"], [4600, "pinch"]]],
  ["3 Wisp Form: Blink", async () => { await page.waitForTimeout(3200); await keys("3"); }, [[3300, "blink"], [3500, "hover"], [3900, "the wisp"], [4600, "rune bolts"]]],
  ["4 Pollen Form: Swarm", async () => { await page.waitForTimeout(3200); await keys("4"); }, [[3300, "burst"], [3500, "flit"], [3900, "the swarm"], [4600, "sting"]]],
  ["5 Golem Form: Slam", async () => { await page.waitForTimeout(3200); await keys("5"); }, [[3300, "slam"], [3500, "shockwave"], [3900, "the golem"], [4600, "after"]]],
], 9);

// ── The ults, beat by beat (§1.6): anticipation, the flash frame, the lines and freeze, slow motion, follow-through ──
async function ultStrip(kit, reduce) {
  await fresh(reduce ? { "tsi.reduceFlashing.v1": "true" } : { "tsi.reduceFlashing.v1": "false", "tsi.screenShake.v1": "full" });
  await open(kit, "mastery=12");
  await stage(kit, ME.x, ME.z, PACK, kit === "necromancer" ? "thorn-crab" : "shadow-fox");
  await aimAt(AIM.x, AIM.z);
  const crop = async () => shot(await around(ME.x, ME.z + 3, 900, 500));
  const files = [], labels = [];
  await page.evaluate(() => { window.__combat.rt.v2.meter = 100; window.__publishCombat(); });
  await page.waitForTimeout(250);
  files.push(await crop()); labels.push(`${kit} ult ready`);
  if (kit === "elementalist") { // the charge: the storm gathering, the mash
    await page.keyboard.press("f");
    await page.waitForFunction(() => !!window.__combat.rt.v2.channel, null, { timeout: 3000 });
    for (let i = 0; i < 5; i++) { const note = await page.evaluate(() => window.__combat.rt.v2.channel?.notes[window.__combat.rt.v2.channel.at]); if (note !== undefined) await page.keyboard.press(String(note + 1)); await page.waitForTimeout(160); }
    await page.waitForTimeout(500);
    files.push(await shot()); labels.push("charge: storm clouds, the glowing area, the mash");
    for (let i = 0; i < 12; i++) { const note = await page.evaluate(() => window.__combat.rt.v2.channel?.notes[window.__combat.rt.v2.channel.at]); if (note === undefined) break; await page.keyboard.press(String(note + 1)); await page.waitForTimeout(120); }
  } else await page.keyboard.press("f");
  await page.waitForFunction(() => !!window.__combat.rt.v2.cast, null, { timeout: 8000 });
  await page.evaluate(() => { window.__classDev.holdUlt = true; });
  const { A, span, last } = await page.evaluate(() => { const u = window.__combat.rt.v2.ult; return { A: u.anticipation_ms / 1000, span: u.impacts !== "first" ? u.duration ?? 0 : 0, last: u.impacts === "last" }; });
  const at = async (label, t, wait, freeze = true) => {
    await page.evaluate(([t, f]) => { window.__combat.rt.v2.cast.t = t; window.__combat.freeze = f; }, [t, freeze]);
    await page.waitForTimeout(wait);
    files.push(await crop()); labels.push(`${label} ${Math.round(t * 1000)} ms`);
  };
  await at("anticipation", A * 0.7, 300, false);
  if (last) { // the long middle (the mirror sweeping, the army marching, the Chimera fighting) in real time, then the finisher's beats
    await page.evaluate(([A]) => { window.__combat.rt.v2.cast.t = A + 0.02; window.__combat.freeze = false; window.__classDev.holdUlt = false; }, [A]);
    await page.waitForTimeout(Math.min(span * 450, 2500));
    await page.evaluate(() => { window.__classDev.holdUlt = true; window.__combat.freeze = true; });
    await page.waitForTimeout(80);
    files.push(await crop()); labels.push(kit === "illusionist" ? "the mirror sweeps: an inverted path, enemies pressed into the glass" : kit === "necromancer" ? "the dead march on the pack" : "the Chimera");
    await page.evaluate(() => { window.__combat.freeze = false; });
  }
  const B = A + span;
  for (const [label, dt, wait] of [["flash frame", 0.01, 40], ["speed lines, freeze", 0.08, 30], ["slow motion, shake", 0.25, 60], ["lines fade", 0.32, 60], ["follow-through", 1.1, 700]]) await at(label, B + dt, wait, false);
  await page.evaluate(() => { window.__classDev.holdUlt = false; window.__combat.freeze = false; });
  return { files, labels };
}
if (wanted("ults")) for (const kit of ["elementalist", "illusionist", "necromancer", "transmuter"]) {
  const off = await ultStrip(kit, false), on = await ultStrip(kit, true);
  tile([...off.files, ...on.files], [...off.labels, ...on.labels.map(l => `Reduce flashing · ${l}`)], `K-arcane-ult-${kit}`, 4, "450x250+3+3");
}

// ── The HUD per kit: keys with icons, the class line, the ult slot; the Cataclysm mash ──
if (wanted("hud")) {
  const files = [], labels = [];
  const crop = { x: (W - 760) / 2, y: H - 262, width: 760, height: 260 };
  for (const [kit, m, label] of [["elementalist", 9, "Elementalist: four elements, the combos, mana"], ["illusionist", 12, "Illusionist: clones out"], ["necromancer", 12, "Necromancer: skeletons and the order"], ["transmuter", 12, "Transmuter: a form taken (one form locked)"]]) {
    await fresh();
    await open(kit, `mastery=${m}`);
    await stage(kit, ME.x, ME.z, PACK);
    if (kit === "illusionist") await keys("1");
    if (kit === "necromancer") { await page.evaluate(() => { for (const e of window.__combat.rt.enemies.slice(0, 3)) if (e.id.startsWith("ka-")) { e.state = "dead"; e.hp = 0; e.deadFor = 1; } }); await keys("1"); }
    if (kit === "transmuter") { await page.evaluate(() => { const v = window.__combat.rt.v2; v.traits = { "crab-shell": 1, "wisp-core": 1, "pollen-swarm": 1 }; }); await keys("2"); }
    await page.evaluate(() => { const v = window.__combat.rt.v2; v.meter = 72; v.progress = { into: 600, needed: 3800 }; window.__publishCombat(); });
    await page.waitForTimeout(600);
    files.push(await shot(crop)); labels.push(label);
  }
  await fresh(); await open("elementalist", "mastery=3"); await stage("elementalist", ME.x, ME.z, PACK);
  await page.evaluate(() => { window.__combat.rt.v2.meter = 100; window.__publishCombat(); });
  await page.keyboard.press("f");
  await page.waitForFunction(() => !!window.__combat.rt.v2.channel, null, { timeout: 3000 });
  for (let i = 0; i < 3; i++) { const note = await page.evaluate(() => window.__combat.rt.v2.channel.notes[window.__combat.rt.v2.channel.at]); await page.keyboard.press(String(note + 1)); await page.waitForTimeout(150); }
  await page.waitForTimeout(200);
  const b = await page.locator('[data-testid="cataclysm-mash"]').boundingBox();
  files.push(await shot({ x: Math.max(0, b.x - 40), y: Math.max(0, b.y - 20), width: Math.min(W, b.width + 80), height: b.height + 40 })); labels.push("the Cataclysm mash: three notes, the front one big");
  tile(files, labels, "K-arcane-hud", 2, "+4+4");
}

// ── FPS: the busiest Arcane scenes (clones, the army, the mirror), sampled over 3 s ──
if (wanted("fps")) {
  const rows = [], files = [], labels = [];
  const sample = async () => page.evaluate(() => new Promise(r => { let f = 0; const t0 = performance.now(); const tick = () => { f++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else r(f / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(tick); }));
  const pack = Array.from({ length: 12 }, (_, i) => [2 + Math.cos(i) * 3, -10 + Math.sin(i) * 2.5]);
  for (const [kit, label, setup] of [
    ["illusionist", "baseline: a 12-enemy pack", async () => {}],
    ["illusionist", "four clones fighting (mastery 20)", async () => { for (let i = 0; i < 4; i++) { await page.evaluate(() => { window.__combat.rt.v2.cd = {}; }); await keys("1"); await page.waitForTimeout(250); } await page.waitForTimeout(1500); }],
    ["necromancer", "Army of the Dead: 30+ skeletons", async () => { await page.evaluate(() => { window.__combat.rt.v2.meter = 100; }); await page.keyboard.press("f"); await page.waitForTimeout(1400); }],
    ["illusionist", "The Joker's mirror sweeping the pack", async () => { await page.evaluate(() => { window.__combat.rt.v2.meter = 100; }); await page.keyboard.press("f"); await page.waitForTimeout(800); }],
  ]) {
    await fresh(); await open(kit, "mastery=20");
    await stage(kit, ME.x, ME.z, pack, "shadow-fox");
    await aimAt(AIM.x, AIM.z);
    await setup();
    const fps = await sample();
    files.push(await shot(await around(ME.x, ME.z + 3, 900, 500))); labels.push(`${label}: ${fps.toFixed(0)} FPS`);
    rows.push(`| ${label} | ${fps.toFixed(0)} |`);
  }
  tile(files, labels, "K-arcane-fps", 2, "450x250+3+3");
  writeFileSync(`${OUT}/K-arcane-fps.md`, ["# Classes v2, the Arcane wave: FPS in its busiest scenes", "", "Measured by `k-arcane-shots.mjs fps` (headed Chromium, Apple M4 Mac mini, 1280×940, High graphics with shadows, the ruins, a 12-enemy pack; frames counted over 3 s). Screens: K-arcane-fps.webp.", "", "| Scene | FPS |", "|---|---|", ...rows, ""].join("\n"));
}

// ── The auras and nameplates in the village (mastery 20: the second motes, the ring, the gold frame) ──
if (wanted("aura")) {
  await fresh({ "tsi.hud.full.v1": "false" });
  const files = [], labels = [];
  for (const kit of ["elementalist", "illusionist", "necromancer", "transmuter"]) {
    await open(kit, "mastery=20&frame=gold", false);
    await page.waitForSelector('[data-testid="nameplate-class"]', { timeout: 30000 });
    await page.waitForTimeout(1500);
    const p = await page.evaluate(() => window.__move.screen());
    files.push(await shot({ x: Math.max(0, Math.round(p.x - 210)), y: Math.max(0, Math.round(p.y - 300)), width: 420, height: 400 })); labels.push(`${kit}: aura, Master title, gold frame, weapon on the back`);
  }
  tile(files, labels, "K-arcane-aura-nameplate", 4, "420x400+4+4");
}
await ctx?.close();
await browser.close();
