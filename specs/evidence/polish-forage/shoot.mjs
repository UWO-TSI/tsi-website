// Foraging, crafting, museum and shop evidence (specs/polish/forage-craft-museum.md): headed Chromium off to the side
// (--window-position=2400,0) and muted, never brought to the front, or with HEADLESS=1 no window at all (SwiftShader
// WebGL); signed out against a dev server with the Supabase env blanked. The bag, museum, trophies and the shop's counter
// are the real collections and economy services on their memory stores (?collections=demo), the workbench and bottle
// the crafting service on its own (?crafting=demo). nodes.ts says what each village node holds this hour for the demo
// member, the reward card per kind and the glide ledge. PNGs land in <out_dir>; sheets.py tiles them into WebP sheets.
//   node specs/evidence/polish-forage/shoot.mjs <out_dir> <port> [scene ...]
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, PORT = "3143", ...ONLY] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = `http://localhost:${PORT}`;
const ME = "00000000-0000-4000-8000-000000000001";
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
const HERE = dirname(fileURLToPath(import.meta.url));
const N = JSON.parse(execFileSync("npx", ["vite-node", "-c", "vitest.config.ts", join(HERE, "nodes.ts")], { cwd: join(HERE, "../../../web") }).toString().trim().split("\n").pop());
console.log("nodes at", N.now);

