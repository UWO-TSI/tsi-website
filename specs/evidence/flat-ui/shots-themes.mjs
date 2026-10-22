// UI themes (specs/polish/ui-themes.md): the flat and cream screens on the dev harnesses, for the pixel diffs against
// today and the theme sheet. UITHEME=<name> adds ?uitheme=<name>. Each canvas box (the turning stages) goes to
// masks.json, so the diff leaves it out. Headless and muted; the dev server on PORT with the Supabase env blanked.
// Run from web/:   PORT=3192 [UITHEME=dark] node ../specs/evidence/flat-ui/shots-themes.mjs <out-dir> [scene ...]
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT, ...ONLY] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3192, HOST = `http://localhost:${PORT}`, THEME = process.env.UITHEME;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const PHONE = { width: 390, height: 844, mobile: true };
const masks = existsSync(join(OUT, "masks.json")) ? JSON.parse(readFileSync(join(OUT, "masks.json"), "utf8")) : {};
const F = "/dev/flat-ui?surface=", P = "/dev/progression?demo=1&sheet=", SHOP = "/dev/economy?view=overlay&section=items";
const SCENES = {
  // Flat today (the clean theme)
  shop: [SHOP],
  "shop-detail": [SHOP, page => page.getByRole("button", { name: /^Cedar rod/ }).click()],
  bag: [`${F}bag`], chest: [`${F}chest`], collection: [`${F}collection`], decorate: [`${F}decorate`],
  wardrobe: [`${F}wardrobe`], creator: [`${F}creator`], missions: [`${F}missions&mission=hunt-foxes`],
  journal: [`${P}journal`], mail: [`${P}letters`], notice: [`${P}notice`],
  "mail-read": [`${P}letters`, page => page.locator("[data-gui-dialog]").last().getByRole("button", { name: /Fishing Friday/ }).first().click()],
  "bag-phone": [`${F}bag`, null, PHONE], "journal-phone": [`${P}journal`, null, PHONE], "wardrobe-phone": [`${F}wardrobe`, null, PHONE],
  // Cream today (the cream theme), the applicant island's pieces included
  wallet: [`${F}wallet`], contribute: [`${P}contribute`], "collection-applicant": [`${F}collection-applicant`],
  "creator-applicant": [`${F}creator-applicant`], gui: ["/lab/gui", null, {}, true],
};
for (const [name, [path, act, size = {}, full = false]] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  const { width = 1440, height = 900, mobile = false } = size;
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  await ctx.addInitScript(() => { try { localStorage.setItem("tsi.liteMode.v1", "false"); } catch {} });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", name, e.message.slice(0, 200)));
  try {
    const url = `${HOST}${path}${THEME ? `${path.includes("?") ? "&" : "?"}uitheme=${THEME}` : ""}`;
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector("main > *, [data-gui-dialog]", { timeout: 120000 });
    await page.addStyleTag({ content: "nextjs-portal, [data-ui-theme-switch] { display: none !important; } nav:has(> a[href='/lab']) { display: none !important; }" });
    await page.waitForTimeout(2500);
    if (act) { await act(page); await page.waitForTimeout(2500); }
    await page.mouse.move(1, 1); await page.waitForTimeout(900);
    masks[name] = await page.locator("canvas").evaluateAll(cs => cs.map(c => { const r = c.getBoundingClientRect(); return [r.x + scrollX, r.y + scrollY, r.width, r.height]; }).filter(b => b[2] > 150));
    await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: full });
    console.log("shot", name);
  } catch (e) { console.log("failed", name, e.message.slice(0, 300)); }
  await ctx.close();
}
writeFileSync(join(OUT, "masks.json"), JSON.stringify(masks));
await browser.close();
