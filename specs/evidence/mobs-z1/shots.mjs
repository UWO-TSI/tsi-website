// Zone 1 mobs evidence (design sheet "Mobs, zone 1"): each mob's tell and attack as a frame strip, the crab's front vs
// flank, the pollen swarm, the elder thorn crab's phases, a full zone-1 fight and its FPS.
//   PORT=3130 node specs/evidence/mobs-z1/shots.mjs [outDir] [only,only2,...]
// Headed Chromium off-screen (--window-position=2400,0; WebGL needs a real GPU), muted, closed at the end; never brought to
// the front. The ruins in the combat demo (?combat=demo): a level-10 member with a subclass, signed out. Frames are held
// with __combat.freeze (the encounter clock and the mob effects stop) and tiled into small WebPs with ImageMagick.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/mobs-z1", ONLY_LIST] = process.argv.slice(2);
const ONLY = ONLY_LIST ? new Set(ONLY_LIST.split(",")) : null;
const TMP = "/tmp/mobs-z1-evidence";
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT ?? 3130, W = 1280, H = 760;
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist", ...(process.env.UNCAPPED ? ["--disable-gpu-vsync", "--disable-frame-rate-limit"] : [])] });
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
  await page.waitForTimeout(3000);
}
const tile = (files, labels, name, cols, geometry) => {
  const args = ["montage"];
  files.forEach((f, i) => args.push("-label", labels[i], f));
  args.push("-tile", `${cols}x`, "-geometry", geometry, "-background", "#0b0e14", "-fill", "#f1ffff", "-font", "/System/Library/Fonts/Monaco.ttf", "-pointsize", "12", "-quality", "70", `${OUT}/${name}.webp`);
  execFileSync("magick", args);
  console.log("wrote", `${OUT}/${name}.webp`);
};
const shot = async (name, clip) => { const file = `${TMP}/${name}.png`; if (process.env.FULL) await page.screenshot({ path: `${TMP}/full-${name}.png` }); await page.screenshot({ path: file, ...(clip ? { clip } : {}) }); return file; };
/** A box around a ground point (x, z) on the page, clear of the settings panel on the right. */
const around = async (x, z, w = 460, h = 340, lift = 0.6) => {
  const p = await page.evaluate(([x, z]) => window.__combatDev.screenOf(x, z), [x, z]);
  return { x: Math.max(0, Math.min(W - 250 - w, Math.round(p.x - w / 2))), y: Math.max(40, Math.min(H - h, Math.round(p.y - h * lift))), width: w, height: h };
};
const me = () => page.evaluate(() => ({ x: window.__combatDev.player.x, z: window.__combatDev.player.z }));
const freeze = on => page.evaluate(v => { window.__combat.freeze = v; }, on);
/** Put the player at (x, z) facing `facing`; keep only these enemy types, each idle at its spawn; you can't die. */
async function stage(x, z, facing = 0, keep = []) {
  await freeze(false);
  await page.evaluate(([x, z, f, keep]) => {
    window.__combatDev.reset();
    const rt = window.__combat.rt;
    rt.enemies = rt.enemies.filter(e => keep.includes(e.type.id));
    rt.projectiles = []; rt.units = []; rt.floaters = []; rt.blasts = []; rt.hazards = []; rt.fx = []; rt.banner = null; rt.buffs = [];
    Object.assign(rt.player, { maxHp: 99999, hp: 99999, alive: true, energy: 100 });
    for (const k of Object.keys(rt.cooldowns)) rt.cooldowns[k] = 0;
    window.__move.teleport(x, z, f);
    window.__combat.freeze = true; // the field holds while the follow camera settles behind you
  }, [x, z, facing, keep]);
  await page.waitForTimeout(1500);
  await freeze(false);
}
const aimAt = async (x, z) => { const p = await page.evaluate(([x, z]) => window.__combatDev.screenOf(x, z), [x, z]); await page.mouse.move(p.x, p.y); return p; };
/** Wait until the page condition holds, checked every frame in the page, and freeze the encounter on that frame. */
async function holdWhen(cond, arg = null, timeout = 8000) {
  const ok = await page.evaluate(([src, arg, timeout]) => new Promise(done => {
    const f = new Function("arg", `return (${src})(arg)`), t0 = performance.now();
    const tick = () => {
      let v = false;
      try { v = f(arg); } catch { v = false; }
      if (v || performance.now() - t0 > timeout) { window.__combat.freeze = true; done(v); } else requestAnimationFrame(tick);
    };
    tick();
  }), [cond.toString(), arg, timeout]);
  if (!ok) console.log("holdWhen timed out:", cond.toString().slice(0, 120));
  await page.waitForTimeout(120); // two frames drawn on the held state
  return ok;
}
const wanted = name => !ONLY || ONLY.has(name);
const hud = show => page.evaluate(v => { let s = document.getElementById("ev-hud"); if (!s) { s = document.createElement("style"); s.id = "ev-hud"; document.head.append(s); } s.textContent = (v ? "" : 'section[aria-label="Combat status"], [data-combat] { visibility: hidden !important; } ') + '[class*="lookHint"] { display: none !important; }'; }, show);
const enemy = (id) => page.evaluate(id => { const e = window.__combat.rt.enemies.find(x => x.id === id); return e && { x: e.x, z: e.z, state: e.state, t: e.t, shape: e.move.shape, phase: e.phase, hp: e.hp }; }, id);

