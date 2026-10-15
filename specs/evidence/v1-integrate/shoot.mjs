// v1-integrate evidence on the merged tree (waves + wardrobe-prune + head-roblox). Headless Chromium (WebGL through
// ANGLE/Metal), muted, signed out, against the dev server with the Supabase env blanked, the shared browser lock held.
//   HOST=http://localhost:3178 node specs/evidence/v1-integrate/shoot.mjs <out_dir> <scene> [<scene> ...]
// Scenes:
//   residents  /lab/avatar: every authored resident, the HQ lead and the café owner (body), Jayden; and the default look
//              (DEFAULT_LOOK, look.ts) standing in the village
//   creator    the starting creator (the arrival's reflection): the Hair and Accessories tabs; and the closet's
//              Accessories (everything sold, the visor among them)
//   waves      one strip of the open water off the wharf (4 frames, half a second apart)
//   applicant  the applicant island's sea (main's water: the gate), if the page renders signed out
// The kept images are these PNGs as WebP (magick -quality 88). The applicant page needs Supabase, so it did not render here.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SCENES] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3178";
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
const tile = (files, out, row = true) => execFileSync("magick", [...files, row ? "+append" : "-append", out]);

/** DEFAULT_LOOK (lib/game/character/look.ts) as a saved look: palette defaults, David's bob with a pigtail. */
const DEFAULT = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", extras: [], bangs: "", back: "hair_bob_pigtail", top: "top_tee", bottom: "bottom_shorts",
  onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {} };
/** Jayden in components/recruit/ApplicantWorld.tsx (wardrobe-prune's face, head-roblox's hair). */
const JAYDEN = { skin: 6, hair: 0, eyes: "bean", mouth: "little_v", bangs: "", back: "hair_fluffy_boy", top: "top_tsi_crew", bottom: "bottom_trousers", shoes: "shoes_sneakers" };

