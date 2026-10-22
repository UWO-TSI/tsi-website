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
//   round5   the round-5 hat cut: each covering hat over #03 long, #10 short, #27 buns, #25 curly pigtails and #23's bob,
//            front, 3/4, side, back, high and low; the rims of #18, #21, #22 and #24 close up; #04's visor front and 3/4
//   visorlogo  #04's logo, the arches flipped to a W: the visor over #03, #10 and #27 at front, 3/4 and high; the logo close
//            up; at LOD 1
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
const HAIRS = "hair_ribbon_bob,hair_wavy_half_up,hair_curly_pigtails,hair_emo_layers,hair_double_buns,hair_vkei";   // round 2: in their own colours

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
  if (scene === "round5") {
    const R5_HAIRS = ["hair_long_scruffy", "hair_messy_wolf", "hair_double_buns", "hair_curly_pigtails", "hair_ribbon_bob"];
    const ids = hat => R5_HAIRS.map(h => `${h}%2B${hat}`).join(",");
    const page = await page0(1800, 1700);
    const only = process.env.R5_ONLY?.split(",");                   // R5_ONLY=r5-acc_propeller_cap,...: those shots alone
    const bench = async (name, qs, [w, h] = [1800, 1700], wait = 22000) => {
      if (only && !only.includes(name)) return;
      await page.setViewportSize({ width: w, height: h });         // the canvas is the viewport: the whole sheet in it
      await page.goto(`${HOST}/lab/avatar?sheet=roblox&framing=hat&skin=3&${qs}`, { waitUntil: "domcontentloaded" });
      // the lab's bar and the dev badge hidden; long labels kept to their cells (a column never widens past the canvas)
      await page.addStyleTag({ content: `${HIDE} nav { display: none !important } [data-sheet] > * { min-width: 0 } [data-sheet] figcaption { font-size: 10px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }` }).catch(() => {});
      await page.waitForSelector("canvas", { timeout: 300000 });
      await sleep(wait);
      await page.locator("[data-sheet]").first().screenshot({ path: `${OUT}/${name}.png` });
      console.log("shot", name);
    };
    for (const hat of ["acc_propeller_cap", "acc_drawn_top_hat", "acc_cowboy_hat", "acc_woven_hat", "acc_red_band_straw_hat", "acc_ushanka_goggles"])
      await bench(`r5-${hat}`, `views=front,34,side,back,high,low&cols=6&ids=${ids(hat)}`);
    // the rims close up (David: from no angle a cut edge, a stub or a scalp gap between the hair and the hat)
    for (const hat of ["acc_drawn_top_hat", "acc_cowboy_hat", "acc_ushanka_goggles", "acc_red_band_straw_hat"])
      await bench(`r5-zoom-${hat}`, `views=34,side,back,low&cols=4&zoom=1.6&look=0.76&ids=${ids(hat)}`, [1400, 1900]);
    // #10 with no hat: its nape (the stepped edge low at the back of the head) is the hairstyle's own, not the cut
    await bench("r5-nohat", "views=34,side,back&cols=3&ids=hair_messy_wolf", [1200, 520]);
    await bench("r5-visor", `views=front,34,high&cols=3&zoom=1.7&look=0.9&ids=${ids("acc_crew_visor")}`, [1200, 2150]);
    await page.context().close();
  }
  if (scene === "visorlogo") {
    // #04's logo (David, round 5: "make it the mcdonald m but flip it so its w"): the visor over #03, #10 and #27 at front,
    // 3/4 and high; the logo close up; and at LOD 1 (characters seen small)
    const ids = ["hair_long_scruffy", "hair_messy_wolf", "hair_double_buns"].map(h => `${h}%2Bacc_crew_visor`).join(",");
    const page = await page0(1200, 1300);
    const bench = async (name, qs, [w, h], wait = 22000) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`${HOST}/lab/avatar?sheet=roblox&framing=hat&skin=3&${qs}`, { waitUntil: "domcontentloaded" });
      await page.addStyleTag({ content: `${HIDE} nav { display: none !important } [data-sheet] > * { min-width: 0 } [data-sheet] figcaption { font-size: 10px !important; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }` }).catch(() => {});
      await page.waitForSelector("canvas", { timeout: 300000 });
      await sleep(wait);
      await page.locator("[data-sheet]").first().screenshot({ path: `${OUT}/${name}.png` });
      console.log("shot", name);
    };
    await bench("logo-visor", `views=front,34,high&cols=3&zoom=1.7&look=0.9&ids=${ids}`, [1200, 1300]);
    await bench("logo-close", "views=front&cols=2&zoom=4&look=1.0&ids=hair_messy_wolf%2Bacc_crew_visor,hair_double_buns%2Bacc_crew_visor", [1200, 640]);
    await bench("logo-lod1", "views=front,34&cols=2&zoom=1.7&look=0.9&charlod=1&ids=hair_messy_wolf%2Bacc_crew_visor", [1200, 640]);
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