// ── Shadow fox: a den flanks you, crouches (mane and eyes flare, a lane on the ground), pounces, lands; the next goes ──
if (wanted("fox")) {
  await open("subclass=guardian&zoom=0.95");
  await hud(false);
  await stage(6.5, -23, 0, ["shadow-fox"]);
  const frames = [], labels = [], P = await me(), box = await around(P.x + 1.2, P.z + 2, 600, 420, 0.62);
  await holdWhen(() => window.__combat.rt.enemies.filter(e => e.state === "chase").length === 3 && window.__combat.rt.enemies.some(e => e.t > 0.25));
  frames.push(await shot("fox-0", box)); labels.push("the den wakes and fans out to slots");
  await freeze(false);
  await holdWhen(() => window.__combat.rt.enemies.some(e => e.state === "windup" && e.t > e.move.windup * 0.75));
  frames.push(await shot("fox-1", box)); labels.push("crouch: mane and eyes flare, its lane");
  await freeze(false);
  await holdWhen(() => window.__combat.rt.enemies.some(e => e.state === "active" && e.t > 0.1));
  frames.push(await shot("fox-2", box)); labels.push("the pounce down the lane");
  await freeze(false);
  await holdWhen(() => window.__combat.rt.player.hurt > 0.25);
  frames.push(await shot("fox-3", box)); labels.push("it lands: an impact star");
  await freeze(false);
  await page.waitForTimeout(300);
  await holdWhen(() => window.__combat.rt.enemies.filter(e => e.state === "windup" && e.t > e.move.windup * 0.6).length > 0);
  frames.push(await shot("fox-4", box)); labels.push("then the next, from another side");
  tile(frames, labels, "01-fox-pack-pounce", 3, "500x350+3+3");
}

