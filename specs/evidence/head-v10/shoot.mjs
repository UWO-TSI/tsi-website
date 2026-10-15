// Head-v10 evidence from the engine (specs/characters/head-v10.md). Headless Chromium (WebGL through ANGLE/Metal),
// muted, signed out, against the dev server with the Supabase env blanked, the shared browser lock held.
//   HOST=http://localhost:3180 node specs/evidence/head-v10/shoot.mjs <out_dir> <scene> [<scene> ...]
// Scenes:
//   creator     the closet's Hair tab (the studio creator, Full): each of the 21 picked in turn, the portrait saved as
//               <out>/creator/<id>.png; then the panel (the static tiles, the presets and the colour wheel) before and
//               after a pick on the wheel
//   reflection  the arrival's reflection creator: its Hair tab, the wheel locked (a new account owns no dye), a preset
//               picked
//   tiers       detail by situation on the island with 24 bots: play at the default zoom and close in (LOD 1), zoomed
//               out (LOD 2), photo mode (Full up close): a frame each, and the tier counts (PerfProbe: fullMeshes,
//               lodMeshes, lod2Meshes) over 2 s, in <out>/tiers.json
//   lab         /lab/avatar: the residents and the HQ lead and café owner (body), the three default styles, five hairstyles
//               at Full, LOD 1 and LOD 2 (?charlod=0|1|2), and David's widest and lowest face parts on the bare head
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SCENES] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3180";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let errors = 0;
async function page0(w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", e => { errors++; console.log("pageerror", e.message.slice(0, 300)); });
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|127\.0\.0\.1:9|ERR_CONNECTION/i.test(m.text())) { errors++; console.log("console", m.text().slice(0, 400)); } });
  return page;
}
const HIDE = "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }";
const DEFAULT = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", extras: [], bangs: "", back: "hair_bob_pigtail", top: "top_tee", bottom: "bottom_shorts",
  onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {} };

/** Drag across the wheel's disc from its centre toward (dx, dy) (fractions of its radius). */
async function wheelPick(page, dx, dy) {
  const disc = page.locator('[aria-label="Hue and saturation (arrow keys)"]').first();
  await disc.scrollIntoViewIfNeeded();
  const b = await disc.boundingBox();
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2, r = b.width / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let k = 1; k <= 8; k++) await page.mouse.move(cx + (dx * r * k) / 8, cy + (dy * r * k) / 8);
  await page.mouse.up();
}

const EXTREMES = [["swirl", "drumstick"], ["doll_lash", "drool"], ["offset", "tired_drool"], ["chill", "long_drool"]];