/** A device on the island with a saved look (skips the creator), greeted, no gift, the camera held. */
async function island(query, look = DEFAULT) {
  const page = await page0(1280, 800);
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(l => {
    localStorage.clear();
    localStorage.setItem("tsi.look.v1", l);
    localStorage.setItem("tsi.welcomed.v1", "1");
    localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 0, pitch: 0.6, zoom: 1, sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false }));
  }, JSON.stringify(look));
  await page.goto(`${HOST}/lab/island?${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !!window.__move?.sim?.current, null, { timeout: 300000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }).catch(() => {});
  await sleep(6000);
  await page.evaluate(() => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } });
  return page;
}
async function stand(page, x, z, yaw, pitch, zoom) {
  await page.evaluate(([x, z, yaw, pitch, zoom]) => {
    window.__move.teleport(x, z, yaw);
    const o = window.__orbit.orbit;
    for (const k of ["target", "view"]) Object.assign(o[k], { yaw, pitch, zoom });
  }, [x, z, yaw, pitch, zoom]);
  await sleep(3500);
}
const WHARF = { x: 8, z: -19.5 };

for (const scene of SCENES) {
  if (scene === "residents") {
    const page = await page0(2000, 1700);
    const bench = async (name, qs, wait = 15000) => {
      await page.goto(`${HOST}/lab/avatar?${qs}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("canvas", { timeout: 300000 });
      await sleep(wait);
      await page.locator("[data-sheet]").first().screenshot({ path: `${OUT}/${name}.png` });
      console.log("shot", name);
    };
    await bench("01-residents-body", "sheet=residents&framing=body", 25000);
    await bench("02-jayden", `sheet=look&label=Jayden&framing=body&look=${encodeURIComponent(JSON.stringify(JAYDEN))}`);
    await page.context().close();
    const p = await island("at=13:00&weather=clear");
    const s = await p.evaluate(() => { const s = window.__move.sim.current.state; return [s.x, s.z]; });
    await stand(p, s[0], s[1], Math.PI * 0.85, 0.3, 0.45);
    // Turned to face the camera (the orbit stays where it is).
    await p.evaluate(([x, z, yaw]) => window.__move.teleport(x, z, yaw), [s[0], s[1], Math.PI * 1.85]);
    await sleep(2500);
    await p.screenshot({ path: `${OUT}/03-default-look-village.png` });
    console.log("shot 03-default-look-village");
    await p.context().close();
  }
  if (scene === "creator") {
    const page = await page0(1440, 900);
    await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); });
    await page.goto(`${HOST}/lab/island?arrival=1&weather=clear&at=14:20`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" }).catch(() => {});
    await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
    await page.evaluate(() => { window.__arrival.skip(); window.__arrival.choices(40); });
    await page.waitForFunction(() => { const s = window.__arrival?.state(); return s?.phase === "creator" && s.t >= 2.2; }, null, { timeout: 300000, polling: 50 });
    const files = [];
    for (const cat of ["hair", "accessories"]) {
      await page.click(`[data-cat="${cat}"]`);
      await sleep(cat === "hair" ? 25000 : 3500);   // 21 hairstyle portraits render one after another
      const tiles = await page.$$eval('[role="tabpanel"] ul button', els => els.map(e => e.getAttribute("aria-label")));
      console.log("creator", cat, tiles.length, JSON.stringify(tiles));
      files.push(`${OUT}/creator-${cat}.png`);
      await page.screenshot({ path: files.at(-1) });
    }
    tile(files, `${OUT}/04-creator-hair-accessories.png`);
    for (const f of files) execFileSync("rm", [f]);
    await page.context().close();
    // The closet (wardrobe mode, the starters only): every accessory the catalogue holds, the unowned locked.
    const c = await page0(1440, 900);
    await c.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
    await c.evaluate(look => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); localStorage.setItem("tsi.look.v1", look); }, JSON.stringify(DEFAULT));
    await c.goto(`${HOST}/lab/island?sheet=closet&weather=clear&at=14:20`, { waitUntil: "domcontentloaded" });
    await c.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" }).catch(() => {});
    await c.waitForSelector('[data-cat="accessories"]', { timeout: 300000 });
    await sleep(6000);
    await c.click('[data-cat="accessories"]');
    await sleep(3000);
    console.log("closet accessories", JSON.stringify(await c.$$eval('[role="tabpanel"] ul button', els => els.map(e => e.getAttribute("aria-label")))));
    await c.screenshot({ path: `${OUT}/05-closet-accessories.png` });
    await c.context().close();
  }
  if (scene === "waves") {
    const page = await island("at=13:00&weather=clear");
    await stand(page, WHARF.x - 1.2, WHARF.z - 2.4, Math.PI + 0.25, 0.35, 1.6);
    const files = [], t0 = Date.now();
    for (let i = 0; i < 4; i++) {
      const wait = t0 + i * 500 - Date.now();
      if (wait > 0) await sleep(wait);
      files.push(`${OUT}/w${i + 1}.png`);
      await page.screenshot({ path: files.at(-1) });
    }
    execFileSync("magick", ["(", files[0], files[1], "+append", ")", "(", files[2], files[3], "+append", ")", "-append", "-resize", "50%", `${OUT}/06-wave-strip.png`]);
    for (const f of files) execFileSync("rm", [f]);
    console.log("strip 06-wave-strip");
    await page.context().close();
  }
  if (scene === "applicant") {
    const page = await page0(1280, 800);
    await page.goto(`${HOST}/student/apply`, { waitUntil: "domcontentloaded" });
    const ok = await page.waitForSelector("canvas", { timeout: 90000 }).then(() => true, () => false);
    if (ok) { await sleep(20000); await page.screenshot({ path: `${OUT}/07-applicant-island-main-water.png` }); console.log("shot 07-applicant-island-main-water"); }
    else console.log("applicant: no canvas signed out (", page.url(), ")");
    await page.context().close();
  }
}
await browser.close();
console.log(errors ? `errors: ${errors}` : "no page errors");
