// Classes v2, the Warden wave's evidence (specs/classes/design-sheet.md §4 "Evidence per wave"): each kit's keys as frame
// strips, the taming ritual, the Priest's shapes drawn with the accuracy readout, each ult beat by beat (Reduce flashing
// off and on), the HUD per kit, FPS in the busiest scenes, and the auras with nameplates in the village.
//   PORT=3134 node specs/evidence/classes/k-warden-shots.mjs [outDir] [only,only2,...]
// Headed Chromium off to the side (--window-position=2400,0), muted, real GPU; never brought to the front. The combat demo
// (?combat=demo&classes=v2&subclass=<kit>): a level-10 member with the classes_v2 flag on, signed out (`tamed=all` gives
// the Summoner every beast). The ult's clock is held per beat (window.__classDev.holdUlt, window.__combat.freeze) and
// frames are tiled into WebPs with ImageMagick. Copied from k-arcane-shots.mjs and adapted.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/classes", ONLY_LIST] = process.argv.slice(2);
const ONLY = ONLY_LIST ? new Set(ONLY_LIST.split(",")) : null;
const TMP = "/tmp/classes-warden-evidence";
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT ?? 3134, W = 1280, H = 940;
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const WEAPON = { summoner: "seal-gloves-3", shaman: "totem-staff-3", druid: "living-staff-3", priest: "sunstone-staff-3" };
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
/** Clear the field (the encounter's reset: Warden grounds, totems, beasts, a ritual), stand at (x, z) with the kit's weapon, full energy and health, and set foes round the aim (held unless told). */
async function stage(kit, x, z, foes = [], type = "shadow-fox", hold = true) {
  await page.evaluate(([x, z, foes, type, weapon, hold]) => {
    const rt = window.__combat.rt;
    window.__combatDev.reset();
    rt.enemies = rt.enemies.filter(e => e.type.kind === "boss").map(e => ({ ...e, state: "idle", x: e.spawnX, z: e.spawnZ }));
    rt.projectiles = []; rt.units = []; rt.floaters = []; rt.blasts = []; rt.banner = null; rt.fx = []; rt.hazards = [];
    if (!rt.player.owned.includes(weapon)) rt.player.owned.push(weapon);
    Object.assign(rt.player, { hp: rt.player.maxHp, alive: true, energy: 999, weapon });
    Object.assign(rt.v2, { cd: {}, meter: 0, cast: null });
    window.__move.teleport(x, z, 0);
    foes.forEach(([fx, fz], i) => window.__combatDev.spawn(type, fx, fz, `kw-${type}-${i}-${Math.random().toString(36).slice(2, 6)}`));
    for (const e of rt.enemies) if (e.type.kind !== "boss") { e.hp = e.type.hp * 20; if (hold) e.status.hold = 99; }
    window.__publishCombat();
  }, [x, z, foes, type, WEAPON[kit], hold]);
  await page.waitForTimeout(500);
}
const aimAt = async (x, z) => { const p = await page.evaluate(([x, z]) => window.__combatDev.screenOf(x, z), [x, z]); await page.mouse.move(p.x, p.y); return p; };
const around = async (x, z, w = 760, h = 470) => { const p = await page.evaluate(([x, z]) => window.__combatDev.screenOf(x, z), [x, z]); return { x: Math.max(0, Math.min(W - w, Math.round(p.x - w / 2))), y: Math.max(0, Math.min(H - h - 250, Math.round(p.y - h * 0.5))), width: w, height: h }; };
const keys = async (...ks) => { for (const k of ks) { await page.keyboard.down(k); await page.waitForTimeout(40); } for (const k of ks) await page.keyboard.up(k); };
const hurt = share => page.evaluate(s => { const p = window.__combat.rt.player; p.hp = p.maxHp * s; window.__publishCombat(); }, share);
const ME = { x: 2, z: -16 }, AIM = { x: 2, z: -11.5 }, PACK = [[2, -11], [3.2, -12], [0.8, -12.2], [2.8, -10.2], [1.2, -10.4]];