// ── Thorn crab: a hit on its front shell glances off (sparks, the hint, a small number); from behind it lands in full ──
if (wanted("crab")) {
  await open("subclass=guardian&zoom=0.8");
  await hud(false);
  const frames = [], labels = [];
  const C = { x: 3.5, z: -7 };
  for (const [tag, side] of [["front", 1], ["back", -1]]) {
    // Seen side-on: the crab faces +x (screen-left); its front shell is on that side, its soft back on the other.
    await stage(C.x + side * 1.3, C.z, side > 0 ? -Math.PI / 2 : Math.PI / 2, ["thorn-crab"]);
    await page.evaluate(([cx, cz]) => { const e = window.__combat.rt.enemies.find(x => x.type.id === "thorn-crab" && Math.hypot(x.spawnX - cx, x.spawnZ - cz) < 0.5); Object.assign(e, { x: cx, z: cz, facing: Math.PI / 2, state: "chase", t: 0, stun: 0, cd: 0 }); e.type = { ...e.type, turn: 0.0001 }; }, [C.x, C.z]);
    await aimAt(C.x, C.z);
    await page.waitForTimeout(150);
    await page.mouse.down(); await page.waitForTimeout(40); await page.mouse.up();
    await page.waitForTimeout(110); await freeze(true);
    frames.push(await shot(`crab-${tag}`, await around(C.x, C.z, 420, 320, 0.62)));
    labels.push(tag === "front" ? "its front: the shell turns it aside (20%)" : "its back: the soft spot takes it all");
    await freeze(false);
  }
  // Its turn: you circle faster than it turns.
  await stage(C.x + 1.2, C.z, -Math.PI / 2, ["thorn-crab"]);
  await page.evaluate(([cx, cz]) => { const e = window.__combat.rt.enemies.find(x => x.type.id === "thorn-crab" && Math.hypot(x.spawnX - cx, x.spawnZ - cz) < 0.5); Object.assign(e, { x: cx, z: cz, facing: Math.PI, state: "chase", t: 0 }); }, [C.x, C.z]);
  await page.waitForTimeout(350); await freeze(true);
  frames.push(await shot("crab-turn", await around(C.x, C.z, 420, 320, 0.62))); labels.push("at its flank: it turns slowly to face you");
  tile(frames, labels, "02-crab-front-vs-flank", 3, "400x305+3+3");
}

// ── Mushroom beast: the cap swells (a landing ring, a line), the spore ball arcs over, bursts, the puddle ticks ──
if (wanted("mushroom")) {
  await open("subclass=guardian&zoom=0.95");
  await hud(false);
  const M = { x: -3, z: -15.5 };
  await stage(M.x, M.z - 5, 0, ["mushroom-beast"]);
  const frames = [], labels = [], box = await around(M.x, M.z - 2.4, 480, 380, 0.5);
  await holdWhen(() => window.__combat.rt.enemies.some(e => e.state === "windup" && e.t > e.move.windup * 0.8));
  frames.push(await shot("m-0", box)); labels.push("cap swells: the ring where it lands");
  await freeze(false);
  await holdWhen(() => window.__combat.rt.projectiles.some(p => p.arc && p.life < p.arc * 0.5));
  frames.push(await shot("m-1", box)); labels.push("the spore ball arcs over");
  await freeze(false);
  await holdWhen(() => window.__combat.rt.hazards.some(h => h.kind === "poison" && h.age > 0.08));
  frames.push(await shot("m-2", box)); labels.push("bursts on the ring");
  await freeze(false);
  await page.waitForTimeout(1200); await freeze(true);
  frames.push(await shot("m-3", box)); labels.push("the poison puddle bubbles, ticking");
  tile(frames, labels, "03-mushroom-lob-puddle", 2, "460x364+3+3");
}

// ── Rune wisp: a bolt down the marked line, its glyph where it lands; close in and it shimmers and blinks away ──
if (wanted("wisp")) {
  await open("subclass=guardian&zoom=0.95");
  await hud(false);
  const Wp = { x: 1, z: -12 };
  await stage(Wp.x, Wp.z - 5.5, 0, ["rune-wisp"]);
  const frames = [], labels = [], box = await around(Wp.x, Wp.z - 2.6, 480, 380, 0.5);
  await holdWhen(() => window.__combat.rt.enemies.some(e => e.state === "windup" && e.move.shape === "spit" && e.t > e.move.windup * 0.8));
  frames.push(await shot("w-0", box)); labels.push("runes spin up: the bolt's line");
  await freeze(false);
  await holdWhen(() => window.__combat.rt.projectiles.some(p => p.kind === "rune"));
  await freeze(false); await page.waitForTimeout(170); await freeze(true);
  frames.push(await shot("w-1", box)); labels.push("the rune bolt");
  await freeze(false);
  await holdWhen(() => window.__combat.rt.player.hurt > 0.2);
  await freeze(false); await page.waitForTimeout(140); await freeze(true); await page.waitForTimeout(60);
  frames.push(await shot("w-2", box)); labels.push("its glyph where it lands");
  await freeze(false);
  const w = await page.evaluate(() => { const e = window.__combat.rt.enemies[0]; return { x: e.x, z: e.z }; });
  await page.evaluate(([x, z]) => window.__move.teleport(x, z - 1.6, 0), [w.x, w.z]);
  await page.waitForTimeout(700);
  const box2 = await around(w.x, w.z, 480, 380, 0.5);
  await holdWhen(() => window.__combat.rt.enemies.some(e => e.state === "windup" && e.move.shape === "blink" && e.t > 0.2));
  frames.push(await shot("w-3", box2)); labels.push("too close: it shimmers");
  await freeze(false);
  await holdWhen(() => window.__combat.rt.enemies.some(e => e.state === "recover" && e.move.shape === "blink" && e.t > 0.08));
  frames.push(await shot("w-4", box2)); labels.push("and blinks 4 u away, rune circles");
  tile(frames, labels, "04-wisp-bolt-blink", 3, "440x348+3+3");
}

