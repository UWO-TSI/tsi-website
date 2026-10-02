// Game UI evidence (specs/game-ui.md milestone 1): headed Chromium (WebGL) off to the side and muted, never brought to
// the front; signed out against the dev server on :3127 with the Supabase env blanked. PNGs land in <out_dir>; the
// sheet script turns them into the WebP sheets.
//   node specs/evidence/game-ui/shoot.mjs <out_dir> [name ...]
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...ONLY] = process.argv.slice(2);
const HOST = "http://localhost:3127";
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--window-position=2400,0"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404/i.test(m.text())) console.log("console", m.text().slice(0, 300)); });

/** Load the island with this device state: the held item, pins and stock, the camera's yaw and zoom. */
async function island({ held = null, pins = [], stock = {}, yaw = 0, zoom = 1, query = "", wait = 6000 } = {}) {
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ look, held, pins, stock, yaw, zoom }) => {
    localStorage.clear();
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.pixelated.v1", "false");
    localStorage.setItem("tsi.welcomed.v1", "1");
    localStorage.setItem("tsi.held.v1", JSON.stringify({ held, last: null, pins, chosen: {} }));
    localStorage.setItem("tsi.collections.local.v1", JSON.stringify(stock));
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw, pitch: 0.55, zoom, sensitivity: 1, invertY: false, mouseLook: false }));
  }, { look: JSON.stringify(LOOK), held, pins, stock, yaw, zoom });
  await page.goto(`${HOST}/lab/island?${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 240000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 240000 }).catch(() => {});
  await page.waitForTimeout(wait);
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" });
}
const shot = (name, clip) => page.screenshot({ path: `${OUT}/${name}.png`, ...(clip ? { clip } : {}) });
const emote = (clip) => page.evaluate(c => window.dispatchEvent(new CustomEvent("tsi:emote", { detail: { clip: c } })), clip);
/** The character, framed (the avatar's place on the page). */
async function avatarClip(w = 360, h = 420) {
  const s = await page.evaluate(() => window.__move?.screen?.());
  const x = s ? s.x : 640, y = s ? s.y : 400;
  return { x: Math.max(0, Math.round(x - w / 2)), y: Math.max(0, Math.round(y - h * 0.62)), width: w, height: h };
}

const SHOTS = {
  // The wheel open, choosing: the held rod has the check; a flick grows another petal and names it.
  async wheel() {
    await island({ held: "rod:rod_flimsy", pins: ["apple"], stock: { apple: 3 }, query: "at=-6,6&at=13:00" });
    await page.keyboard.down("Tab");
    await page.waitForTimeout(500);
    await shot("01-wheel-open");
    await page.mouse.move(640 + 115, 400 - 20);
    await page.waitForTimeout(350);
    await shot("01-wheel-choosing");
    await page.mouse.move(640, 400);
    await page.waitForTimeout(350);
    await shot("01-wheel-centre");
    await page.keyboard.up("Tab");
    await page.waitForTimeout(400);
  },
  // Each held item idle (seen from the front) and in use.
  async held() {
    const items = [["rod", "rod:rod_flimsy", "Fish", 900], ["net", "net:net-basic", "Net", 520], ["shovel", "shovel:shovel-basic", "Dig", 560], ["apple", "pin:apple", "Eat", 640]];
    for (const [name, id, clip, at] of items) {
      await island({ held: id, pins: ["apple"], stock: { apple: 3 }, yaw: Math.PI * 0.8, zoom: 0.6, query: "at=-6,6&at=13:00", wait: 7000 });
      await shot(`02-held-${name}-idle`, await avatarClip());
      await emote(clip);
      await page.waitForTimeout(at);
      await shot(`02-held-${name}-use`, await avatarClip());
    }
  },
  // The ruins: the wheel is the weapons.
  async ruins() {
    await island({ held: "weapon:sword-driftwood", query: "ruins=1&at=13:00", wait: 9000 });
    await page.evaluate(() => { const c = window.__combat; if (c) { c.rt.player.armed = true; window.__publishCombat?.(); } });
    await page.keyboard.down("Tab");
    await page.waitForTimeout(500);
    await page.mouse.move(640 + 110, 400 + 60);
    await page.waitForTimeout(350);
    await shot("03-ruins-weapon-wheel");
    await page.keyboard.up("Tab");
    await page.waitForTimeout(700);
    await shot("03-ruins-weapon-in-hand", await avatarClip(420, 460));
  },
  // The shop and the collection book with their rendered icons (no emoji).
  async shop() {
    await page.goto(`${HOST}/dev/economy?view=shop`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(5000);
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await shot("05-shop-tools");
    await page.getByRole("tab", { name: "Furniture" }).click().catch(() => {});
    await page.waitForTimeout(1200);
    await shot("05-shop-furniture");
  },
  async collection() {
    await island({ stock: { apple: 3, fruit_pear: 1, rock_crystal: 2, shell_whelk: 1, bug_snail: 1, bug_ladybug: 2, fish_dace: 1, flower_rose: 4 }, pins: ["apple"], query: "at=-6,6&at=13:00" });
    await page.keyboard.press("b");
    await page.waitForTimeout(1500);
    await shot("05-collection-book");
  },
  // The clean HUD while exploring with mouse-look, and the full one while H is held.
  async hud() {
    // Pointer lock needs a focused window and this one stays off to the side: ?hud=clean shows the HUD as mouse-look has it.
    await island({ held: "net:net-basic", query: "at=-6,6&at=13:00&hud=clean", wait: 8000 });
    await shot("06-hud-clean");
    await page.keyboard.down("h");
    await page.waitForTimeout(600);
    await shot("06-hud-full");
    await page.keyboard.up("h");
  },
};
for (const [name, run] of Object.entries(SHOTS)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  try { await run(); console.log("shot", name); } catch (e) { console.log("FAILED", name, String(e).split("\n")[0]); }
}
await browser.close();
