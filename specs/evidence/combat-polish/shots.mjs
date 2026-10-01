// Combat polish evidence (specs/combat-polish.md §13): hit feedback, telegraph families, a pack keeping apart,
// projectiles and totems, the HUD and banners, the dash, facing, the escort, and FPS in a full pack fight.
//   PORT=3120 node specs/evidence/combat-polish/shots.mjs [outDir] [only,only2,...]   (BEFORE=1 for the pre-polish build: facing, pack, fps)
// Headed Chromium (WebGL needs it), real GPU (metal), muted (--mute-audio). The ruins in the combat demo (?combat=demo):
// a level-10 member with a subclass, signed out. Frames are held with __combat.freeze (the encounter clock stops) and
// tiled into small WebPs with ImageMagick.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/combat-polish", ONLY_LIST] = process.argv.slice(2);
const ONLY = ONLY_LIST ? new Set(ONLY_LIST.split(",")) : null, BEFORE = !!process.env.BEFORE, P = BEFORE ? "C4-00-before-" : "C4-";
const TMP = "/tmp/combat-polish-evidence";
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT ?? 3120, W = 1280, H = 760;
// UNCAPPED=1: no vsync or frame-rate limit, for the FPS run (the display caps at 144 otherwise).
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", ...(process.env.UNCAPPED ? ["--disable-gpu-vsync", "--disable-frame-rate-limit"] : [])] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
await ctx.addInitScript(([look]) => { try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.removeItem("tsi.moveKeys.v1"); localStorage.removeItem("tsi.combatKeys.v2"); } catch {} }, [LOOK]);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) console.log("console", m.text().slice(0, 200)); });

