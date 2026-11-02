// polish round 2 evidence (the held lantern, the interact ring): headless Chromium only, muted, signed out, against a
// dev server with the Supabase env blanked. Never headed.
//   HOST=http://localhost:3332 node specs/evidence/polish/lantern-ring/shoot.mjs <out_dir> <tag> [shot ...]
// A shot: name=x,z@time[@yaw,pitch,zoom][@phone][@lantern][@walk][@nohud]; `lantern` puts the Lighthouse rod in hand
// (the inventory answered here), `walk` holds W for a second before the frame.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, TAG, ...SHOTS] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3332";
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
const INVENTORY = { ok: true, inventory: { groups: { tools: [{ item: { slug: "rod-lighthouse", catalogue_ref: "rod_lighthouse" }, equipped: false }] } } };
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const rad = d => (Number(d) * Math.PI) / 180;

for (const shot of SHOTS) {
  const [name, spec] = shot.split("=");
  const [at, time, cam = "0,30,1", ...flags] = spec.split("@");
  const phone = flags.includes("phone"), lantern = flags.includes("lantern");
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: phone, isMobile: phone });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log(name, "pageerror", e.message.slice(0, 200)));
  if (lantern) await page.route("**/api/economy/inventory", r => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(INVENTORY) }));
  await page.goto(`${HOST}/student/opening-soon`, { waitUntil: "domcontentloaded" });
  const [yaw, pitch, zoom] = cam.split(",").map(Number);
  await page.evaluate(([look, c, held]) => {
    localStorage.clear();
    const kv = { "tsi.look.v1": look, "tsi.pixelated.v1": "false", "tsi.welcomed.v1": "1", "tsi.dock.cleared": "1",
      "tsi.held.v1": JSON.stringify(held ? { held: "rod:rod_lighthouse", last: null, pins: [], chosen: { rod: "rod_lighthouse" } } : { held: null, last: null, pins: [], chosen: {} }),
      "tsi.camera.v1": JSON.stringify({ yaw: c[0], pitch: c[1], zoom: c[2], sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false }) };
    for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v);
  }, [JSON.stringify(LOOK), [rad(yaw), rad(pitch), zoom], lantern]);
  await page.goto(`${HOST}/lab/island?weather=clear&season=summer&time=${time}&at=${at}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  // Until the loading card has gone (the island's first frames drawn).
  await page.waitForFunction(() => ![...document.querySelectorAll("[role=status]")].some(e => /Preparing|Tethos Island/.test(e.textContent) && !e.hasAttribute("data-leaving")), null, { timeout: 300000, polling: 250 }).catch(() => console.log(name, "still preparing"));
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" });
  if (flags.includes("nohud")) await page.addStyleTag({ content: "main > :not(:has(canvas)), nav { visibility: hidden !important; }" });
  await page.waitForTimeout(Number(process.env.WAIT ?? 9000));
  if (flags.includes("walk")) { await page.keyboard.down("w"); await page.waitForTimeout(900); }
  await page.screenshot({ path: `${OUT}/${name}-${TAG}.png` });
  if (flags.includes("walk")) await page.keyboard.up("w");
  const prompt = await page.locator("button[class*=interact]").first().textContent({ timeout: 500 }).catch(() => null);
  console.log("shot", name, TAG, "prompt:", prompt);
  await ctx.close();
}
await browser.close();