// ── Pollen sprites: a cloud rings you, one flashes and darts, bursts into slowing pollen; the swarm trickles in ──
if (wanted("pollen")) {
  await open("subclass=guardian&zoom=0.95");
  await hud(false);
  const Cl = { x: -2, z: -8 };
  await stage(Cl.x, Cl.z - 4.5, 0, ["pollen-sprite"]);
  const frames = [], labels = [], box = await around(Cl.x, Cl.z - 3.5, 540, 380, 0.55);
  await page.waitForTimeout(1300); await freeze(true);
  frames.push(await shot("p-0", box)); labels.push("a cloud of 13 rings you");
  await freeze(false);
  await holdWhen(() => window.__combat.rt.enemies.some(e => e.type.id === "pollen-sprite" && e.state === "windup" && e.t > 0.3));
  frames.push(await shot("p-1", box)); labels.push("one flashes (its eyes, its bud), lane");
  await freeze(false);
  await holdWhen(() => window.__combat.rt.hazards.some(h => h.kind === "pollen" && h.age > 0.12));
  frames.push(await shot("p-2", box)); labels.push("bursts into pollen: you're slowed");
  await freeze(false);
  await page.waitForTimeout(1600); await freeze(true);
  const speed = await page.evaluate(() => window.__combat.rt.player.speed.toFixed(2));
  frames.push(await shot("p-3", box)); labels.push(`more trickle in (move speed x${speed})`);
  tile(frames, labels, "05-pollen-swarm", 2, "520x366+3+3");
}

