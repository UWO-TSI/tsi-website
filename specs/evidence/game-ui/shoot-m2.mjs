// Game UI milestone 2 evidence (specs/game-ui.md items 5–7, the backpack): headed Chromium (WebGL) off to the side
// and muted, never brought to the front; signed out against the dev server on :3138 with the Supabase env blanked.
// The bag is the real service on its in-memory store (?collections=demo, lib/game/collectionsDemo.ts): `bag=<slots>`
// starts it that full, `chest=1` stocks the storage chest. m2-nodes.ts says which flower the demo member can pick this
// hour. PNGs land in <out_dir>; sheets-m2.py turns them into the WebP sheets.
//   node specs/evidence/game-ui/shoot-m2.mjs <out_dir> [scene ...]
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...ONLY] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = "http://localhost:3138";
const ME = "00000000-0000-4000-8000-000000000001";
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
const HERE = dirname(fileURLToPath(import.meta.url));
const nodes = JSON.parse(execFileSync("npx", ["vite-node", "-c", "vitest.config.ts", join(HERE, "m2-nodes.ts")], { cwd: join(HERE, "../../../web") }).toString().trim().split("\n").pop());
// A flower the demo's bag doesn't hold yet (so it needs a slot), picked by hand.
const FLOWER = nodes.forage.find(n => n.category === "nature" && n.key.startsWith("flower_") && !["flower_rose", "flower_tulip"].includes(n.key));
console.log("flower", FLOWER);

