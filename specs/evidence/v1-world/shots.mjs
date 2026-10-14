// Evidence shots for the v1 world (specs/v1-drop.md §2 and §9): the closed café, the hidden UI, the barrier props and
// Halloween by day and by night. Headless Chromium, muted, never brought to the front, against a development server
// with the Supabase env blanked (signed out: the seeded progression and the village file).
//   PORT=3165 node specs/evidence/v1-world/shots.mjs [shot,shot,...]
// Writes specs/evidence/v1-world/<shot>.png. A shot: a /lab path, the camera's orbit, an optional teleport and steps.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const OUT = dirname(fileURLToPath(import.meta.url)), PORT = process.env.PORT ?? 3165;
mkdirSync(OUT, { recursive: true });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const DAY = "time=day&weather=clear&season=autumn", NIGHT = "time=night&weather=clear&season=autumn";
const press = key => page => page.keyboard.press(key);
const wait = ms => page => page.waitForTimeout(ms);
const snap = name => page => page.screenshot({ path: join(OUT, `${name}.png`) }).then(() => console.log("wrote", name));

/** name → { url, cam: [yaw, pitch, zoom], steps } */
const SHOTS = {
  // The café built but closed: warm, "Opening soon" on the chalkboard, Rosa sweeping out front; no door prompt.
  "cafe-closed-day": { url: `/lab/island?${DAY}&at=-9.2,-12.6`, cam: [0, 0.42, 0.62] },
  "cafe-closed-dusk": { url: `/lab/island?time=evening&weather=clear&season=autumn&at=-9.2,-12.6`, cam: [0, 0.42, 0.62] },
  "cafe-closed-night": { url: `/lab/island?${NIGHT}&at=-9.2,-12.6`, cam: [0, 0.42, 0.62] },
  "cafe-rosa-talk": { url: `/lab/island?${DAY}&at=-9.2,-12.6`, cam: [0, 0.42, 0.55], steps: [p => p.evaluate(() => { const s = window.__sweeper; if (s) window.__move.teleport(s.x - 0.2, s.z - 1.2, 0); }), wait(1500), press("e"), wait(900)] },
  "cafe-door": { url: `/lab/island?${DAY}&at=-10,-9.6`, cam: [0, 0.5, 0.55] },
  // The wharf: no boat home. HQ's door: Enter (no "Claim your plot"). The ruins gate: no prompt, no sign, no board.
  "wharf-no-boat": { url: `/lab/island?${DAY}&at=8,-21.7`, cam: [3.14, 0.5, 0.7] },
  "hq-door": { url: `/lab/island?${DAY}&at=0,5.7`, cam: [0, 0.5, 0.7] },
  "ruins-gate": { url: `/lab/island?${DAY}&at=15.3,-2.5`, cam: [1.57, 0.5, 0.75] },
  "settings": { url: `/lab/island?${DAY}&sheet=settings`, cam: [0, 0.62, 1] },
  "journal": { url: `/lab/island?${DAY}&sheet=journal`, cam: [0, 0.62, 1] },
  "minimap": { url: `/lab/island?${DAY}`, cam: [0, 0.62, 1], steps: [press("m"), wait(800)] },
  // The barriers: the village's ruins gate as fallen rubble; on the v2 world with the proposal accepted, the rockslide
  // over the trail, the rubble and forest edge round the ruins, an unbuilt bridge head.
  "barrier-ruins-gate": { url: `/lab/island?${DAY}&at=15.1,-2.6`, cam: [1.57, 0.95, 0.55] },
  "settings-island": { url: `/lab/island?${DAY}&sheet=settings`, cam: [0, 0.62, 1], steps: [wait(1500),
    p => p.getByText("You on the island").first().scrollIntoViewIfNeeded().catch(() => {}), wait(800)] },
  "barrier-rockslide": { url: `/lab/island?fixture=v2&proposals=1&${DAY}&at=-25.5,-86`, cam: [3.14, 0.5, 0.95] },
  "barrier-ruins-forest": { url: `/lab/island?fixture=v2&proposals=1&${DAY}&at=49,-14.5`, cam: [3.14, 0.55, 1.35] },
  "barrier-bridge": { url: `/lab/island?fixture=v2&proposals=1&${DAY}&at=-48.5,64`, cam: [-1.57, 0.5, 0.9] },
  // Halloween (?tradition=halloween forces the calendar's window): pumpkins by the lamps, the doors and the anchors,
  // by day and lit at night with the fog night; a knock at HQ's door; the costume closet in the wardrobe.
  "halloween-day": { url: `/lab/island?${DAY}&tradition=halloween&at=0.5,1.5`, cam: [0, 0.5, 1.1] },
  "halloween-night": { url: `/lab/island?${NIGHT}&tradition=halloween&at=0.5,1.5`, cam: [0, 0.5, 1.1] },
  "halloween-knock": { url: `/lab/island?${NIGHT}&tradition=halloween&at=1.05,5.25`, cam: [0, 0.55, 0.7], steps: [wait(1500), snap("halloween-knock-prompt"), press("e"), wait(1600)] },
  "costume-closet": { url: `/lab/island?${DAY}&tradition=halloween&sheet=closet`, cam: [0, 0.62, 1], ready: "Your closet", steps: [wait(2500),
    p => p.getByRole("tab", { name: /Accessories/ }).click().catch(() => {}), wait(1500),
    p => p.locator("button[title='Witch hat']").first().click().catch(() => {}), wait(2500)] },
  "costume-closet-after": { url: `/lab/island?${DAY}&tradition=none&sheet=closet`, cam: [0, 0.62, 1], ready: "Your closet", steps: [wait(2500),
    p => p.getByRole("tab", { name: /Accessories/ }).click().catch(() => {}), wait(2000)] },
};

const names = (process.argv[2] ?? Object.keys(SHOTS).join(",")).split(",");
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
for (const name of names) {
  const shot = SHOTS[name];
  if (!shot) { console.log("no shot", name); continue; }
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const [yaw, pitch, zoom] = shot.cam;
  await ctx.addInitScript(({ look, cam }) => { try {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); localStorage.setItem("tsi.hud.full.v1", "true");
    localStorage.setItem("tsi.welcomed.v1", "1");
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: cam[0], pitch: cam[1], zoom: cam[2], mouseLook: false, autoFollow: false, sensitivity: 1, invertY: false }));
  } catch {} }, { look: LOOK, cam: [yaw, pitch, zoom] });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log(name, "pageerror", e.message));
  await page.goto(`http://localhost:${PORT}${shot.url}`);
  // The wardrobe covers the island (it stops drawing): those shots wait for the sheet instead of the walker.
  if (shot.ready) await page.getByText(shot.ready).first().waitFor({ timeout: 300000 });
  else await page.waitForFunction(() => !!window.__move?.sim?.current, null, { timeout: 300000 });
  await page.waitForTimeout(10000);
  if (await page.evaluate(() => { const g = window.__governor; if (!g) return false; g.hold = 1e9; g.set(0); return true; })) await page.waitForTimeout(1500);
  for (const step of shot.steps ?? []) await step(page);
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  console.log("wrote", name);
  await ctx.close();
}
await browser.close();