// HEADLESS=1: no window at all, WebGL on SwiftShader (looks only; FPS needs the real GPU window).
const HEADLESS = process.env.HEADLESS === "1";
const browser = await chromium.launch(HEADLESS
  ? { headless: true, args: ["--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }
  : { headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--window-position=2400,0"] });
let page;
const log = [];
const shot = (name, opts = {}) => page.screenshot({ path: `${OUT}/${name}.png`, ...opts }).then(() => console.log("shot", name));
const HELD = (held) => JSON.stringify({ held, last: null, pins: [], chosen: {} });

/** A fresh device on this origin: the look, greeted, no gift, the demo member's seed, the camera without mouse-look. */
async function open(path, { width = 1280, height = 800, extra = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
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
  const ctx = await open(`${opts.path ?? "/lab/island"}?${query}`, opts);
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 300000 }).catch(() => console.log("still preparing"));
  await page.waitForTimeout(opts.wait ?? 8000);
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" });
  return ctx;
}
async function perf(name) {
  const text = await page.evaluate(() => document.querySelector("#island-options output")?.textContent ?? "");
  if (text) { log.push(`${name}: ${text.replace(/\n/g, " | ")}`); console.log("perf", name, text.replace(/\n/g, " | ")); }
}
const at = (x, z) => `at=${x.toFixed(2)},${z.toFixed(2)}`;
const key = async (k, wait = 700) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
/** Frames at these ms after `act`. */
async function frames(prefix, act, ms) {
  const t0 = Date.now();
  await act();
  for (const m of ms) { const wait = m - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait); await shot(`${prefix}-${String(m).padStart(4, "0")}ms`); }
}
/** Left click on the canvas (the held tool's use): away from the HUD. */
const use = () => page.mouse.click(640, 430);
const walkTo = (x, z) => page.evaluate(([x, z]) => window.dispatchEvent(new CustomEvent("tsi:interior-move", { detail: { x, z } })), [x, z]);
const STRIP = [0, 150, 300, 450, 600, 800, 1000, 1300, 1700, 2200, 2800];

const SCENES = {
  // A fruit tree: E shakes it (frames through the shake and the drop), E again picks up what fell.
  async shake() {
    const t = N.fruit.find(f => f.key === "apple") ?? N.fruit[0];
    // On the trunk's left (the tree's mushroom grows to its right), close enough to put both hands on it.
    const ctx = await world(`collections=demo&weather=clear&${at(t.x - 0.45, t.z - 0.95)}&hud=clean`);
    await perf("shake");
    await frames("shake-1", () => page.keyboard.press("e"), STRIP);
    await page.waitForTimeout(600);
    await frames("shake-2-pickup", () => page.keyboard.press("e"), [0, 200, 400, 600, 800, 1100, 1500, 2200]);
    await ctx.close();
  },
  // A cedar gives a branch.
  async branch() {
    // A cedar (it bears no fruit, so the shake gives its branch).
    const b = N.branches.find(n => !N.fruit.some(f => f.x === n.x && f.z === n.z)) ?? N.branches[0];
    const ctx = await world(`collections=demo&weather=clear&${at(b.x - 0.45, b.z - 0.95)}&hud=clean`);
    await frames("branch-1", () => page.keyboard.press("e"), STRIP);
    await page.waitForTimeout(600);
    await frames("branch-2-pickup", () => page.keyboard.press("e"), [0, 200, 400, 600, 800, 1100, 1500, 2200]);
    await ctx.close();
  },
  // A rock struck with the shovel in hand.
  async rock() {
    const r = N.rocks.find(n => n.key !== "rock_stone") ?? N.rocks[0];
    const ctx = await world(`collections=demo&weather=clear&${at(r.x + 0.35, r.z - 0.95)}&hud=clean`, { extra: { "tsi.held.v1": HELD("shovel:shovel-basic") } });
    await frames("rock", use, STRIP);
    await ctx.close();
  },
  // A flower picked by hand.
  async flower() {
    const f = N.flowers.find(n => n.key !== "flower_windflower") ?? N.flowers[0];
    const ctx = await world(`collections=demo&weather=clear&${at(f.x + 0.5, f.z - 0.7)}&hud=clean`);
    await frames("flower", () => page.keyboard.press("e"), STRIP);
    await ctx.close();
  },
  // A shell picked by hand.
  async shell() {
    const s = N.shells[0];
    if (!s) return console.log("no hand shell this hour");
    const ctx = await world(`collections=demo&weather=clear&${at(s.x + 0.5, s.z - 0.7)}&hud=clean`);
    await frames("shell", () => page.keyboard.press("e"), [0, 300, 600, 900, 1300, 1800, 2400]);
    await ctx.close();
  },
  // A buried clam dug up with the shovel; the hole fills back in.
  async dig() {
    const d = N.buried[0];
    if (!d) return console.log("nothing buried this hour");
    const ctx = await world(`collections=demo&weather=clear&${at(d.x + 0.4, d.z - 0.75)}&hud=clean`, { extra: { "tsi.held.v1": HELD("shovel:shovel-basic") } });
    await frames("dig", use, [...STRIP, 3600]);
    await page.waitForTimeout(20000);
    await shot("dig-later-20s");
    await ctx.close();
  },
  // A bug netted (standing still within reach, so it doesn't flee).
  async bug() {
    const b = N.bugs.find(n => n.rarity === "common" || n.rarity === "uncommon") ?? N.bugs[0];
    const ctx = await world(`collections=demo&weather=clear&${at(b.x + 0.45, b.z - 0.9)}&hud=clean`, { extra: { "tsi.held.v1": HELD("net:net-basic") } });
    await frames("bug", use, [0, 300, 600, 900, 1200, 1600, 2200, 3000]);
    await ctx.close();
  },
  // Rain on a puddle, and walking through it.
  async puddle() {
    const p = N.puddles[2];
    const ctx = await world(`collections=demo&weather=rain&${at(p.x, p.z - 2.2)}&hud=clean`, { wait: 9000 });
    await perf("rain");
    await shot("puddle-0-rain");
    await page.locator("canvas").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.keyboard.down("w");
    for (let i = 0; i < 8; i++) { await page.waitForTimeout(160); await shot(`puddle-1-walk-${i}`); }
    await page.keyboard.up("w");
    await ctx.close();
  },
  // Fireflies at night round the bushes.
  async fireflies() {
    const b = N.bushes[0];
    const ctx = await world(`collections=demo&weather=clear&time=night&${at(b.x + 1.5, b.z - 2.5)}&hud=clean`, { wait: 10000 });
    await perf("fireflies");
    for (let i = 0; i < 3; i++) { await shot(`fireflies-${i}`); await page.waitForTimeout(700); }
    await ctx.close();
  },
  // The workbench: walk up, open it, craft the floor lamp.
  async craft() {
    const ctx = await world(`crafting=demo&hq=inside`, { wait: 9000 });
    await walkTo(-6.0, 1.0);
    await page.waitForTimeout(3200);
    await shot("craft-0-bench");
    await key("e", 1500);
    await shot("craft-1-sheet");
    await page.getByRole("button", { name: /Floor lamp/ }).first().click().catch(() => console.log("no floor lamp row"));
    await page.waitForTimeout(500);
    await frames("craft-2", () => page.getByRole("button", { name: "Craft", exact: true }).click(), [0, 200, 400, 650, 900, 1200, 1500, 1800, 2200, 2700, 3300, 4000, 4800]);
    await ctx.close();
  },
  // The leaf glider crafted: its unlock card, then out to the guided first glide.
  async glider() {
    const ctx = await world(`crafting=demo&hq=inside`, { wait: 9000 });
    await walkTo(-6.0, 1.0);
    await page.waitForTimeout(3200);
    await key("e", 1500);
    await page.getByRole("button", { name: /Leaf glider/ }).first().click().catch(() => console.log("no glider row"));
    await page.waitForTimeout(500);
    await frames("glider-1", () => page.getByRole("button", { name: "Craft", exact: true }).click(), [0, 600, 1500, 2600, 3600, 4600]);
    await ctx.close();
  },
  // The guided first glide: the leaf glider made (here through the demo's own craft route), out on a ledge that runs
  // off toward the camera's view; then a try: run off it, jump, and jump again held to glide.
  async guide() {
    const g = N.glide;
    if (!g) return console.log("no glide ledge");
    const ctx = await world(`crafting=demo&weather=clear&${at(g.stand[0], g.stand[1])}&hud=clean`);
    await page.evaluate(async () => {
      await fetch("/api/crafting/craft", { method: "POST", body: JSON.stringify({ recipe_id: "glider-leaf", idempotency_key: "shoot-glider" }) });
      window.dispatchEvent(new CustomEvent("tsi:crafted", { detail: { id: "glider-leaf", name: "Leaf glider", kind: "item" } }));
    });
    await page.waitForTimeout(2600);
    await shot("guide-0-card");
    await page.waitForTimeout(2400);
    await shot("guide-1-marked");
    await page.locator("canvas").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
    const t0 = Date.now(), ms = [0, 400, 800, 1200, 1600, 2000, 2600, 3400, 4400];
    await page.keyboard.down("w");
    const run = (async () => {
      await page.waitForTimeout(650); await page.keyboard.press("Space");
      await page.waitForTimeout(260); await page.keyboard.down("Space");
      await page.waitForTimeout(1500); await page.keyboard.up("Space"); await page.keyboard.up("w");
    })();
    for (const m of ms) { const wait = m - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait); await shot(`guide-2-try-${String(m).padStart(4, "0")}ms`); }
    await run;
    await ctx.close();
  },
  // Every kind of reward card (the events the bug net, a find, the spade, the workbench and the bottle send).
  async cards() {
    const ctx = await world(`crafting=demo&weather=clear&hud=clean`);
    for (const [name, ev] of N.cards) {
      await page.evaluate(({ type, detail }) => window.dispatchEvent(new CustomEvent(type, { detail })), ev);
      await page.waitForTimeout(name === "bottle" ? 1300 : 700);
      if (name === "bug") await shot("card-0-in-view");
      await page.locator('[data-testid="reward-card"]').first().screenshot({ path: `${OUT}/card-${name}.png` }).then(() => console.log("shot card", name)).catch(e => console.log("no card", name, e.message.slice(0, 120)));
      await page.locator('[data-testid="reward-card"]').first().click().catch(() => {});
      await page.waitForTimeout(500);
    }
    await ctx.close();
  },
  // Today's message bottle on the beach.
  async bottle() {
    const [x, z] = N.bottle;
    const ctx = await world(`crafting=demo&weather=clear&${at(x + 0.4, z - 0.9)}&hud=clean`);
    await frames("bottle", () => page.keyboard.press("e"), [0, 200, 400, 600, 900, 1200, 1600, 2100, 2800, 3600]);
    await ctx.close();
  },
  // The museum: up to the curator, donate something.
  async museum() {
    const ctx = await world(`collections=demo&museum=inside`, { wait: 9000 });
    await walkTo(-2.2, -2.3);
    await page.waitForTimeout(2600);
    await shot("museum-0-desk");
    await key("e", 1600);
    await shot("museum-1-sheet");
    const row = page.locator('[data-testid="donate-sheet"] button').filter({ hasText: /In bag/ }).first();
    await frames("museum-2", () => row.click(), [0, 300, 700, 1200, 1800, 2600, 3500, 4500]);
    await ctx.close();
  },
  // The HQ's trophy case.
  async trophy() {
    const ctx = await world(`collections=demo&hq=inside`, { wait: 9000 });
    await walkTo(-4.5, 3.9);
    await page.waitForTimeout(3000);
    await shot("trophy-0-case");
    await key("e", 1500);
    await shot("trophy-1-sheet");
    await ctx.close();
  },
  // The shop from the plaza, and its interior.
  async shop() {
    const s = N.shop;
    const ctx = await world(`collections=demo&weather=clear&${at(s.x, s.z - 3.2)}`);
    await shot("shop-0-front");
    await key("e", 2600);
    await shot("shop-1-after-e");
    // Inside: up to the counter, E opens it (Toren serves you), Sell, then Buy, the till counting each time.
    await page.waitForTimeout(3500);
    await walkTo(0, 0.7);
    await page.waitForTimeout(2600);
    await shot("shop-2-inside");
    await key("e", 1800);
    await shot("shop-3-counter-buy");
    await page.getByRole("tab", { name: "Sell" }).click().catch(() => console.log("no sell tab"));
    await page.waitForTimeout(1200);
    await shot("shop-4-sell");
    const sell = page.getByRole("button", { name: "Sell 1" }).first();
    await frames("shop-5-sold", () => sell.click(), [0, 150, 300, 500, 700, 1000, 1600]).catch(e => console.log("sell", e.message.slice(0, 120)));
    await page.getByRole("tab", { name: "Buy" }).click().catch(() => console.log("no buy tab"));
    await page.waitForTimeout(1200);
    const buy = page.getByRole("button", { name: "Buy", exact: true }).first();
    await frames("shop-6-bought", () => buy.click(), [0, 300, 700, 1200, 1800]).catch(e => console.log("buy", e.message.slice(0, 120)));
    await ctx.close();
  },
  async shoplab() {
    const ctx = await open(`/lab/interior?room=shop`);
    await page.waitForSelector("canvas", { timeout: 300000 });
    await page.waitForTimeout(9000);
    await shot("shop-2-lab-interior");
    await ctx.close();
  },
};

for (const [name, fn] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  try { await fn(); } catch (e) { console.log("scene failed", name, e.message.slice(0, 300)); }
}
writeFileSync(`${OUT}/perf.txt`, log.join("\n") + "\n");
await browser.close();