const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--window-position=2400,0"] });
let page;
const shot = (name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.png`, ...opts }).then(() => console.log("shot", name));

/** A fresh device on this origin: the look, greeted, no gift, the demo member's seed, the camera without mouse-look. */
async function open(path, { width = 1280, height = 800, mobile = false, extra = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1,
    ...(mobile ? { isMobile: true, hasTouch: true, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" } : {}) });
  page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|WebGL|THREE/i.test(m.text())) console.log("console", m.text().slice(0, 240)); });
  await page.goto(`${HOST}/student/opening-soon`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ look, me, extra }) => {
    localStorage.clear();
    const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
    const base = { "tsi.look.v1": look, "tsi.pixelated.v1": "false", "tsi.welcomed.v1": "1", "tsi.gift.later": day, "tsi.member.local.v1": me,
      "tsi.camera.v1": JSON.stringify({ yaw: 0, pitch: 0.55, zoom: 1, sensitivity: 1, invertY: false, mouseLook: false }) };
    for (const [k, v] of Object.entries({ ...base, ...extra })) localStorage.setItem(k, v);
  }, { look: JSON.stringify(LOOK), me: ME, extra });
  await page.goto(`${HOST}${path}`, { waitUntil: "domcontentloaded" });
  return ctx;
}
async function world(query, opts = {}) {
  const ctx = await open(`/lab/island?collections=demo&weather=clear&${query}`, opts);
  await page.waitForSelector("canvas", { timeout: 240000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 240000 }).catch(() => console.log("still preparing"));
  await page.waitForTimeout(opts.wait ?? 7000);
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" });
  return ctx;
}
const near = (n, dx = 0.7, dz = -0.7) => `at=${(n.x + dx).toFixed(2)},${(n.z + dz).toFixed(2)}`;
const key = async (k, wait = 700) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
/** Frames at these ms after `act`. */
async function frames(prefix, act, at) {
  const t0 = Date.now();
  await act();
  for (const ms of at) { const wait = ms - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait); await shot(`${prefix}-${String(ms).padStart(4, "0")}ms`); }
}

const SCENES = {
  // One pickup from full: the bag at 19, the flower picked (its icon flies into the Bag button), the bag at 20.
  async fill() {
    const ctx = await world(`${near(FLOWER)}&at=14:05&bag=19&hud=clean`);
    await key("i", 1100);
    await shot("M2-fill-1-bag-19");
    await key("Escape", 600);
    await shot("M2-fill-2-near-flower");
    await frames("M2-fill-3-flyin", () => page.keyboard.press("e"), [80, 200, 330, 460, 600, 760, 1000]);
    await page.waitForTimeout(800);
    await key("i", 1100);
    await shot("M2-fill-4-bag-20");
    await ctx.close();
  },
  // Full: the same flower stays where it is, the note says why over it, and the Bag button shakes.
  async refuse() {
    const ctx = await world(`${near(FLOWER)}&at=14:05&bag=20&hud=clean`);
    await frames("M2-refuse-1", () => page.keyboard.press("e"), [180, 700]);
    await page.waitForTimeout(600);
    await key("i", 1100);
    await shot("M2-refuse-2-bag");
    await ctx.close();
  },
  // A member over the cap from before it: 23 in a 20-slot bag.
  async over() {
    const ctx = await world(`at=14:05&bag=23`);
    await key("i", 1100);
    await shot("M2-over-bag-23");
    await ctx.close();
  },
  // Details, lock, sort, pins, sell and drop.
  async details() {
    const ctx = await world(`at=14:05&bag=17`);
    await key("i", 1100);
    await shot("M2-details-1-grid");
    await page.getByRole("button", { name: /^Black Bass/ }).first().click(); await page.waitForTimeout(500);
    await shot("M2-details-2-fish");
    await page.getByRole("button", { name: /^Iron Nugget/ }).first().click(); await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Lock", exact: true }).click(); await page.waitForTimeout(700);
    await shot("M2-details-3-locked");
    await page.getByRole("button", { name: /^Apple/ }).first().click(); await page.waitForTimeout(400);
    await page.getByRole("button", { name: "Sell 1", exact: true }).click(); await page.waitForTimeout(900);
    await shot("M2-details-4-sold");
    await page.getByRole("button", { name: /^Apple/ }).first().dragTo(page.locator('[aria-label="Pinned to your tool wheel"] > div').first());
    await page.waitForTimeout(500);
    await shot("M2-details-5-pinned");
    await page.getByRole("button", { name: /Sort/ }).click(); await page.waitForTimeout(600);
    await shot("M2-details-6-sorted");
    await page.getByRole("button", { name: /^Orange/ }).first().click(); await page.waitForTimeout(300);
    await page.getByRole("button", { name: "Drop", exact: true }).click(); await page.waitForTimeout(600);
    await shot("M2-details-7-drop-confirm");
    await ctx.close();
  },
  // The storage chest in the house: E at the wooden chest, the two panes, store all, shift-click, drag.
  async chest() {
    const ctx = await world(`home=inside&bag=16&chest=1`, { wait: 6000 });
    await page.locator("canvas").first().focus().catch(() => {});
    for (let i = 0; i < 12 && !(await page.getByText("Open your storage chest").count()); i++) {
      await page.keyboard.down("w"); await page.waitForTimeout(160); await page.keyboard.up("w"); await page.waitForTimeout(120);
    }
    await page.waitForTimeout(400);
    await shot("M2-chest-1-prompt");
    await key("e", 1200);
    await shot("M2-chest-2-open");
    await page.getByRole("button", { name: "Store all materials" }).click(); await page.waitForTimeout(900);
    await shot("M2-chest-3-stored-all");
    await page.locator('[aria-label="Storage chest"] ul button').filter({ hasText: "" }).nth(3).click({ modifiers: ["Shift"] }); await page.waitForTimeout(900);
    await shot("M2-chest-4-shift-click");
    await page.locator('[aria-label="Your bag"] ul button').first().dragTo(page.locator('section[aria-label="Storage chest"] ul'));
    await page.waitForTimeout(900);
    await shot("M2-chest-5-dragged");
    await ctx.close();
  },
  // The phone: the companion's Bag (the same sheet) and an item's details.
  async phone() {
    const ctx = await open(`/student/opening-soon`, { width: 390, height: 844, mobile: true });
    // The companion has no demo: its bag is the real service's answer for the same pockets (m2-nodes.ts phoneBag).
    await page.route("**/api/collections/bag", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, bag: nodes.phoneBag }) }));
    await page.goto(`${HOST}/student/companion?mobile=1`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.getByRole("button", { name: "Me", exact: true }).click(); await page.waitForTimeout(800);
    await page.getByRole("button", { name: /Bag/ }).first().click(); await page.waitForTimeout(1500);
    await shot("M2-phone-1-bag");
    await page.getByRole("button", { name: /^Black Bass/ }).first().click(); await page.waitForTimeout(500);
    await page.locator('aside[aria-label$="details"]').scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await shot("M2-phone-2-details");
    await ctx.close();
  },
  // The pocket upgrades: the Roomier pocket on the shop's tools shelf (the crafting demo serves the shop).
  async shop() {
    const ctx = await open(`/lab/island?crafting=demo&sheet=shop&at=14:05`);
    await page.waitForSelector("canvas", { timeout: 240000 });
    await page.waitForTimeout(6000);
    await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" });
    await page.getByRole("tab", { name: "Tools" }).click(); await page.waitForTimeout(900);
    await page.getByRole("article", { name: "Roomier pocket" }).evaluate(el => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(400);
    await shot("M2-shop-pocket");
    await ctx.close();
  },
};

for (const [name, run] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  try { await run(); } catch (e) { console.log("FAILED", name, e.message.slice(0, 300)); }
}
await browser.close();