/**
 * Draw the open shape on the incantation overlay with the mouse: its guide paths (already turned for a directional shape)
 * traced point to point, each point off by up to `wobble` px. `mid`: a callback halfway through the last stroke.
 */
async function draw(wobble = 4, mid) {
  const svg = page.locator('[data-testid="incantation"] svg');
  await svg.waitFor({ timeout: 5000 });
  const box = await svg.boundingBox();
  const paths = await page.evaluate(() => [...document.querySelectorAll('[data-testid="incantation"] svg path')].filter(p => /runeGuide/.test(p.getAttribute("class") ?? "")).map(p => p.getAttribute("d")));
  const toScreen = ([x, y]) => [box.x + (x / 320) * box.width, box.y + (y / 320) * box.height];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 2 * wobble;
  for (let s = 0; s < paths.length; s++) {
    const pts = [...paths[s].matchAll(/[ML]\s*([-\d.]+)[ ,]([-\d.]+)/g)].map(m => toScreen([Number(m[1]), Number(m[2])]));
    const dense = [];
    for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], k = Math.max(4, Math.round(Math.hypot(bx - ax, by - ay) / 9)); for (let j = 0; j < k; j++) dense.push([ax + ((bx - ax) * j) / k, ay + ((by - ay) * j) / k]); }
    dense.push(pts[pts.length - 1]);
    await page.mouse.move(dense[0][0], dense[0][1]);
    await page.mouse.down();
    for (let i = 1; i < dense.length; i++) {
      await page.mouse.move(dense[i][0] + (i < dense.length - 1 ? rnd() : 0), dense[i][1] + (i < dense.length - 1 ? rnd() : 0));
      await page.waitForTimeout(8);
      if (mid && s === paths.length - 1 && i === Math.floor(dense.length / 2)) await mid();
    }
    await page.mouse.up();
    await page.waitForTimeout(60);
  }
}
const overlayCrop = async () => { const b = await page.locator('[data-testid="incantation"]').boundingBox(); return { x: Math.max(0, Math.round(b.x - 10)), y: Math.max(0, Math.round(b.y - 10)), width: Math.min(W, Math.round(b.width + 20)), height: Math.min(H, Math.round(b.height + 20)) }; };

/** A key's moments: fire it with `act`, then capture at each delay (ms after the act). */
async function strip(kit, label, act, delays, foes = PACK, type = "shadow-fox", opts = {}) {
  await stage(kit, opts.me?.x ?? ME.x, opts.me?.z ?? ME.z, foes, type, opts.hold ?? true);
  if (opts.before) await opts.before();
  await aimAt(opts.aim?.x ?? AIM.x, opts.aim?.z ?? AIM.z);
  await act();
  const files = [], labels = [];
  let t = 0;
  for (const [d, what] of delays) {
    await page.waitForTimeout(Math.max(0, d - t)); t = d;
    // `follow`: frame the avatar where it is now (a dash, a glide, a run), else the fixed spot.
    const at = opts.follow ? await page.evaluate(() => { const s = window.__move.sim.current.state; return { x: s.x, z: s.z + 2.4 }; }) : { x: opts.focus?.x ?? ME.x, z: opts.focus?.z ?? ME.z + 2.4 };
    files.push(await shot(await around(at.x, at.z, 520, 330))); labels.push(`${label} · ${what} ${d} ms`);
  }
  if (opts.after) await opts.after();
  return { files, labels };
}
async function kitSheet(kit, name, entries, query) {
  await fresh();
  await open(kit, query);
  const files = [], labels = [];
  for (const e of entries) { try { const r = await strip(kit, ...e); files.push(...r.files); labels.push(...r.labels); } catch (err) { console.log("strip failed", kit, e[0], err.message.slice(0, 200)); } }
  tile(files, labels, name, 4, "520x330+3+3");
}
const BOX = [[-1.2, -9.4], [5.2, -9.4], [2, -14.2]]; // three totems round the pack, the far two first

