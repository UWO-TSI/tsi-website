// The class playtest harness's evidence (specs/classes/playtest.md): the picker, the ruins with the dev panel, the
// spawner with damage numbers and the DPS meter, and key cards; on the way it checks the flows David uses (Play in the
// ruins puts the signature weapon in hand, the panel switches class and mastery in place, god mode, slow motion, a note).
//   PORT=3137 node specs/evidence/class-playtest/shots.mjs [outDir]
// Headed Chromium off to the side (--window-position=2400,0), muted, never brought to the front; tiles via ImageMagick.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/class-playtest"] = process.argv.slice(2);
const TMP = "/tmp/class-playtest-evidence", PORT = process.env.PORT ?? 3137, W = 1440, H = 900;
rmSync(TMP, { recursive: true, force: true }); mkdirSync(TMP, { recursive: true }); mkdirSync(OUT, { recursive: true });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--window-position=2400,0", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
await ctx.addInitScript(look => { try {
  if (sessionStorage.getItem("seeded")) return;
  sessionStorage.setItem("seeded", "1");
  localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.liteMode.v1", "false");
  localStorage.removeItem("tsi.combatKeys.v3"); localStorage.setItem("tsi.hud.full.v1", "true"); localStorage.removeItem("tsi.playtest.notes.v1"); localStorage.removeItem("tsi.held.v1");
  localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 0, pitch: 0.62, zoom: 1.05, mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
} catch {} }, LOOK);
const page = await ctx.newPage();
const problems = [];
page.on("pageerror", e => problems.push(`pageerror ${e.message.slice(0, 200)}`));
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|404|favicon/.test(m.text())) problems.push(`console ${m.text().slice(0, 200)}`); });
const check = (ok, what) => { console.log(ok ? "ok  " : "FAIL", what); if (!ok) process.exitCode = 1; };
let n = 0;
const shot = async (clip, full = false) => { const f = `${TMP}/${n++}.png`; await page.screenshot({ path: f, ...(clip ? { clip } : {}), fullPage: full }); return f; };
const webp = (file, name, resize) => { execFileSync("magick", [file, ...(resize ? ["-resize", resize] : []), "-quality", "80", `${OUT}/${name}.webp`]); console.log("wrote", `${OUT}/${name}.webp`); };
const rt = () => page.evaluate(() => { const r = window.__combat.rt; return { weapon: r.player.weapon, kit: r.v2?.kit.key ?? null, mastery: r.v2?.mastery ?? null, meter: r.v2?.meter ?? null, hp: r.player.hp, maxHp: r.player.maxHp, energy: r.player.energy, enemies: r.enemies.length }; });
async function ready() {
  await page.waitForSelector("canvas", { timeout: 240000 });
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(() => !!window.__move?.sim?.current && !!window.__combatDev?.screenOf && !!window.__combat?.rt?.v2 && !document.querySelector('[role="status"]')?.textContent?.includes("Preparing")) ? quiet + 1 : 0; }
  await page.waitForTimeout(2500);
}
const button = name => page.getByRole("button", { name, exact: true });
const panel = () => page.locator('section[aria-label="Class playtest"]');

