// Flat UI round 2 (specs/polish/flat-ui.md): the bag's filters and side panel, the collection's hover card and side
// panel, and the kit's micro animations recorded as a video (motion.webm; motion-log.json has each click's time in it,
// for the filmstrips). Headless and muted; the dev server on PORT with the Supabase env blanked. Run from web/:
//   PORT=3192 node ../specs/evidence/flat-ui/shots-round2.mjs <out-dir> [bag|collection|motion ...]
import { createRequire } from "node:module";
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT, ...ONLY] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3192, HOST = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const PHONE = { width: 390, height: 844, mobile: true };
async function newPage({ width = 1440, height = 900, mobile = false, video = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(mobile ? { isMobile: true, hasTouch: true } : {}),
    ...(video ? { recordVideo: { dir: video, size: { width: 960, height: 600 } } } : {}) });
  await ctx.addInitScript(() => { try { localStorage.setItem("tsi.liteMode.v1", "false"); } catch {} });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  return { ctx, page };
}
const hideDev = page => page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
const shot = async (page, name, { move = true } = {}) => { if (move) await page.mouse.move(1, 1); await page.waitForTimeout(600); await page.screenshot({ path: join(OUT, `${name}.png`) }); console.log("shot", name); };
const go = async (page, query) => { await page.goto(`${HOST}/dev/flat-ui?${query}`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(5000); await hideDev(page); };
const btn = (page, name) => page.getByRole("button", { name }).first();

const SCENES = {
  bag: async () => {
    const { ctx, page } = await newPage();
    await go(page, "surface=bag&collections=demo&bag=19");
    await shot(page, "r2-3a-bag-all");
    await btn(page, /^Apple/).click(); await shot(page, "r2-3b-bag-side");
    await btn(page, "Fish").click(); await page.waitForTimeout(400); await shot(page, "r2-3c-bag-fish");
    await btn(page, /^Black Bass/).click(); await shot(page, "r2-3d-bag-fish-side");
    await btn(page, "Clothes").click(); await page.waitForTimeout(1200); await btn(page, /^Hoodie/).click(); await shot(page, "r2-3e-bag-clothes-side");
    await ctx.close();
    const p = await newPage(PHONE);
    await go(p.page, "surface=bag&collections=demo&bag=19");
    await shot(p.page, "r2-3f-bag-phone");
    await btn(p.page, /^Apple/).click(); await shot(p.page, "r2-3g-bag-phone-side");
    await p.ctx.close();
  },
  collection: async () => {
    const { ctx, page } = await newPage();
    await go(page, "surface=collection&collections=demo");
    await page.waitForTimeout(1500);
    await shot(page, "r2-6a-collection");
    await btn(page, /^Black Bass/).hover(); await shot(page, "r2-6b-collection-hover", { move: false });
    await btn(page, /^Undiscovered/).nth(3).hover().catch(() => {}); await shot(page, "r2-6c-collection-hover-unknown", { move: false });
    await btn(page, /^Black Bass/).click(); await shot(page, "r2-6d-collection-side");
    await btn(page, /^Bugs/).click(); await page.waitForTimeout(1500); await btn(page, /^Common Butterfly/).click(); await shot(page, "r2-6e-collection-bug-side");
    await ctx.close();
    const p = await newPage(PHONE);
    await go(p.page, "surface=collection&collections=demo");
    await p.page.waitForTimeout(1500);
    // A long press: the small card, then let go.
    const cell = p.page.getByRole("button", { name: /^Dace/ }).first().locator("..");
    await cell.dispatchEvent("pointerdown", { pointerType: "touch", isPrimary: true });
    await p.page.waitForTimeout(800);
    await shot(p.page, "r2-6f-collection-phone-press", { move: false });
    await cell.dispatchEvent("pointerup", { pointerType: "touch", isPrimary: true });
    await btn(p.page, /^Pale Chub/).click(); await shot(p.page, "r2-6g-collection-phone-side", { move: false });
    await p.ctx.close();
  },
  motion: async () => {
    const dir = join(OUT, "video");
    const { ctx, page } = await newPage({ video: dir });
    const t0 = Date.now(), log = [];
    const mark = label => { log.push({ label, ms: Date.now() - t0 }); };
    await page.goto(`${HOST}/dev/economy?view=overlay&section=items`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-testid=shop-card]", { timeout: 300000 }); await hideDev(page); await page.waitForTimeout(1500);
    for (const name of ["Clothes", "Home", "Today's specials", "Tools"]) { mark(`shop rail: ${name}`); await btn(page, name).click(); await page.waitForTimeout(900); }
    mark("shop: open an item"); await btn(page, /^Cedar rod/).click(); await page.waitForTimeout(1600);
    mark("shop: back"); await page.getByRole("button", { name: "All" }).first().click(); await page.waitForTimeout(900);
    await page.goto(`${HOST}/dev/flat-ui?surface=bag&collections=demo&bag=19`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(5000); await hideDev(page);
    for (const name of ["Fish", "Bugs", "Everything in your pockets"]) { mark(`bag rail: ${name}`); await btn(page, name).click(); await page.waitForTimeout(900); }
    mark("bag: pick an item"); await btn(page, /^Apple/).click(); await page.waitForTimeout(900);
    mark("bag: pick another"); await btn(page, /^Tree branch/).click(); await page.waitForTimeout(900);
    await page.goto(`${HOST}/dev/flat-ui?surface=collection&collections=demo`, { waitUntil: "domcontentloaded" }); await page.waitForTimeout(6000); await hideDev(page);
    mark("collection: hover"); await btn(page, /^Dace/).hover(); await page.waitForTimeout(900);
    mark("collection: rail Bugs"); await btn(page, /^Bugs/).click(); await page.waitForTimeout(1200);
    mark("collection: click"); await btn(page, /^Common Butterfly/).click(); await page.waitForTimeout(1200);
    const video = page.video();
    await ctx.close();
    renameSync(await video.path(), join(OUT, "motion.webm"));
    writeFileSync(join(OUT, "motion-log.json"), JSON.stringify(log, null, 1));
    console.log("video", join(OUT, "motion.webm"));
  },
};
for (const [name, run] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  try { await run(); } catch (e) { console.log("failed", name, e.message.slice(0, 300)); }
}
await browser.close();