for (const scene of SCENES) {
  if (scene === "lab") {
    mkdirSync(`${OUT}/lab`, { recursive: true });
    const page = await page0(1700, 1500);
    const bench = async (name, qs, wait = 14000, clip = true) => {
      await page.goto(`${HOST}/lab/avatar?${qs}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("canvas", { timeout: 300000 });
      await sleep(wait);
      await (clip ? page.locator("[data-sheet]").first() : page).screenshot({ path: `${OUT}/lab/${name}.png` });
      console.log("shot", name);
    };
    await bench("residents-body", "sheet=residents&framing=body", 25000);
    await bench("styles", "sheet=styles");
    const ids = "hair_windy_bob,hair_hime_short,hair_messy_wolf,hair_long_pigtails,hair_layered_shag";
    for (const t of [0, 1, 2]) await bench(`lod${t}`, `sheet=roblox&framing=head&skin=3&hair=2&views=34,back&ids=${ids}&charlod=${t}`);
    for (const [eyes, mouth] of EXTREMES) {
      const look = { ...DEFAULT, back: "hair_baby_sprout", eyes, mouth };
      await bench(`face-${eyes}-${mouth}`, `sheet=look&framing=head&label=${eyes}+${mouth}&look=${encodeURIComponent(JSON.stringify(look))}`, 9000);
    }
    await page.context().close();
  }
  if (scene === "creator") {
    mkdirSync(`${OUT}/creator`, { recursive: true });
    const c = await page0(1440, 900);
    // Signed out the closet owns the starters; the wheel opens with any shop dye (David: "Unlock by buying a dye"):
    // the inventory answers with the starters and one dye, as an account that bought one would.
    const starters = ["top_tee", "top_hoodie", "top_stripe_ls", "bottom_shorts", "bottom_trousers", "bottom_joggers", "shoes_slipon", "shoes_sneakers"];
    const row = ref => ({ qty: 1, item: { catalogue_ref: ref, category: ref.startsWith("hair:") ? "hair" : "outfit" } });
    await c.route("**/api/economy/inventory", r => r.fulfill({ json: { ok: true, inventory: { groups: { outfits: [...starters.map(row), row("hair:10")] } } } }));
    await c.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
    await c.evaluate(look => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); localStorage.setItem("tsi.look.v1", look); }, JSON.stringify(DEFAULT));
    await c.goto(`${HOST}/lab/island?sheet=closet&weather=clear&at=14:20`, { waitUntil: "domcontentloaded" });
    await c.addStyleTag({ content: HIDE }).catch(() => {});
    await c.waitForSelector('[data-cat="hair"]', { timeout: 300000 });
    await sleep(6000);
    await c.click('[data-cat="hair"]');
    await sleep(2500);
    // The tiles show at once: static pictures, none baking.
    const t0 = Date.now();
    await c.waitForFunction(() => { const imgs = [...document.querySelectorAll('[role="tabpanel"] ul button img')]; return imgs.length >= 21 && imgs.every(i => i.complete && i.naturalWidth > 0); }, null, { timeout: 60000, polling: 50 });
    const tiles = await c.$$eval('[role="tabpanel"] ul button', els => els.map(e => e.getAttribute("aria-label")));
    console.log("creator hair tiles", tiles.length, "loaded in", Date.now() - t0, "ms after the tab was open;", await c.$$eval('[role="tabpanel"] [class*="baking"]', e => e.length), "baking");
    await c.screenshot({ path: `${OUT}/creator-panel.png` });
    const canvas = c.locator('section[role="dialog"] canvas').first();
    for (let i = 0; i < tiles.length; i++) {
      await c.locator('[role="tabpanel"] ul button').nth(i).click();
      await sleep(3200);
      await canvas.screenshot({ path: `${OUT}/creator/${String(i + 1).padStart(2, "0")}.png` });
    }
    console.log("creator portraits", tiles.length);
    // The wheel: a teal, then a pale pink, the preview re-tints, the tiles stay as they are.
    await c.locator('[role="tabpanel"] ul button').nth(16).click();      // back to the bob with a pigtail
    await sleep(2500);
    await wheelPick(c, -0.62, 0.55);
    await sleep(2500);
    await c.screenshot({ path: `${OUT}/creator-wheel-1.png` });
    await wheelPick(c, 0.95, 0.85);
    await c.locator('input[type="range"]').last().fill("96");
    await sleep(2500);
    await c.screenshot({ path: `${OUT}/creator-wheel-2.png` });
    console.log("wheel hex", await c.locator('input[aria-label="Hex colour"]').inputValue());
    await c.context().close();
  }
  if (scene === "reflection") {
    const page = await page0(1440, 900);
    await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); });
    await page.goto(`${HOST}/lab/island?arrival=1&weather=clear&at=14:20`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: HIDE }).catch(() => {});
    await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
    await page.evaluate(() => { window.__arrival.skip(); window.__arrival.choices(40); });
    await page.waitForFunction(() => { const s = window.__arrival?.state(); return s?.phase === "creator" && s.t >= 2.2; }, null, { timeout: 300000, polling: 50 });
    await page.click('[data-cat="hair"]');
    await sleep(4000);
    await page.screenshot({ path: `${OUT}/reflection-1.png` });
    await page.locator('[role="group"][aria-label="hair colours"] button').nth(5).click();
    await sleep(3500);
    await page.locator('[data-locked] p').first().scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${OUT}/reflection-2.png` });
    console.log("reflection wheel", await page.locator('[class*="wheel"][data-locked]').count() ? "locked" : "open");
    await page.context().close();
  }
  if (scene === "tiers") {
    const page = await page0(1280, 800);
    await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
    await page.evaluate(l => {
      localStorage.clear();
      localStorage.setItem("tsi.look.v1", l);
      localStorage.setItem("tsi.welcomed.v1", "1");
      localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
      localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 0, pitch: 0.6, zoom: 1, sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false }));
    }, JSON.stringify(DEFAULT));
    await page.goto(`${HOST}/lab/island?time=day&weather=clear&season=summer&bots=24`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: HIDE }).catch(() => {});
    await page.waitForFunction(() => !!window.__perf && !!window.__move?.sim?.current && (window.__net?.remotes().length ?? 0) > 0, null, { timeout: 300000, polling: 500 });
    await sleep(8000);
    await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
    const counts = {};
    const measure = async name => {
      await page.evaluate(() => window.__perf.begin());
      await sleep(2000);
      const s = await page.evaluate(() => window.__perf.end());
      counts[name] = { full: s.fullMeshes.median, lod1and2: s.lodMeshes.median, lod2: s.lod2Meshes.median, triangles: s.triangles.median, frames: s.frames };
      console.log("tiers", name, JSON.stringify(counts[name]));
    };
    const zoom = async z => { await page.evaluate(z => { const o = window.__orbit.orbit; o.target.zoom = o.view.zoom = z; o.target.pitch = o.view.pitch = 0.6; }, z); await sleep(2500); };
    await zoom(1);
    await measure("play-zoom-1");
    await page.screenshot({ path: `${OUT}/tiers-play.png` });
    await zoom(0.6);
    await measure("play-zoom-0.6");
    await page.screenshot({ path: `${OUT}/tiers-play-close.png` });
    await zoom(1.6);
    await measure("zoomed-out-1.6");
    await page.screenshot({ path: `${OUT}/tiers-zoomed-out.png` });
    await zoom(1);
    await page.mouse.click(640, 400);
    await page.keyboard.press("p");
    await sleep(3500);
    await measure("photo-mode");
    await page.screenshot({ path: `${OUT}/tiers-photo.png` });
    writeFileSync(`${OUT}/tiers.json`, JSON.stringify(counts, null, 1));
    await page.context().close();
  }
}
await browser.close();
console.log(errors ? `errors: ${errors}` : "no page errors");
