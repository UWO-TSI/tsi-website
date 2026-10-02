// Classes v2 wave 0 evidence (specs/classes/design-sheet.md §4 "Evidence"): the ult's beats (Reduce flashing off and on),
// the demo kit's ability effects, the HUD (keys, the ult slot filling and ready, the mastery bar), the Path sheet with the
// Oracle's suggestion and the choice ceremony, and the aura with the nameplate in the village.
//   PORT=3129 node specs/evidence/classes/k0-shots.mjs [outDir] [only,only2,...]
// Headed Chromium off to the side (--window-position=2400,0), muted, real GPU; never brought to the front. The combat demo
// (?combat=demo&subclass=demo): a level-10 member on the dev kit with the classes_v2 flag on, signed out. The ult's clock is
// held per beat (window.__classDev.holdUlt) and frames tiled into WebPs with ImageMagick.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/classes", ONLY_LIST] = process.argv.slice(2);
const ONLY = ONLY_LIST ? new Set(ONLY_LIST.split(",")) : null;
const TMP = "/tmp/classes-k0-evidence";
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT ?? 3129, W = 1280, H = 940;
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
let ctx, page;
async function fresh(store = {}) {
  await ctx?.close();
  ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([look, store]) => { try {
    localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.liteMode.v1", "false");
    localStorage.removeItem("tsi.combatKeys.v3"); localStorage.setItem("tsi.hud.full.v1", "true");
    // A three-quarter side view (the fights read across the screen), the cursor free (no "click to look" hint).
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 1.05, pitch: 0.62, zoom: 1.12, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
    for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
  } catch {} }, [LOOK, store]);
  page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
  page.on("crash", () => console.log("page crashed"));
  page.on("close", () => console.log("page closed"));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|404/.test(m.text())) console.log("console", m.text().slice(0, 300)); });
}
async function open(query, ruins = true) {
  await page.goto(`http://localhost:${PORT}/lab/island?time=day&weather=clear&season=summer${ruins ? "&ruins=1" : ""}&combat=demo&${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(r => !!window.__move?.sim?.current && (!r || (!!window.__combatDev?.screenOf && !!window.__combat?.rt?.v2)) && !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), ruins) ? quiet + 1 : 0; }
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
const wanted = name => !ONLY || ONLY.has(name);
/** Clear the field, stand at (x, z), fill energy, and set foes at points round an aim spot. */
async function stage(x, z, foes = [], type = "shadow-fox") {
  await page.evaluate(([x, z, foes, type]) => {
    const rt = window.__combat.rt;
    rt.enemies = rt.enemies.filter(e => e.type.kind === "boss").map(e => ({ ...e, state: "idle", x: e.spawnX, z: e.spawnZ }));
    rt.projectiles = []; rt.units = []; rt.floaters = []; rt.blasts = []; rt.banner = null; rt.fx = [];
    Object.assign(rt.player, { hp: rt.player.maxHp, alive: true, energy: 100, weapon: "staff-oak" });
    rt.v2.cd = {}; rt.v2.meter = 0;
    window.__move.teleport(x, z, 0);
    foes.forEach(([fx, fz], i) => window.__combatDev.spawn(type, fx, fz, `k0-${type}-${i}-${Math.random().toString(36).slice(2, 6)}`));
  }, [x, z, foes, type]);
  await page.waitForTimeout(600);
}
const aimAt = async (x, z) => { const p = await page.evaluate(([x, z]) => window.__combatDev.screenOf(x, z), [x, z]); await page.mouse.move(p.x, p.y); return p; };
/** The world round a ground point, clear of the HUD. */
const around = async (x, z, w = 760, h = 470) => { const p = await page.evaluate(([x, z]) => window.__combatDev.screenOf(x, z), [x, z]); return { x: Math.max(0, Math.min(W - w, Math.round(p.x - w / 2))), y: Math.max(0, Math.min(H - h - 250, Math.round(p.y - h * 0.5))), width: w, height: h }; };

// ── The ult's beats: anticipation, the freeze with the flash frame, the speed lines, the slow motion, the follow-through ──
async function ultStrip(reduce) {
  await fresh(reduce ? { "tsi.reduceFlashing.v1": "true" } : { "tsi.reduceFlashing.v1": "false", "tsi.screenShake.v1": "full" });
  await open("subclass=demo&mastery=3");
  const me = { x: 2, z: -16 }, aim = { x: 2, z: -11 };
  await stage(me.x, me.z, [[1, -10.5], [3, -11], [2, -12], [2.8, -10], [1.2, -11.8]]);
  await page.evaluate(() => { for (const e of window.__combat.rt.enemies) e.status.hold = 99; });
  await aimAt(aim.x, aim.z);
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.__combat.rt.v2.meter = 100; });
  await page.waitForTimeout(250); // the ready glow
  const ready = await shot(await around(me.x, me.z + 2.5, 900, 500));
  await page.keyboard.press("f");
  await page.waitForFunction(() => !!window.__combat.rt.v2.cast, null, { timeout: 3000 });
  await page.evaluate(() => { window.__classDev.holdUlt = true; });
  const A = await page.evaluate(() => window.__combat.rt.v2.ult.anticipation_ms / 1000);
  const beats = [["anticipation", A * 0.7, 350], ["flash frame (A)", A + 0.01, 40], ["speed lines, freeze", A + 0.08, 30], ["slow motion, shake", A + 0.25, 60], ["lines fade", A + 0.32, 60], ["follow-through", A + 1.1, 700]];
  const files = [ready], labels = ["ready (edge glow)"];
  for (const [label, t, wait] of beats) {
    await page.evaluate(t => { window.__combat.rt.v2.cast.t = t; }, t);
    await page.waitForTimeout(wait);
    files.push(await shot(await around(me.x, me.z + 2.5, 900, 500))); labels.push(`${label} ${Math.round(t * 1000)} ms`);
  }
  await page.evaluate(() => { window.__classDev.holdUlt = false; });
  return { files, labels };
}

if (wanted("ult")) {
  const off = await ultStrip(false), on = await ultStrip(true);
  tile([...off.files, ...on.files], [...off.labels.map(l => `${l}`), ...on.labels.map(l => `Reduce flashing · ${l}`)], "K0-ult-strip", 7, "450x250+4+4");
}

// ── The demo kit's ability effects (one per input kind) ──
if (wanted("abilities")) {
  await fresh();
  await open("subclass=demo&mastery=3");
  const me = { x: 2, z: -16 }, files = [], labels = [];
  const fire = async (label, act, wait, foes = [[2, -11], [3, -12]]) => {
    await stage(me.x, me.z, foes);
    await page.evaluate(() => { for (const e of window.__combat.rt.enemies) { e.status.hold = 99; e.hp = 9999; } });
    await aimAt(2, -11.5);
    await act();
    await page.waitForTimeout(wait);
    files.push(await shot(await around(me.x, me.z + 2.4, 620, 380))); labels.push(label);
  };
  await fire("1 Arc Bolt (tap): wake + burst", async () => { await page.keyboard.press("1"); }, 650);
  await fire("1 1 Surge Nova (double tap): ring + lines", async () => { await page.keyboard.press("1"); await page.waitForTimeout(60); await page.keyboard.press("1"); }, 140, [[2, -14.5], [3.5, -15]]);
  await fire("2 Ward (hold): dome", async () => { await page.keyboard.down("2"); await page.waitForTimeout(260); }, 0);
  await page.keyboard.up("2");
  await fire("3 Starfall Slam (charge, heavy)", async () => { await page.keyboard.down("3"); await page.waitForTimeout(1200); await page.keyboard.up("3"); }, 120);
  await fire("3 slam: crack decal, smoke", async () => { await page.keyboard.down("3"); await page.waitForTimeout(1200); await page.keyboard.up("3"); }, 650);
  await fire("4 Familiar (toggle): rune, motes", async () => { await page.keyboard.press("4"); }, 350);
  tile(files, labels, "K0-ability-fx", 3, "620x380+4+4");
}

// ── The HUD: keys 1–5, the ult slot filling and ready, the mastery bar, a locked key ──
if (wanted("hud")) {
  await fresh();
  await open("subclass=demo&mastery=2");
  const crop = { x: (W - 720) / 2, y: H - 252, width: 720, height: 250 };
  const files = [], labels = [];
  const steps = [["hold your staff: the keys grey out", 20, 150, "sword-driftwood"], ["meter 35%, key 5 locked (mastery 3)", 35, 300, "staff-oak"], ["meter 80%, a key cooling", 80, 700, "staff-oak"], ["ult ready (pulsing ring)", 100, 1050, "staff-oak"]];
  for (const [label, meter, into, weapon] of steps) {
    await page.evaluate(([m, into, w]) => { const rt = window.__combat.rt, v = rt.v2; v.meter = m; v.progress = { into, needed: 1100 }; rt.player.weapon = w; window.__publishCombat(); }, [meter, into, weapon]);
    if (meter === 80) await page.keyboard.press("2");
    await page.waitForTimeout(450);
    files.push(await shot(crop)); labels.push(label);
  }
  tile(files, labels, "K0-hud", 2, "720x250+4+4");
}

// ── The Path sheet: the Oracle's suggestion (an unclear reading: two), the cards, the ceremony, the Kit tab ──
if (wanted("sheet")) {
  await fresh();
  await open("classes=v2&subclass=none&family=Arcane&type=INTP&unclear=JP&sheet=path", false);
  await page.waitForSelector('[data-testid="oracle-suggestion"]', { timeout: 30000 });
  const sheet = async () => { const b = await page.locator('[data-testid="path-sheet"]').boundingBox(); return { x: Math.max(0, b.x - 6), y: Math.max(0, b.y - 6), width: Math.min(W, b.width + 12), height: Math.min(H, b.height + 12) }; };
  const files = [await shot(await sheet())], labels = ["the Oracle's suggestion (an unclear reading)"];
  await page.locator('[data-testid="subclass-choice"] article').filter({ hasText: "Demo Adept" }).getByRole("button").click();
  await page.waitForTimeout(250);
  files.push(await shot(await sheet())); labels.push("confirm: locked until a redo");
  await page.locator('[data-testid="subclass-choice"] article').filter({ hasText: "Demo Adept" }).getByRole("button").click();
  await page.waitForSelector('[data-testid="class-ceremony"]', { timeout: 10000 });
  await page.waitForTimeout(900);
  files.push(await shot(await sheet())); labels.push("the ceremony: the weapon forms");
  tile(files, labels, "K0-subclass-sheet", 3, "+4+4");
}

// ── The aura and the nameplate in the village (mastery 20: tier 3 motes, the ground ring, the gold frame, Master title) ──
if (wanted("aura")) {
  await fresh({ "tsi.hud.full.v1": "false" });
  const files = [], labels = [];
  for (const [m, frame, label] of [[3, "", "mastery 3: motes, title"], [12, "bronze", "mastery 12: ground ring, Adept, bronze frame"], [20, "gold", "mastery 20: second motes, Master, gold frame"]]) {
    await open(`subclass=demo&mastery=${m}${frame ? `&frame=${frame}` : ""}`, false);
    await page.waitForSelector('[data-testid="nameplate-class"]', { timeout: 30000 });
    await page.waitForTimeout(1200);
    const p = await page.evaluate(() => window.__move.screen());
    files.push(await shot({ x: Math.max(0, Math.round(p.x - 210)), y: Math.max(0, Math.round(p.y - 300)), width: 420, height: 400 })); labels.push(label);
  }
  tile(files, labels, "K0-aura-nameplate", 3, "420x400+4+4");
}
await ctx?.close();
await browser.close();