if (wanted("summoner")) await kitSheet("summoner", "K-warden-summoner", [
  ["1 Wolves (toggle)", () => keys("1"), [[150, "the hand sign"], [450, "the pounce"], [900, "hunting as a pair"], [1800, "still out"]]],
  ["2 Owl", () => keys("2"), [[150, "the sign"], [380, "swoop: it grabs you"], [750, "glided forward"], [1700, "circling, diving"]], [[2, -8], [3.5, -8.5]], "shadow-fox", { follow: true }],
  ["3 Toad", () => keys("3"), [[150, "the sign"], [330, "the tongue"], [700, "pulled to you"], [1600, "guarding you"]], [[2, -8.2]], "shadow-fox", { hold: false }],
  ["4 Serpent", () => keys("4"), [[150, "the sign"], [380, "bursts from the ground"], [700, "the target stunned"], [1700, "coiled, biting"]]],
  ["5 Escape Rabbits", async () => { await keys("5"); await page.keyboard.down("a"); }, [[120, "the flood"], [450, "translucent, faster"], [900, "running, faded"], [2100, "the rabbits scatter, fade"]], PACK, "shadow-fox",
    { hold: false, follow: true, after: () => page.keyboard.up("a") }],
], "tamed=all&mastery=20");

if (wanted("shaman")) await kitSheet("shaman", "K-warden-shaman", [
  ["1 Storm Totem", () => keys("1"), [[200, "thrown"], [480, "plants, staggers"], [900, "zaps"], [1700, "zapping"]]],
  ["2 Fire Totem", () => keys("2"), [[200, "thrown"], [480, "lands"], [1100, "flame burst"], [2100, "burning"]]],
  ["3 Earthbind Totem", () => keys("3"), [[200, "thrown"], [480, "lands, staggers"], [5500, "every 5 s the quake"], [5700, "roots what's inside"]], [[2, -9.6], [3.4, -10.6], [0.6, -10.8], [2.8, -12.2], [1.2, -12.3]], "shadow-fox",
    { aim: { x: 2, z: -11 }, focus: { x: 2, z: -12.5 } }],
  ["Links: three totems box the pack", async () => { for (const [i, [x, z]] of BOX.entries()) { await aimAt(x, z); await keys(String(i + 1)); await page.waitForTimeout(650); } }, [[2100, "planted"], [2500, "lightning links"], [3000, "the pack inside"], [3600, "beams cutting"]]],
  ["4 Overcharge", async () => { for (const [i, [x, z]] of BOX.entries()) { await aimAt(x, z); await keys(String(i + 1)); await page.waitForTimeout(650); } await page.waitForTimeout(500); await aimAt(AIM.x, AIM.z); await keys("4"); }, [[2600, "unload"], [2750, "bursts at every totem"], [2950, "the links flash"], [3500, "after"]]],
  ["5 Spirit Hop (mid-jump)", async () => { await page.keyboard.press(" "); await page.waitForTimeout(170); await keys("5"); }, [[230, "the post"], [420, "off it"], [700, "carried"], [1300, "the post links"]], [[2, -9]], "shadow-fox", { follow: true }],
], "mastery=12");