// ── Elder thorn crab: its name card and bar, the sweep (shell closed), the crack and the charge lane, enraged slams
// and their shockwave, the victory and its spoils ──
if (wanted("elder")) {
  await open("subclass=guardian&zoom=1");
  await hud(false);
  const E = { x: -11.5, z: -20.5 };
  await stage(E.x + 3.5, E.z - 1, -Math.PI / 2, ["elder-thorn-crab"]);
  const frames = [], labels = [];
  const wide = { x: 120, y: 44, width: 900, height: 640 };
  await page.waitForTimeout(500); await freeze(true);
  frames.push(await shot("e-0", wide)); labels.push("it joins the fight: its name card and bar");
  await freeze(false);
  await page.evaluate(() => { window.__combat.rt.banner = null; });
  await holdWhen(() => window.__combat.rt.enemies.some(e => e.state === "windup" && e.move.shape === "sweep" && e.t > e.move.windup * 0.75));
  frames.push(await shot("e-1", wide)); labels.push("shell closed: a claw sweep's sector");
  await freeze(false);
  await page.evaluate(() => { const e = window.__combat.rt.enemies[0]; e.hp = Math.round(e.type.hp * 0.59); });
  await holdWhen(() => window.__combat.rt.enemies[0].phase === 2 && window.__combat.rt.fx.length === 0);
  await freeze(false); await page.waitForTimeout(90); await freeze(true);
  frames.push(await shot("e-2", wide)); labels.push("60%: the shell cracks (chips, glow)");
  await freeze(false);
  await page.evaluate(() => { const e = window.__combat.rt.enemies[0]; e.move = e.type.attacks.find(m => m.shape === "charge"); e.state = "chase"; e.stun = 0; e.cycle = 2; });
  await holdWhen(() => window.__combat.rt.enemies.some(e => e.state === "windup" && e.move.shape === "charge" && e.t > e.move.windup * 0.7));
  frames.push(await shot("e-3", wide)); labels.push("cracked: it digs in, the charge's lane");
  await freeze(false);
  await page.evaluate(() => { const e = window.__combat.rt.enemies[0]; e.hp = Math.round(e.type.hp * 0.24); e.state = "chase"; e.stun = 0; });
  await holdWhen(() => window.__combat.rt.enemies.some(e => e.phase === 3 && e.state === "windup" && e.move.shape === "slam" && e.t > e.move.windup * 0.7), null, 12000);
  frames.push(await shot("e-4", wide)); labels.push("25%, enraged: a claw slam winds up");
  await freeze(false);
  await holdWhen(() => window.__combat.rt.hazards.some(h => h.kind === "wave" && h.age > 0.3));
  frames.push(await shot("e-5", wide)); labels.push("its shockwave runs out to 6 u");
  await freeze(false);
  await page.evaluate(() => { const rt = window.__combat.rt, e = rt.enemies[0]; e.hp = 1; });
  const p = await me();
  await aimAt(p.x, p.z - 1);
  for (let i = 0; i < 12; i++) { await page.mouse.down(); await page.waitForTimeout(60); await page.mouse.up(); await page.waitForTimeout(300); if (await page.evaluate(() => window.__combat.rt.enemies[0].state === "dead")) break; const q = await enemy(await page.evaluate(() => window.__combat.rt.enemies[0].id)); await aimAt(q.x, q.z); }
  await page.waitForTimeout(2500); await freeze(true);
  frames.push(await shot("e-6", wide)); labels.push("it yields: the spoils, rolled on the server");
  tile(frames, labels, "06-elder-phases", 2, "600x427+3+3");
}

// ── A full zone-1 fight: every outskirts mob awake round you, and its FPS ──
if (wanted("fight")) {
  await open("subclass=shaman&zoom=1.05");
  await hud(true);
  await stage(0, -14.5, Math.PI, ["shadow-fox", "thorn-crab", "mushroom-beast", "rune-wisp", "pollen-sprite", "elder-thorn-crab"]);
  await page.evaluate(() => { const rt = window.__combat.rt; for (const e of rt.enemies) { e.state = "chase"; e.t = 0; e.hp = 99999; e.leash = 99; e.type = { ...e.type, leashRadius: 60 }; } });
  for (const [k, dx] of [["1", 1.5], ["2", 0], ["3", -1.5]]) { await aimAt(dx, -13); await page.keyboard.press(k); await page.waitForTimeout(300); }
  await page.waitForTimeout(2500);
  await shot("fight", null).then(f => execFileSync("magick", [f, "-resize", "1000x", "-quality", "70", `${OUT}/07-zone1-fight.webp`]));
  console.log("wrote", `${OUT}/07-zone1-fight.webp`);
  await page.mouse.down();
  const fps = await page.evaluate(() => new Promise(done => {
    const times = []; let last = performance.now(); const t0 = last;
    const f = now => { times.push(now - last); last = now; if (now - t0 < 6000) requestAnimationFrame(f); else { times.sort((a, b) => a - b); const rt = window.__combat.rt; done({ avg: times.length / ((now - t0) / 1000), p99: 1000 / times[Math.floor(times.length * 0.99)], enemies: rt.enemies.filter(e => e.state !== "dead").length, hazards: rt.hazards.length }); } };
    requestAnimationFrame(f);
  }));
  await page.mouse.up();
  console.log(`FPS ${process.env.UNCAPPED ? "(uncapped)" : "(display cap)"}: ${fps.avg.toFixed(1)} average, ${fps.p99.toFixed(1)} 1% low over 6 s, ${fps.enemies} enemies alive, ${fps.hazards} hazards`);
}

await browser.close();