// ONLY=cards (CARDS=a,b): straight into those kits for their key cards, then a note and the picker (a shorter run).
if (process.env.ONLY === "cards") {
  for (const kit of (process.env.CARDS ?? "elementalist,transmuter").split(",")) {
    await page.goto(`http://localhost:${PORT}/lab/island?combat=demo&classes=v2&subclass=${kit}&mastery=20&traits=all&ruins=1&playtest=1`, { waitUntil: "domcontentloaded" });
    await ready();
    const s = await rt();
    const type = await page.evaluate(() => window.__combat.rt.v2.kit.signature.type);
    check(s.kit === kit && s.weapon === `${type}-1`, `${kit} holds ${s.weapon}`);
    check(await page.locator('[data-testid="playtest-keycard"]').getByText("learn it by defeating").count() === 0, "every skill is open");
    const b = await page.locator('[data-testid="playtest-keycard"]').boundingBox(), m = await page.locator('section[aria-label="Damage meter"]').boundingBox();
    webp(await shot({ x: 0, y: Math.max(0, b.y - 12), width: Math.ceil(b.width + 40), height: Math.ceil(m.y + m.height - b.y + 24) }), `keycard-${kit}`);
  }
  await page.keyboard.press("n");
  await page.getByLabel("Note").fill("Golem slam needs more weight");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await page.goto(`http://localhost:${PORT}/lab/classes`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Golem slam needs more weight", { timeout: 60000 });
  check(true, "the note is listed on /lab/classes with its class");
  await page.locator(".ld-overlay").waitFor({ state: "detached", timeout: 15000 }); // the site's own loading screen
  webp(await shot(null, true), "picker", "1200x");
  check(!problems.some(p => /Maximum update depth/.test(p)), "no render loop");
  if (problems.length) console.log(problems.join("\n"));
  await browser.close();
  process.exit();
}

// ── The picker → Play in the ruins ──
await page.goto(`http://localhost:${PORT}/lab/classes`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Play in the ruins", { timeout: 120000 });
check(await page.locator('[aria-label="Arcane"] button[aria-pressed]').count() === 4, "the four Arcane kits are pickable");
const ready16 = await page.locator("main section[aria-label] button[aria-pressed]").count(), coming = await page.locator("[data-coming]").count();
check(ready16 + coming === 16, `16 cards: ${ready16} ready, ${coming} coming`);
await page.locator('[aria-label="Arcane"] button', { hasText: "Elementalist" }).click();
await page.getByRole("group", { name: "Mastery" }).getByRole("button", { name: "20" }).click();
await Promise.all([page.waitForURL(/\/lab\/island\?/, { timeout: 60000 }), button("Play in the ruins").click()]);
check(/subclass=elementalist/.test(page.url()) && /ruins=1/.test(page.url()) && /classes=v2/.test(page.url()) && /playtest=1/.test(page.url()), `Play in the ruins opens ${new URL(page.url()).search}`);
await ready();
let s = await rt();
check(s.kit === "elementalist" && s.mastery === 20 && s.weapon.startsWith("prism-staff"), `in the ruins as ${s.kit} M${s.mastery} holding ${s.weapon}`);

// ── The dev panel ──
await page.getByRole("button", { name: "Developer view options" }).click();
await panel().waitFor();
await page.waitForTimeout(600);
webp(await shot(), "ruins-dev-panel", "1200x");

// ── Switch class and mastery in place ──
await panel().getByLabel("Subclass").selectOption("necromancer");
await page.waitForFunction(() => window.__combat.rt.v2?.kit.key === "necromancer", null, { timeout: 15000 });
await page.waitForTimeout(800);
s = await rt();
check(s.kit === "necromancer" && s.mastery === 20 && s.weapon.startsWith("bone-tome"), `switched to ${s.kit} M${s.mastery} holding ${s.weapon} without a reload`);
await panel().getByLabel("Mastery").selectOption("3");
await page.waitForFunction(() => window.__combat.rt.v2?.mastery === 3, null, { timeout: 15000 });
s = await rt();
check(s.kit === "necromancer" && s.mastery === 3 && s.weapon.startsWith("bone-tome"), `mastery ${s.mastery}, still holding ${s.weapon}`);
check(/subclass=necromancer/.test(page.url()) && /mastery=3/.test(page.url()), "the address follows, so a reload keeps it");
await panel().getByLabel("Subclass").selectOption("elementalist");
await page.waitForFunction(() => window.__combat.rt.v2?.kit.key === "elementalist", null, { timeout: 15000 });
await panel().getByLabel("Mastery").selectOption("20");
await page.waitForFunction(() => window.__combat.rt.v2?.mastery === 20, null, { timeout: 15000 });
await page.waitForTimeout(600);

// ── Toggles ──
await panel().getByRole("button", { name: "Fill ult" }).click();
check((await rt()).meter === 100, "Fill ult fills the meter");
await panel().getByRole("button", { name: "Infinite mana" }).click();

// ── The spawner: dummies, a pack, the meter and damage numbers ──
await panel().getByRole("button", { name: "Clear all" }).click();
check((await rt()).enemies === 0, "Clear all empties the field");
for (const name of ["Dummy", "Shell dummy", "Ranged dummy"]) await panel().getByRole("button", { name, exact: true }).click();
check((await rt()).enemies === 3, "three dummies at the gate");
await page.evaluate(() => window.__move.teleport(-3, -23.2, 0));
await page.waitForTimeout(900);
// Slow motion: the ranged dummy's bolt crosses the ground at a quarter of its speed.
const boltSpeed = async () => {
  // A fresh bolt (most of its flight ahead), timed over 300 ms of wall clock.
  await page.waitForFunction(() => window.__combat.rt.projectiles.some(p => p.from === "enemy" && p.life > 1.7), null, { timeout: 25000, polling: 16 });
  const a = await page.evaluate(() => { const p = window.__combat.rt.projectiles.find(x => x.from === "enemy" && x.life > 1.7); return { id: p.id, x: p.x, z: p.z, t: performance.now() }; });
  await page.waitForTimeout(300);
  const b = await page.evaluate(id => { const p = window.__combat.rt.projectiles.find(x => x.id === id); return p ? { x: p.x, z: p.z, t: performance.now() } : null; }, a.id);
  return b ? Math.hypot(b.x - a.x, b.z - a.z) / ((b.t - a.t) / 1000) : NaN;
};
await panel().getByRole("button", { name: "God mode" }).click();
const normal = await boltSpeed();
await panel().getByRole("button", { name: "0.25×" }).click();
await page.evaluate(() => { window.__combat.rt.projectiles = []; });
const slowed = await boltSpeed();
await panel().getByRole("button", { name: "1×" }).click();
check(normal > 3.5 && slowed < normal * 0.4, `slow motion: a bolt at ${normal.toFixed(1)} u/s, ${slowed.toFixed(1)} u/s at 0.25×`);
const hp0 = (await rt()).hp;
const aim = await page.evaluate(() => window.__combatDev.screenOf(-3, -18.5));
await page.mouse.move(aim.x, aim.y);
for (let i = 0; i < 10; i++) { await page.keyboard.press(i % 2 ? "3" : "1"); await page.waitForTimeout(260); }
await page.mouse.down(); await page.waitForTimeout(1200); await page.mouse.up();
await page.waitForTimeout(150);
const dps = await page.locator('[data-testid="playtest-dps"]').textContent();
check(Number(dps) > 0, `DPS reads ${dps}`);
const after = await rt();
check(after.hp === after.maxHp && hp0 === after.maxHp, "god mode: the ranged dummy's bolts take no health");
webp(await shot(), "spawner-damage-numbers", "1200x");

// ── Key cards ──
await page.getByRole("button", { name: "Developer view options" }).click(); // close the panel
await page.waitForTimeout(400);
const card = async name => { const b = await page.locator('[data-testid="playtest-keycard"]').boundingBox(); const m = await page.locator('section[aria-label="Damage meter"]').boundingBox(); webp(await shot({ x: 0, y: Math.max(0, b.y - 12), width: Math.ceil(b.width + 40), height: Math.ceil(m.y + m.height - b.y + 24) }), name); };
await card("keycard-elementalist");
await page.keyboard.press("h");
await page.waitForTimeout(200);
check(await page.locator('[data-testid="playtest-keycard"]').count() === 0, "H hides the key card");
await page.keyboard.press("h");
await page.getByRole("button", { name: "Developer view options" }).click();
await panel().getByLabel("Subclass").selectOption("transmuter");
await page.waitForFunction(() => window.__combat.rt.v2?.kit.key === "transmuter", null, { timeout: 15000 });
await page.getByRole("button", { name: "Developer view options" }).click();
await page.waitForTimeout(800);
s = await rt();
check(s.weapon.startsWith("tooth-charm"), `the Transmuter holds ${s.weapon}`);
check(await page.locator('[data-testid="playtest-keycard"]').getByText("learn it by defeating").count() === 0, "every form is learned");
await card("keycard-transmuter");

// ── A note → /lab/classes ──
await page.keyboard.press("n");
await page.getByLabel("Note").fill("Golem slam needs more weight");
await page.keyboard.press("Enter");
await page.waitForTimeout(300);
await page.goto(`http://localhost:${PORT}/lab/classes`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("text=Golem slam needs more weight", { timeout: 60000 });
check(true, "the note is listed on /lab/classes with its class");
await page.locator(".ld-overlay").waitFor({ state: "detached", timeout: 15000 }); // the site's own loading screen
webp(await shot(null, true), "picker", "1200x");

check(!problems.some(p => /Maximum update depth/.test(p)), "no render loop");
if (problems.length) console.log(problems.join("\n"));
await browser.close();