if (wanted("druid")) await kitSheet("druid", "K-warden-druid", [
  ["1 Vine Snare", () => keys("1"), [[200, "vines burst"], [500, "rooted"], [1300, "held"], [2600, "the tangle slows"]], PACK, "shadow-fox", { hold: false }],
  ["2 Thorn Wall", () => keys("2"), [[200, "it rises"], [500, "the wall"], [1500, "they can't pass"], [3000, "it cuts"]], [[2, -9], [3.4, -9.5], [0.6, -9.6]], "shadow-fox", { hold: false, aim: { x: 2, z: -13 } }],
  ["3 Healing Bloom", async () => { await hurt(0.45); await keys("3"); }, [[250, "the flower opens"], [900, "healing"], [2200, "4% a second"], [4200, "regrown"]], [], "shadow-fox", { focus: { x: 2, z: -15 } }],
  ["4 Vine Swing (hold, let go)", async () => { await page.keyboard.down("4"); void page.waitForTimeout(700).then(() => page.keyboard.up("4")); }, [[250, "the vine"], [600, "swinging"], [950, "let go: flying"], [1500, "landing"]], [[2, -6]], "shadow-fox", { aim: { x: 2, z: -8 }, focus: { x: 2, z: -12.5 } }],
  ["5 Wild Ground", async () => { await hurt(0.7); await keys("5"); }, [[250, "the floor erupts"], [700, "grass and roots"], [1600, "enemies slowed"], [3200, "you regenerate"]], [[2, -13.5], [3.5, -14.2], [0.5, -14.4]], "shadow-fox", { hold: false }],
], "mastery=12");

// ── The Priest: every skill drawn; the overlay mid-stroke and its readout, then the spell ──
if (wanted("priest")) {
  await fresh();
  await open("priest", "mastery=12");
  const files = [], labels = [];
  for (const [key, label, hp, foes, wobble] of [["1", "Mend (a cross)", 0.4, [], 4], ["2", "Radiant Shield (a circle)", 1, [[2, -12.5]], 5], ["3", "Holy Beam (a line, drawn the way it goes)", 0.6, PACK, 4],
    ["4", "Sanctify (a triangle)", 0.6, PACK, 6], ["5", "Light Step (a chevron, pointing the way)", 0.6, [[2, -9]], 4], ["1", "Mend drawn badly", 0.4, [], 34]]) {
    try {
      await stage("priest", ME.x, ME.z, foes);
      await hurt(hp);
      await aimAt(AIM.x, AIM.z);
      await keys(key);
      await draw(wobble, async () => { files.push(await shot(await overlayCrop())); labels.push(`${label} · drawing`); });
      await page.waitForTimeout(150);
      files.push(await shot(await overlayCrop())); labels.push(`${label} · ${(await page.locator('[data-testid="rune-readout"]').textContent()).trim()}`);
      for (const [d, what] of [[950, "the spell"], [1900, "after"]]) { await page.waitForTimeout(d === 950 ? 800 : 950); files.push(await shot(await around(ME.x, ME.z + 2.4, 520, 330))); labels.push(`${label} · ${what}`); }
    } catch (err) { console.log("priest strip failed", label, err.message.slice(0, 200)); }
  }
  tile(files, labels, "K-warden-priest", 4, "+3+3");
}