let opened = null;
async function open(query) {
  if (opened === query) return;
  opened = query;
  await page.goto(`http://localhost:${PORT}/lab/island?time=day&weather=clear&season=summer&ruins=1&combat=demo&${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 180000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(() => !!window.__move?.sim?.current && !!window.__combatDev?.screenOf && !!window.__combat?.rt?.kit && !document.querySelector('[role="status"]')?.textContent?.includes("Preparing")) ? quiet + 1 : 0; }
  await page.waitForTimeout(3500);
}
const tile = (files, labels, name, cols, geometry) => {
  const args = ["montage"];
  files.forEach((f, i) => args.push("-label", labels[i], f));
  args.push("-tile", `${cols}x`, "-geometry", geometry, "-background", "#0b0e14", "-fill", "#f1ffff", "-font", "/System/Library/Fonts/Monaco.ttf", "-pointsize", "12", "-quality", "68", `${OUT}/${name}.webp`);
  execFileSync("magick", args);
  console.log("wrote", `${OUT}/${name}.webp`);
};
const shot = async (name, clip) => { const file = `${TMP}/${name}.png`; await page.screenshot({ path: file, ...(clip ? { clip } : {}) }); return file; };
/** A box around a ground point (x, z) on the page. */
const around = async (x, z, w = 440, h = 330, lift = 0.62) => {
  const p = await page.evaluate(([x, z]) => window.__combatDev.screenOf(x, z), [x, z]);
  // Clear of the settings panel on the right.
  return { x: Math.max(0, Math.min(W - 250 - w, Math.round(p.x - w / 2))), y: Math.max(0, Math.min(H - h, Math.round(p.y - h * lift))), width: w, height: h };
};
const me = () => page.evaluate(() => ({ x: window.__combatDev.player.x, z: window.__combatDev.player.z }));
const freeze = on => page.evaluate(v => { window.__combat.freeze = v; }, on);
/** Put the player at (x, z) and clear the field: every enemy idle and far away (stood down until `keep`). */
async function stage(x, z, facing = 0, keep = []) {
  await page.evaluate(([x, z, f, keep]) => {
    const rt = window.__combat.rt;
    rt.enemies = rt.enemies.filter(e => keep.includes(e.type.id)).map(e => ({ ...e, state: "idle", x: e.spawnX, z: e.spawnZ }));
    rt.projectiles = []; rt.units = []; rt.floaters = []; rt.blasts = []; rt.banner = null;
    Object.assign(rt.player, { hp: rt.player.maxHp, alive: true, energy: 100 });
    for (const k of Object.keys(rt.cooldowns)) rt.cooldowns[k] = 0;
    window.__move.teleport(x, z, f);
  }, [x, z, facing, keep]);
  await page.waitForTimeout(500);
}
/** Spawn enemies of a type at points, already hunting you (ids "ev-…"); `hp` overrides their health. */
let spawned = 0;
const spawn = (type, points, more = {}) => page.evaluate(([type, points, more, n]) => {
  for (const [i, [x, z]] of points.entries()) window.__combatDev.spawn(type, x, z, `ev-${type}-${n}-${i}`);
  if (more.hp) for (const e of window.__combat.rt.enemies) if (e.id.startsWith(`ev-${type}-${n}-`)) e.hp = more.hp;
}, [type, points, more, spawned++]);
/** Aim the mouse at a ground point. */
const aimAt = async (x, z) => { const p = await page.evaluate(([x, z]) => window.__combatDev.screenOf(x, z), [x, z]); await page.mouse.move(p.x, p.y); return p; };
/** Wait (real time) until the page condition holds, then freeze the encounter. */
async function holdWhen(cond, arg, timeout = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { if (await page.evaluate(cond, arg)) { await freeze(true); return true; } await page.waitForTimeout(16); }
  return false;
}
const wanted = name => !ONLY || ONLY.has(name);
/** The bottom HUD out of the world crops (the HUD has its own shots). */
const hud = show => page.evaluate(v => { let s = document.getElementById("ev-hud"); if (!s) { s = document.createElement("style"); s.id = "ev-hud"; document.head.append(s); } s.textContent = v ? "" : 'section[aria-label="Combat status"], [data-combat] { visibility: hidden !important; }'; }, show);
const notes = [];

// ── Facing: before (always the cursor, feet sliding) and after (the way you move; the aim for an attack, held 0.6 s) ──
if (wanted("facing")) {
  await open("subclass=juggernaut&zoom=0.62");
  await hud(false);
  const frames = [], labels = [];
  await stage(-9, -17, 0);
  const p0 = await me();
  await aimAt(p0.x, p0.z + 5); // aim up the screen
  await page.waitForTimeout(400);
  await page.keyboard.down("a"); // run screen-left (+x) while aiming up
  for (const [ms, text] of [[350, "running left, aim up"], [350, "still running"]]) { await page.waitForTimeout(ms); const p = await me(); await aimAt(p.x, p.z + 5); frames.push(await shot(`facing-${frames.length}`, await around(p.x, p.z, 360, 300))); labels.push(text); }
  await page.mouse.down(); await page.waitForTimeout(40); await page.mouse.up();
  await page.waitForTimeout(90);
  { const p = await me(); frames.push(await shot(`facing-${frames.length}`, await around(p.x, p.z, 360, 300))); labels.push("click: swings at the aim"); }
  await page.waitForTimeout(350);
  { const p = await me(); frames.push(await shot(`facing-${frames.length}`, await around(p.x, p.z, 360, 300))); labels.push("0.45 s after: holds the aim"); }
  await page.waitForTimeout(450);
  { const p = await me(); frames.push(await shot(`facing-${frames.length}`, await around(p.x, p.z, 360, 300))); labels.push("0.9 s after: back to running"); }
  await page.keyboard.up("a");
  await page.waitForTimeout(500);
  { const p = await me(); frames.push(await shot(`facing-${frames.length}`, await around(p.x, p.z, 360, 300))); labels.push("standing: turns to the aim"); }
  tile(frames, labels, `${P}08-facing`, 3, "300x250+3+3");
}

// ── A pack keeping apart: five foxes on one spot, two seconds into the chase ──
if (wanted("pack")) {
  await open("subclass=juggernaut&zoom=0.62");
  await hud(false);
  await stage(0, -12, 0, ["shadow-fox"]);
  await spawn("shadow-fox", [[0.2, -7], [0.3, -7.1], [0.1, -6.9], [0.25, -6.95], [0.15, -7.05]], { hp: 9999 });
  await page.evaluate(() => { const rt = window.__combat.rt; rt.player.maxHp = rt.player.hp = 99999; });
  const frames = [], labels = [];
  for (const ms of [150, 1800]) {
    await page.waitForTimeout(ms);
    const d = await page.evaluate(() => { const es = window.__combat.rt.enemies.filter(e => e.id.startsWith("ev-")); let m = Infinity; for (const [i, a] of es.entries()) for (const b of es.slice(i + 1)) m = Math.min(m, Math.hypot(a.x - b.x, a.z - b.z)); return m; });
    const p = await me();
    frames.push(await shot(`pack-${frames.length}`, await around(p.x, p.z + 2, 520, 360, 0.5))); labels.push(`${ms < 1000 ? "spawned on one spot" : "2 s into the chase"}: closest pair ${d.toFixed(2)} u`);
  }
  tile(frames, labels, `${P}03-pack-apart`, 2, "420x291+3+3");
}

// ── FPS in a full pack fight: both survive missions' waves at once around you, a Shaman's three totems ──
if (wanted("fps")) {
  await open("subclass=shaman&zoom=1.25");
  await stage(0, 7, 0);
  // Every wave of both survive missions at once (17), in a ring around you in the temple court.
  await page.evaluate(() => { const rt = window.__combat.rt; rt.player.maxHp = rt.player.hp = 99999; for (const id of ["survive-sanctum", "survive-circle"]) for (let i = 0; i < (id === "survive-sanctum" ? 4 : 3); i++) window.__combatDev.spawnWave(id, i);
    rt.enemies.forEach((e, i) => { const a = (i / rt.enemies.length) * Math.PI * 2, r = 3.5 + (i % 3); e.x = e.spawnX = Math.sin(a) * r; e.z = e.spawnZ = 7 + Math.cos(a) * r; e.hp = 99999; }); });
  for (const [k, dx] of [["1", 1.5], ["2", 0], ["3", -1.5]]) { await aimAt(dx, 8.5); await page.keyboard.press(k); await page.waitForTimeout(300); }
  await page.evaluate(() => { for (const u of window.__combat.rt.units) u.hp = 1e9; });
  await page.mouse.down(); // and swing the whole time
  const fps = await page.evaluate(() => new Promise(done => {
    const times = []; let last = performance.now(); const t0 = last;
    const f = now => { times.push(now - last); last = now; if (now - t0 < 6000) requestAnimationFrame(f); else { times.sort((a, b) => a - b); done({ frames: times.length, avg: times.length / ((now - t0) / 1000), p99: 1000 / times[Math.floor(times.length * 0.99)], enemies: window.__combat.rt.enemies.filter(e => e.state !== "dead").length, units: window.__combat.rt.units.length }); } };
    requestAnimationFrame(f);
  }));
  await page.mouse.up();
  const line = `${BEFORE ? "before" : "after"}${process.env.UNCAPPED ? " (uncapped)" : " (144 Hz cap)"}: ${fps.avg.toFixed(1)} FPS average, ${fps.p99.toFixed(1)} FPS 1% low over 6 s, ${fps.enemies} enemies, ${fps.units} units`;
  console.log("FPS", line);
  notes.push(`FPS ${line}`);
  await shot("fps", null).then(f => execFileSync("magick", [f, "-resize", "900x", "-quality", "66", `${OUT}/${P}10-full-pack-fight.webp`]));
}

if (!BEFORE) {
  // ── Hit feedback: the swing, the hit (flash, swell, hitstop), the defeat pop and its puff, the numbers ──
  if (wanted("hit")) {
    await open("subclass=juggernaut&zoom=0.8");
    await hud(false);
    await stage(0, -18, 0);
    const p = await me();
    await spawn("shadow-fox", [[p.x + 1.3, p.z + 0.5]], { hp: 9999 });
    await spawn("thorn-crab", [[p.x + 1, p.z + 1.4]], { hp: 1 });
    await page.evaluate(() => { const rt = window.__combat.rt; for (const e of rt.enemies) if (e.id.startsWith("ev-")) { e.state = "idle"; e.stun = 99; } });
    await aimAt(p.x + 1.2, p.z + 0.9);
    await page.waitForTimeout(400);
    const frames = [], labels = [], box = await around(p.x + 0.6, p.z + 0.6, 400, 300, 0.6);
    frames.push(await shot("hit-0", box)); labels.push("before the swing");
    await page.mouse.down(); await page.mouse.up();
    await holdWhen(() => window.__combat.hitstop > 0 || window.__combat.rt.enemies.some(e => e.flash > 0.1));
    frames.push(await shot("hit-1", box)); labels.push("the hit: flash and swell (a 60 ms hitstop)");
    await freeze(false);
    await holdWhen(() => window.__combat.rt.enemies.some(e => e.state === "dead" && e.deadFor > 0.03 && e.deadFor < 0.12));
    frames.push(await shot("hit-2", box)); labels.push("the crab pops (a size up)");
    await freeze(false);
    await page.waitForTimeout(120);
    frames.push(await shot("hit-3", box)); labels.push("gone in a puff; the numbers rise");
    tile(frames, labels, `${P}01-hit-feedback`, 2, "360x270+3+3");
    await hud(true);
  }

  // ── Telegraph families: melee sector, ranged line to the landing, area ring, the guardian's; a pack overlapping ──
  if (wanted("telegraphs")) {
    await open("subclass=juggernaut&zoom=0.62");
    await hud(false);
    const frames = [], labels = [];
    const family = async (name, type, at, text, opts = {}) => {
      await stage(...at, 0);
      const p = await me(), pts = (opts.points ?? [[opts.dx ?? 1.6, opts.dz ?? 0.4]]).map(([dx, dz]) => [p.x + dx, p.z + dz]);
      await spawn(type, pts, { hp: 9999 });
      await page.evaluate(() => { const rt = window.__combat.rt; rt.player.maxHp = rt.player.hp = 99999; });
      const ok = await holdWhen(n => window.__combat.rt.enemies.filter(e => e.id.startsWith("ev-") && e.state === "windup" && e.t > e.move.windup * 0.6).length >= n, opts.n ?? 1, 8000);
      const cx = (p.x + pts[0][0]) / 2, cz = (p.z + pts[0][1]) / 2;
      frames.push(await shot(name, await around(opts.points ? p.x : cx, opts.points ? p.z + 0.3 : cz, 400, 300, 0.55))); labels.push(ok ? text : `${text} (no windup)`);
      await freeze(false);
    };
    await family("tg-melee", "shadow-fox", [0, -18], "melee: red sector", { dx: 1.7, dz: 0.3 });
    await family("tg-ranged", "mushroom-beast", [0, -18], "ranged: amber line to the landing", { dx: 3.6, dz: 1.2 });
    await family("tg-area", "stone-golem", [0, 6], "area: magenta ring", { dx: 1.8, dz: 0.6 });
    await family("tg-pack", "shadow-fox", [0, -18], "a pack overlapping: every rim reads", { points: [[1.5, 0.4], [-1.5, 0.3], [0.2, 1.6], [1.1, -1.2]], n: 3 });
    // The guardian: its smash ring, in its own violet.
    await stage(-2.5, 20, 0);
    await spawn("guardian-statue", [[1, 23.5]], { hp: 99999 });
    await page.evaluate(() => { const rt = window.__combat.rt; rt.player.maxHp = rt.player.hp = 99999; });
    const ok = await holdWhen(() => window.__combat.rt.enemies.some(e => e.type.kind === "boss" && e.state === "windup" && e.t > e.move.windup * 0.6), null, 9000);
    frames.push(await shot("tg-boss", await around(-1.4, 21.8, 400, 300, 0.5))); labels.push(ok ? "the guardian: violet, its own" : "guardian (no windup)");
    await freeze(false);
    tile(frames, labels, `${P}02-telegraph-families`, 3, "330x248+3+3");
    await hud(true);
  }

  // ── Projectiles with glow trails, and the totems ──
  if (wanted("projectiles")) {
    const frames = [], labels = [];
  await hud(false);
    const volley = async (query, keys, text, weapon) => {
      await open(query);
      await stage(0, -18, 0);
      const p = await me();
      await spawn("thorn-crab", [[p.x, p.z + 7]], { hp: 9999 });
      await page.evaluate(([w]) => { const rt = window.__combat.rt; rt.player.maxHp = rt.player.hp = 99999; if (w) rt.player.weapon = w; for (const e of rt.enemies) if (e.id.startsWith("ev-")) e.stun = 99; }, [weapon]);
      await aimAt(p.x, p.z + 7);
      await page.waitForTimeout(250);
      for (const k of keys) { if (k === "click") { await page.mouse.down(); await page.mouse.up(); } else await page.keyboard.press(k); await page.waitForTimeout(60); }
      await holdWhen(() => window.__combat.rt.projectiles.some(s => Math.hypot(s.x - window.__combatDev.player.x, s.z - window.__combatDev.player.z) > 2), null, 3000);
      frames.push(await shot(`pj-${frames.length}`, await around(p.x, p.z + 3.5, 420, 300, 0.5))); labels.push(text);
      await freeze(false);
    };
    await volley("subclass=hunter&zoom=0.62", ["1"], "arrows: the Hunter's volley", "bow-willow");
    await volley("subclass=elementalist&zoom=0.62", ["click"], "the staff's rune bolt", "staff-oak");
    // The mushroom's spore glob, flying at you.
    await stage(0, -18, 0);
    { const p = await me();
      await spawn("mushroom-beast", [[p.x + 0.5, p.z + 4.4]], { hp: 9999 });
      await page.evaluate(() => { const rt = window.__combat.rt; rt.player.maxHp = rt.player.hp = 99999; });
      await holdWhen(() => window.__combat.rt.projectiles.some(s => s.kind === "spit" && s.life < 0.4), null, 8000);
      frames.push(await shot("pj-spit", await around(p.x, p.z + 2.2, 420, 300, 0.5))); labels.push("the spore glob coming at you"); await freeze(false); }
    // The Shaman's three totems.
    await open("subclass=shaman&zoom=0.55");
    await stage(0, -18, 0);
    { const p = await me();
      for (const [k, dx] of [["1", 1.5], ["2", 0], ["3", -1.5]]) { await aimAt(p.x + dx, p.z + 3); await page.waitForTimeout(150); await page.keyboard.press(k); await page.waitForTimeout(400); }
      await page.waitForTimeout(600);
      frames.push(await shot("pj-totems", await around(p.x, p.z + 2.6, 520, 371, 0.55))); labels.push("totems: ember, mending, warding"); }
    tile(frames, labels, `${P}04-projectiles-totems`, 2, "380x271+3+3");
  }

  // ── The HUD: cream kit, cooldown sweeps, energy, full names, enemy HP bars, a status word; the two banners ──
  if (wanted("hud")) {
    await open("subclass=marksman&zoom=0.62");
    await stage(0, -18, 0);
    const p = await me();
    await spawn("shadow-fox", [[p.x - 1.5, p.z + 4], [p.x + 1.5, p.z + 4.5]], { hp: 120 });
    await spawn("elder-thorn-crab", [[p.x, p.z + 5.5]], { hp: 300 });
    await page.evaluate(() => { const rt = window.__combat.rt; rt.player.maxHp = rt.player.hp = 99999; for (const e of rt.enemies) if (e.id.startsWith("ev-")) { e.stun = 99; e.hp = Math.round(e.type.hp * (0.35 + Math.random() * 0.4)); } });
    await aimAt(p.x, p.z + 4.5);
    await page.waitForTimeout(200);
    await page.keyboard.press("1"); await page.waitForTimeout(500);
    await page.keyboard.press("2"); await page.waitForTimeout(700);
    await page.keyboard.press("1"); // on cooldown: the slot shakes
    await page.waitForTimeout(80);
    await page.evaluate(() => { window.__combat.rt.player.energy = 4; });
    await page.keyboard.press("3");
    await page.waitForTimeout(150);
    await freeze(true);
    await page.evaluate(() => window.__publishCombat());
    await page.waitForTimeout(200);
    const full = await shot("hud-full", null);
    execFileSync("magick", [full, "-resize", "1000x", "-quality", "70", `${OUT}/${P}05-hud.webp`]);
    console.log("wrote", `${OUT}/${P}05-hud.webp`);
    const box = await page.locator('section[aria-label="Combat status"]').boundingBox();
    const hudCrop = await shot("hud-crop", { x: box.x - 8, y: box.y - 8, width: box.width + 16, height: box.height + 16 });
    await freeze(false);
    // The banners: the guardian's victory with its spoils, a Transmuter's new trait.
    const banner = async (b, name) => {
      await page.evaluate(([b]) => { window.__combat.rt.banner = { ...b, until: 1e9 }; window.__publishCombat(); }, [b]);
      await page.waitForTimeout(450);
      const el = await page.locator('p[role="status"][data-kind]').boundingBox();
      return shot(name, { x: el.x - 12, y: el.y - 12, width: el.width + 24, height: el.height + 24 });
    };
    const v = await banner({ kind: "victory", title: "The guardian falls", text: "+150 coins · 2 crystal, 1 gold nugget · Epic: Sentinel bow" }, "banner-victory");
    const tr = await banner({ kind: "trait", title: "New trait: Crab Shell", text: "From its crab shell. Equip it at the Oracle." }, "banner-trait");
    await page.evaluate(() => { window.__combat.rt.banner = null; window.__publishCombat(); });
    execFileSync("magick", [hudCrop, "(", v, tr, "-background", "#0b0e14", "-gravity", "center", "+append", ")", "-background", "#0b0e14", "-gravity", "center", "-append", "-resize", "900x>", "-quality", "70", `${OUT}/${P}06-hud-panel-banners.webp`]);
    console.log("wrote", `${OUT}/${P}06-hud-panel-banners.webp`);
  }

  // ── The dash: Q through a fox's lunge (the village burst with i-frames), the cooldown ring ──
  if (wanted("dash")) {
    await open("subclass=juggernaut&zoom=0.55");
  await hud(false);
    await stage(0, -18, 0);
    const p = await me();
    await spawn("shadow-fox", [[p.x, p.z + 1.8]], { hp: 9999 });
    await page.evaluate(() => { const rt = window.__combat.rt; rt.player.maxHp = rt.player.hp = 200; rt.player.hp = 200; });
    await aimAt(p.x, p.z + 3);
    await holdWhen(() => window.__combat.rt.enemies.some(e => e.id.startsWith("ev-") && e.state === "windup" && e.t > 0.3), null, 6000);
    await freeze(false);
    const frames = [], labels = [], box = await around(p.x - 1.2, p.z + 0.6, 440, 320, 0.55), t0 = Date.now();
    await page.keyboard.down("a"); await page.keyboard.press("q");
    for (let i = 0; i < 6; i++) {
      const s = await page.evaluate(() => { const rt = window.__combat.rt, e = rt.enemies.find(x => x.id.startsWith("ev-")); return { fox: e.state, dodge: rt.player.dodgeAge, hp: rt.player.hp, dodged: rt.floaters.some(f => f.text === "Dodged") }; });
      frames.push(await shot(`dash-${i}`, box)); labels.push(`${((Date.now() - t0) / 1000).toFixed(2)} s  fox ${s.fox}  dodge ${s.dodge === null ? "-" : s.dodge.toFixed(2)}  hp ${s.hp}${s.dodged ? "  Dodged" : ""}`);
      await page.waitForTimeout(60);
    }
    await page.keyboard.up("a");
    tile(frames, labels, `${P}07-dash`, 3, "330x240+3+3");
  }

  // ── The escort on the character rig, walking the path and facing where it walks ──
  if (wanted("escort")) {
    await open("subclass=juggernaut&zoom=0.55&mission=escort-botanist");
  await hud(false);
    // Halfway along the path (the leg toward the temple steps runs up and to the right), you standing close by.
    await stage(1.5, -19.5, 0);
    await page.evaluate(() => { window.__combat.rt.escort = { x: 0, z: -18.2, hp: 60, waypoint: 2 }; });
    const frames = [], labels = [];
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(i ? 450 : 250);
      const esc = await page.evaluate(() => window.__combat.rt.escort);
      if (!esc) { labels.push("no escort"); continue; }
      frames.push(await shot(`escort-${i}`, await around(esc.x, esc.z, 380, 300, 0.6))); labels.push("the botanist walks the path, facing its way");
    }
    // You wander off: it waits, turned toward you.
    await page.evaluate(() => window.__move.teleport(3, -22, 0));
    await page.waitForTimeout(1500);
    const esc = await page.evaluate(() => window.__combat.rt.escort), p = await me();
    frames.push(await shot("escort-wait", await around((esc.x + p.x) / 2, (esc.z + p.z) / 2, 380, 300, 0.6))); labels.push("you step away: it waits, turned to you");
    if (frames.length) tile(frames, labels, `${P}09-escort`, 2, "320x253+3+3");
  }
}

if (notes.length) writeFileSync(`${TMP}/fps-${BEFORE ? "before" : "after"}${process.env.UNCAPPED ? "-uncapped" : ""}.txt`, notes.join("\n") + "\n");
await browser.close();
