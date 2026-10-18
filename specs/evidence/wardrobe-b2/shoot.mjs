// Wardrobe batch 2 evidence from the engine (specs/playtest-round1.md "New wardrobe batch"). Headless Chromium (WebGL
// through ANGLE/Metal), muted, signed out, against the dev server with the Supabase env blanked, the browser lock held.
//   HOST=http://localhost:3184 node specs/evidence/wardrobe-b2/shoot.mjs <out_dir> <scene> [<scene> ...]
// Scenes:
//   lab      /lab/avatar: six hairs in their own colours (front, 3/4, side, back), every accessory worn (head and face on
//            the head, neck and front on the body), the hats over the thinnest and thickest hairstyles, the six whole faces
//   closet   the closet (wardrobe mode): the inventory answers with the starters plus #25's hair, the cowboy hat, #22's
//            ushanka and the vampire face, as an account that bought them; its Hair (Own colours, the second colour, the
//            colour wheel locked: its hint points at the shop's Hair colour wheel), Eyes and Accessories tabs
//   creator  the arrival's starting creator (create mode, nothing bought): its Hair, Eyes and Accessories tabs offer the
//            free items only
//   hatcut   /lab/avatar?sheet=hatcut: each hat with a hair cut over six hairstyles, with the cut hair drawn (&cut=0) and cut
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SCENES] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3184";
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
const DEFAULT = { skin: 3, hair: -1, eyes: "F1.1", mouth: "M1.1", extras: [], bangs: "", back: "hair_bob_pigtail", top: "top_tee", bottom: "bottom_shorts",
  onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {} };
const STARTERS = ["top_tee", "top_hoodie", "top_stripe_ls", "bottom_shorts", "bottom_trousers", "bottom_joggers", "shoes_slipon", "shoes_sneakers"];
const HAIRS = "hair_ribbon_bob,hair_wavy_half_up,hair_curly_pigtails,hair_emo_layers,hair_double_buns,hair_messy_low_pony";   // round 2: in their own colours

/** Open a creator tab (and wear `pick`, a tile's name), then screenshot it, and again scrolled to the bottom of the panel. */
async function tab(page, cat, name, pick) {
  await page.click(`[data-cat="${cat}"]`);
  await sleep(3000);
  if (pick) { await page.click(`[role="tabpanel"] ul button[aria-label="${pick}"]`); await sleep(3500); }
  await page.screenshot({ path: `${OUT}/${name}-1.png` });
  const more = await page.evaluate(() => {
    const el = [...document.querySelectorAll('section[role="dialog"] *')].find(e => e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY));
    if (!el) return 0;
    el.scrollTop = el.scrollHeight;
    return el.scrollHeight - el.clientHeight;
  });
  if (more > 40) { await sleep(1500); await page.screenshot({ path: `${OUT}/${name}-2.png` }); }
  console.log("tab", cat, await page.$$eval('[role="tabpanel"] ul button', els => els.length), "tiles,", await page.$$eval('[role="tabpanel"] ul button[data-locked]', els => els.length), "locked");
}

for (const scene of SCENES) {
  if (scene === "lab") {
    const page = await page0(1700, 1500);
    const bench = async (name, qs, wait = 16000) => {
      await page.goto(`${HOST}/lab/avatar?${qs}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("canvas", { timeout: 300000 });
      await sleep(wait);
      await page.locator("[data-sheet]").first().screenshot({ path: `${OUT}/${name}.png` });
      console.log("shot", name);
    };
    // three hairs a sheet: the canvas is the viewport, so a sheet taller than it draws only its top
    const hairs = HAIRS.split(",");
    await bench("hairs-1", `sheet=roblox&framing=head&skin=3&views=front,34,side,back&ids=${hairs.slice(0, 3).join(",")}`, 20000);
    await bench("hairs-2", `sheet=roblox&framing=head&skin=3&views=front,34,side,back&ids=${hairs.slice(3).join(",")}`, 20000);
    await bench("acc-head", "sheet=b2acc&groups=head,face&framing=hat&skin=3", 22000);
    await bench("acc-body", "sheet=b2acc&groups=neck,front&framing=body&skin=3", 14000);
    // hats over the hair, on the thinnest and the thickest of David's hairstyles (the fit is for the median)
    await bench("hats-thin-hair", "sheet=b2acc&groups=head&framing=hat&skin=3&style=hair_waves", 18000);
    await bench("hats-thick-hair", "sheet=b2acc&groups=head&framing=hat&skin=3&style=hair_messy_wolf", 18000);
    await bench("faces", "sheet=b2faces&framing=head&skins=3", 14000);
    await page.context().close();
  }
  if (scene === "hatcut") {
    const page = await page0(1700, 2150);
    for (const [name, qs] of [["hatcut-before", "&cut=0"], ["hatcut-after", ""]]) {
      await page.goto(`${HOST}/lab/avatar?sheet=hatcut&framing=hat&skin=3&cols=7${qs}`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("canvas", { timeout: 300000 });
      await sleep(26000);
      await page.locator("[data-sheet]").first().screenshot({ path: `${OUT}/${name}.png` });
      console.log("shot", name);
    }
    await page.context().close();
  }
  if (scene === "closet") {
    const c = await page0(1440, 900);
    const row = ref => ({ qty: 1, item: { catalogue_ref: ref, category: ref.startsWith("face:") ? "face" : ref.startsWith("hair") ? "hair" : "outfit" } });
    await c.route("**/api/economy/inventory", r => r.fulfill({ json: { ok: true, inventory: { groups: { outfits: [...STARTERS, "hair_curly_pigtails", "acc_cowboy_hat", "acc_ushanka_goggles", "face:vampire"].map(row) } } } }));
    await c.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
    await c.evaluate(look => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); localStorage.setItem("tsi.look.v1", look); },
      JSON.stringify({ ...DEFAULT, back: "hair_curly_pigtails", eyes: "caret_hash", mouth: "fangs", extras: ["stitches"], acc: { head: "acc_cowboy_hat" } }));
    await c.goto(`${HOST}/lab/island?sheet=closet&weather=clear&at=14:20`, { waitUntil: "domcontentloaded" });
    await c.addStyleTag({ content: HIDE }).catch(() => {});
    await c.waitForSelector('[data-cat="hair"]', { timeout: 300000 });
    await sleep(8000);
    await tab(c, "hair", "closet-hair", "Curly pigtails");
    await tab(c, "eyes", "closet-eyes", "Caret and hash");
    await tab(c, "accessories", "closet-accessories", "Ushanka and goggles");
    await c.context().close();
  }
  if (scene === "creator") {
    const page = await page0(1440, 900);
    await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); });
    await page.goto(`${HOST}/lab/island?arrival=1&weather=clear&at=14:20`, { waitUntil: "domcontentloaded" });
    await page.addStyleTag({ content: HIDE }).catch(() => {});
    await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
    await page.evaluate(() => { window.__arrival.skip(); window.__arrival.choices(40); });
    await page.waitForFunction(() => { const s = window.__arrival?.state(); return s?.phase === "creator" && s.t >= 2.2; }, null, { timeout: 300000, polling: 50 });
    await tab(page, "hair", "creator-hair");
    await tab(page, "eyes", "creator-eyes");
    await tab(page, "accessories", "creator-accessories");
    await page.context().close();
  }
}
await browser.close();
console.log(errors ? `errors: ${errors}` : "no page errors");