// ── The taming ritual: wolves only; step into the circle, the owl's shadow rises, beat it alone, it's tamed ──
if (wanted("ritual")) {
  await fresh();
  await open("summoner", "mastery=1");
  const R = { x: -11, z: -15.5 }, files = [], labels = [];
  await stage("summoner", R.x - 0.5, R.z - 4.6, []);
  const crop = async () => shot(await around(R.x, R.z - 1.5, 760, 470));
  files.push(await crop()); labels.push("the ritual circle in the outer ruins (wolves known; owl, toad, serpent, rabbits to tame)");
  await page.evaluate(([x, z]) => window.__move.teleport(x, z, Math.PI), [R.x + 0.5, R.z]);
  await page.waitForTimeout(700);
  files.push(await crop()); labels.push("stepped in: the circle wakes");
  await page.waitForFunction(() => window.__combat.rt.enemies.some(e => e.type.id === "shadow-owl" && e.state !== "dead"), null, { timeout: 8000 });
  await page.waitForTimeout(900);
  files.push(await crop()); labels.push("the untamed owl rises: beat it alone");
  for (let i = 0; i < 20; i++) {
    const o = await page.evaluate(() => { const e = window.__combat.rt.enemies.find(x => x.type.id === "shadow-owl" && x.state !== "dead"); return e && { x: e.x, z: e.z }; });
    if (!o) break;
    await aimAt(o.x, o.z); await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(560);
    if (i === 2) { files.push(await crop()); labels.push("the shadow lash on the owl"); await page.evaluate(() => { const e = window.__combat.rt.enemies.find(x => x.type.id === "shadow-owl"); if (e) e.hp = Math.min(e.hp, 12); }); }
  }
  await page.waitForFunction(() => !window.__combat.rt.enemies.some(e => e.type.id === "shadow-owl" && e.state !== "dead"), null, { timeout: 10000 }).catch(() => console.log("the owl didn't fall"));
  await page.waitForTimeout(500);
  files.push(await crop()); labels.push("it falls: the owl is tamed");
  await page.waitForTimeout(1200);
  files.push(await shot({ x: (W - 760) / 2, y: H - 262, width: 760, height: 260 })); labels.push("key 2 opens: the owl (toad, serpent, rabbits still to tame)");
  tile(files, labels, "K-warden-ritual", 3, "760x470+3+3");
}

// ── The ults, beat by beat (§1.6): anticipation, the flash frame, the lines and freeze, the middle, the finisher, follow-through ──
async function ultStrip(kit, reduce) {
  await fresh(reduce ? { "tsi.reduceFlashing.v1": "true" } : { "tsi.reduceFlashing.v1": "false", "tsi.screenShake.v1": "full" });
  await open(kit, kit === "summoner" ? "tamed=all&mastery=12" : "mastery=12");
  await stage(kit, ME.x, ME.z, kit === "summoner" || kit === "druid" ? [[2, -13.2], [3.6, -14], [0.4, -14.2], [3.2, -12.6], [1, -12.4]] : PACK);
  await aimAt(AIM.x, AIM.z);
  if (kit === "summoner") { await keys("1"); await page.waitForTimeout(900); }
  const crop = async () => shot(await around(ME.x, ME.z + 3, 900, 500));
  const files = [], labels = [];
  await page.evaluate(() => { window.__combat.rt.v2.meter = 100; window.__publishCombat(); });
  await page.waitForTimeout(250);
  files.push(await crop()); labels.push(`${kit} ult ready`);
  await page.keyboard.press("f");
  if (kit === "priest") { // the winged sigil, drawn first
    await draw(4, async () => { files.push(await shot(await overlayCrop())); labels.push("Divine Descent: the winged sigil, drawing"); });
    await page.waitForTimeout(150);
    files.push(await shot(await overlayCrop())); labels.push(`the sigil: ${(await page.locator('[data-testid="rune-readout"]').textContent()).trim()}`);
  }
  await page.waitForFunction(() => !!window.__combat.rt.v2.cast, null, { timeout: 8000 });
  await page.evaluate(() => { window.__classDev.holdUlt = true; });
  const { A, span } = await page.evaluate(() => { const u = window.__combat.rt.v2.ult; return { A: u.anticipation_ms / 1000, span: u.impacts !== "first" ? u.duration ?? 0 : 0 }; });
  const at = async (label, t, wait, freeze = false) => {
    await page.evaluate(([t, f]) => { window.__combat.rt.v2.cast.t = t; window.__combat.freeze = f; }, [t, freeze]);
    await page.waitForTimeout(wait);
    files.push(await crop()); labels.push(`${label} ${Math.round(t * 1000)} ms`);
  };
  await at("anticipation", A * 0.7, 300);
  for (const [label, dt, wait] of [["flash frame", 0.01, 40], ["speed lines, freeze", 0.08, 30], ["slow motion, shake", 0.25, 60]]) await at(label, A + dt, wait);
  if (span > 0) {
    await at("the middle", A + span * 0.5, 1200);
    const B = A + span;
    for (const [label, dt, wait] of [["finisher: flash frame", 0.01, 40], ["finisher: lines", 0.08, 30], ["finisher: slow motion", 0.25, 60], ["follow-through", 1.1, 700]]) await at(label, B + dt, wait);
  } else await at("follow-through", A + 1.1, 900);
  await page.evaluate(() => { window.__classDev.holdUlt = false; window.__combat.freeze = false; });
  return { files, labels };
}
if (wanted("ults")) for (const kit of ["summoner", "shaman", "druid", "priest"]) {
  try {
    const off = await ultStrip(kit, false), on = await ultStrip(kit, true);
    tile([...off.files, ...on.files], [...off.labels, ...on.labels.map(l => `Reduce flashing · ${l}`)], `K-warden-ult-${kit}`, 4, "450x250+3+3");
  } catch (err) { console.log("ult failed", kit, err.message.slice(0, 300)); }
}

// ── The HUD per kit: keys with icons and inputs, the class line, the ult slot ──
if (wanted("hud")) {
  const files = [], labels = [];
  const crop = { x: (W - 760) / 2, y: H - 262, width: 760, height: 260 };
  for (const [kit, q, label, act] of [
    ["summoner", "mastery=12", "Summoner before taming: the owl, toad, serpent and rabbits locked", async () => {}],
    ["summoner", "tamed=all&mastery=12", "Summoner: wolves and owl out (toggles on)", async () => { await keys("1"); await page.waitForTimeout(400); await keys("2"); }],
    ["shaman", "mastery=12", "Shaman: totems and Overcharge, Spirit Hop mid-jump", async () => { await keys("1"); }],
    ["druid", "mastery=12", "Druid: the swing held", async () => { await page.keyboard.down("4"); await page.waitForTimeout(300); }],
    ["priest", "mastery=12", "Priest: every key drawn", async () => {}],
  ]) {
    try {
      await fresh();
      await open(kit, q);
      await stage(kit, ME.x, ME.z, PACK);
      await aimAt(AIM.x, AIM.z);
      await act();
      await page.evaluate(() => { const v = window.__combat.rt.v2; v.meter = 72; v.progress = { into: 600, needed: 3800 }; window.__publishCombat(); });
      await page.waitForTimeout(600);
      files.push(await shot(crop)); labels.push(label);
      await page.keyboard.up("4");
    } catch (err) { console.log("hud failed", kit, err.message.slice(0, 200)); }
  }
  tile(files, labels, "K-warden-hud", 2, "+4+4");
}

// ── FPS: the busiest Warden scenes, sampled over 3 s ──
if (wanted("fps")) {
  const rows = [], files = [], labels = [];
  const sample = async () => page.evaluate(() => new Promise(r => { let f = 0; const t0 = performance.now(); const tick = () => { f++; if (performance.now() - t0 < 3000) requestAnimationFrame(tick); else r(f / ((performance.now() - t0) / 1000)); }; requestAnimationFrame(tick); }));
  const pack = Array.from({ length: 12 }, (_, i) => [2 + Math.cos(i) * 3, -10 + Math.sin(i) * 2.5]);
  const free = () => page.evaluate(() => { window.__combat.rt.v2.cd = {}; window.__combat.rt.player.energy = 999; });
  for (const [kit, q, label, setup, during] of [
    ["summoner", "tamed=all&mastery=20", "baseline: a 12-enemy pack", async () => {}],
    ["summoner", "tamed=all&mastery=20", "four beasts, then Shadow Garden", async () => { for (const k of ["1", "2", "3", "4"]) { await keys(k); await page.waitForTimeout(300); } await page.evaluate(() => { window.__combat.rt.v2.meter = 100; }); await page.keyboard.press("f"); await page.waitForTimeout(1600); }],
    ["summoner", "tamed=all&mastery=20", "the rabbit flood kept up (144 rabbits)", async () => { for (let i = 0; i < 3; i++) { await free(); await keys("5"); await page.waitForTimeout(250); } },
      async () => { for (let i = 0; i < 4; i++) { await page.waitForTimeout(750); await free(); await keys("5"); } }],
    ["shaman", "mastery=20", "three linked totems, Spirit Awakening", async () => { for (const [i, [x, z]] of BOX.entries()) { await aimAt(x, z); await keys(String(i + 1)); await page.waitForTimeout(650); } await page.evaluate(() => { window.__combat.rt.v2.meter = 100; }); await page.keyboard.press("f"); await page.waitForTimeout(1500); }],
    ["druid", "mastery=20", "World Tree, Wild Ground, a thorn wall", async () => { await keys("5"); await page.waitForTimeout(300); await keys("2"); await page.waitForTimeout(300); await page.evaluate(() => { window.__combat.rt.v2.meter = 100; }); await page.keyboard.press("f"); await page.waitForTimeout(1500); }],
    ["priest", "mastery=20", "Sanctify, Divine Descent's pillar", async () => { await keys("4"); await draw(4); await page.waitForTimeout(900); await page.evaluate(() => { window.__combat.rt.v2.meter = 100; }); await page.keyboard.press("f"); await draw(4); await page.waitForTimeout(1600); }],
  ]) {
    try {
      await fresh(); await open(kit, q);
      await stage(kit, ME.x, ME.z, pack, "shadow-fox");
      await aimAt(AIM.x, AIM.z);
      await setup();
      // Frames counted over 3 s while the scene runs (and keeps going: `during`); the screen is taken after (a capture
      // in the window stalls frames).
      const counting = sample(), keeping = during ? during() : null;
      const fps = await counting; await keeping;
      files.push(await shot(await around(ME.x, ME.z + 3, 900, 500))); labels.push(`${label}: ${fps.toFixed(0)} FPS`);
      rows.push(`| ${kit} | ${label} | ${fps.toFixed(0)} |`);
    } catch (err) { console.log("fps failed", label, err.message.slice(0, 200)); }
  }
  tile(files, labels, "K-warden-fps", 2, "450x250+3+3");
  writeFileSync(`${OUT}/K-warden-fps.md`, ["# Classes v2, the Warden wave: FPS in its busiest scenes", "", `Measured by \`k-warden-shots.mjs fps\` (headed Chromium, Apple M4 Mac mini, 1280×940, High graphics with shadows, the ruins, a 12-enemy pack held in place; frames counted over 3 s while the scene runs). The machine was busy (load average ${(await import("node:os")).loadavg()[0].toFixed(1)}: other agents' tests and a game running), so read the rows against the baseline row, not as absolute numbers. Screens: K-warden-fps.webp.`, "", "| Kit | Scene | FPS |", "|---|---|---|", ...rows, ""].join("\n"));
}

// ── The auras and nameplates in the village (mastery 20: the second motes, the ring, the gold frame) ──
if (wanted("aura")) {
  await fresh({ "tsi.hud.full.v1": "false" });
  const files = [], labels = [];
  for (const kit of ["summoner", "shaman", "druid", "priest"]) {
    try {
      await open(kit, "mastery=20&frame=gold", false);
      await page.waitForSelector('[data-testid="nameplate-class"]', { timeout: 30000 });
      await page.waitForTimeout(1500);
      const p = await page.evaluate(() => window.__move.screen());
      files.push(await shot({ x: Math.max(0, Math.round(p.x - 210)), y: Math.max(0, Math.round(p.y - 300)), width: 420, height: 400 })); labels.push(`${kit}: aura, Master, gold frame`);
    } catch (err) { console.log("aura failed", kit, err.message.slice(0, 200)); }
  }
  tile(files, labels, "K-warden-aura-nameplate", 4, "420x400+4+4");
}
await ctx?.close();
await browser.close();
