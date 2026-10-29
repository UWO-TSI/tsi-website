// The playtest round's cast aim and tool wheel, headless (muted) on the new world's beach (20, 109.5; the sea is +z).
//   PORT=3317 [AT=x,z] node aim-shoot.mjs <out_dir> cast|wheel|meter
// cast: the character faces inland (away from the water), the cursor on the water, a held click casts there; then the
//       cursor on the sand: a click says "Point at the water" and nothing is thrown. Mouse-look off (a free cursor).
// wheel: mouse-look on, the pointer lock emulated (headless Chromium refuses a real one: WrongDocumentError), Tab held,
//        the locked mouse's movement (synthetic movementX/Y) picks the petal in its direction; the camera's yaw is logged.
// meter: the cast meter held over the water (AT, default the wharf jetty for this scene): rising, at the tip (the max
//        cast's glow and spring), and the "Max cast!" chip after the release.
// A ring drawn where the mouse is stands in for the cursor (headless shows none).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const { chromium } = createRequire("/opt/homebrew/lib/node_modules/")("playwright");
const [OUT, SCENE = "cast"] = process.argv.slice(2);
const HOST = `http://localhost:${process.env.PORT ?? 3317}`, sleep = ms => new Promise(r => setTimeout(r, ms));
const CLIP = { x: 0, y: 40, width: 1280, height: 760 };
mkdirSync(OUT, { recursive: true });
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
await page.route("**/api/collections**", r => r.request().method() === "GET" ? r.fulfill({ status: 200, contentType: "application/json", body: '{"collections":[]}' }) : r.fulfill({ status: 401, body: "{}" }));
await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.evaluate(({ look, ml }) => {
  localStorage.clear();
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const base = { "tsi.look.v1": look, "tsi.pixelated.v1": "false", "tsi.welcomed.v1": "1", "tsi.gift.later": day, "tsi.member.local.v1": "00000000-0000-4000-8000-000000000001",
    "tsi.held.v1": JSON.stringify({ held: "rod:rod_flimsy", last: null, pins: [], chosen: {} }), "tsi.camera.v1": JSON.stringify({ mouseLook: ml }) };
  for (const [k, v] of Object.entries(base)) localStorage.setItem(k, v);
}, { look: JSON.stringify(LOOK), ml: SCENE === "wheel" });
await page.goto(`${HOST}/lab/island?fixture=v2&weather=clear&at=12:30&at=${process.env.AT ?? (SCENE === "meter" ? "88,46" : "20,109.5")}`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForSelector("canvas", { timeout: 300000 });
await page.waitForFunction(() => !document.body.innerText.includes("Preparing"), null, { timeout: 300000 }).catch(() => {});
await sleep(6000);
await page.addStyleTag({ content: "nextjs-portal { display: none !important; } #aim-ring { position: fixed; z-index: 9999; width: 22px; height: 22px; margin: -11px 0 0 -11px; border-radius: 50%; border: 3px solid #fff; box-shadow: 0 0 0 2px #000; pointer-events: none; }" });
await page.evaluate(() => {
  for (const el of document.querySelectorAll("div, nav, header")) {
    const t = el.textContent ?? "", r = el.getBoundingClientRect();
    if ((t.startsWith("TSI LAB") || t.startsWith("Walking the smooth world")) && r.top < 60 && r.height < 80) el.style.display = "none";
  }
  const ring = Object.assign(document.createElement("div"), { id: "aim-ring" });
  document.body.appendChild(ring);
  window.addEventListener("mousemove", e => { ring.style.left = `${e.clientX}px`; ring.style.top = `${e.clientY}px`; }, true);
});
const shots = [];
const shot = async (label, name) => { const path = `${OUT}/${SCENE}-${String(shots.length).padStart(2, "0")}-${name}.png`; await page.screenshot({ path, clip: CLIP }); shots.push({ path, label }); };
const facing = () => page.evaluate(() => +window.__move.sim.current.state.facing.toFixed(2));

if (SCENE === "cast") {
  // Facing inland, back to the sea.
  await page.evaluate(() => window.__move.teleport(20, 109.5, Math.PI));
  await sleep(1200);
  await page.mouse.move(700, 300); // the water, past the shore
  await sleep(300);
  await shot(`facing inland (${await facing()}), cursor on the water`, "aim");
  await page.mouse.down();
  for (const ms of [120, 450]) { await sleep(ms === 120 ? 120 : 330); await shot(`held +${ms} ms: turns to the aim (${await facing()})`, `hold${ms}`); }
  await sleep(450);
  await page.mouse.up();
  for (const ms of [250, 700, 1400]) { await sleep(ms === 250 ? 250 : ms === 700 ? 450 : 700); await shot(`released +${ms} ms`, `cast${ms}`); }
  console.log("phase", await page.evaluate(() => document.querySelector("[data-member-fishing]")?.getAttribute("data-member-fishing")));
  await page.keyboard.press("Escape");
  await sleep(1500);
  // The cursor on the sand: a click says to point at the water, and nothing is thrown.
  await page.evaluate(() => window.__move.teleport(20, 109.5, Math.PI));
  await sleep(1000);
  await page.mouse.move(500, 620); // sand, clear of the prompt
  await sleep(300);
  await shot("cursor on the sand", "sand");
  await page.mouse.down(); await sleep(80); await page.mouse.up();
  for (const ms of [150, 600, 1500]) { await sleep(ms === 150 ? 70 : ms === 600 ? 450 : 900); await shot(`click +${ms} ms`, `sand${ms}`); }
  console.log("after sand click", await page.evaluate(() => document.querySelector("[data-member-fishing]")?.getAttribute("data-member-fishing") ?? "no cast"));
} else if (SCENE === "meter") {
  await page.mouse.move(200, 360); // the water left of the jetty
  await sleep(300);
  await page.mouse.down();
  const t0 = Date.now();
  await sleep(250); await shot("held +250 ms", "rise");
  await sleep(350); await shot("held +600 ms", "rise2");
  await page.waitForSelector('[data-member-fishing] [data-tip="true"]', { timeout: 8000 }).catch(() => console.log("no tip"));
  await shot("at the tip: Max", "tip");
  await page.mouse.up();
  await sleep(300);
  await page.keyboard.press("Escape");
  await sleep(1500);
  // Again, let go the moment it's in the tip (a screenshot takes longer than the tip lasts): the max cast.
  await page.mouse.down();
  await page.waitForSelector('[data-member-fishing] [data-tip="true"]', { timeout: 8000 }).catch(() => console.log("no tip"));
  await page.mouse.up();
  await sleep(120); await shot("let go in the tip: Max cast!", "max");
  await sleep(500); await shot("Max cast! +0.6 s", "max2");
  console.log("t0", t0);
} else {
  // Mouse-look: the lock emulated on the canvas, as the browser would grant it after a click.
  await page.evaluate(() => {
    const c = document.querySelector("canvas");
    Object.defineProperty(document, "pointerLockElement", { configurable: true, get: () => c });
    document.dispatchEvent(new Event("pointerlockchange"));
  });
  await sleep(400);
  const state = () => page.evaluate(() => ({ cap: window.__orbit.capture.state, yaw: +window.__orbit.orbit.target.yaw.toFixed(3),
    chosen: document.querySelector('[aria-label="Tool wheel"] [data-chosen]')?.getAttribute("aria-label") ?? "-",
    held: JSON.parse(localStorage.getItem("tsi.held.v1") ?? "{}").held ?? null }));
  const look = (dx, dy, n = 6) => page.evaluate(([dx, dy, n]) => { const c = document.querySelector("canvas");
    for (let i = 0; i < n; i++) c.dispatchEvent(new MouseEvent("mousemove", { bubbles: true, movementX: dx, movementY: dy })); }, [dx, dy, n]);
  let s = await state();
  console.log("locked", JSON.stringify(s));
  await look(12, 0); await sleep(200);
  const turned = await state();
  console.log("camera turns before the wheel", JSON.stringify(turned));
  await shot(`locked (${s.cap}): the mouse turns the camera, yaw ${s.yaw} to ${turned.yaw}`, "locked");
  await page.keyboard.down("Tab"); await sleep(350);
  s = await state(); await shot(`Tab held: the wheel, yaw ${s.yaw}`, "open");
  for (const [dx, dy, name] of [[12, 0, "right"], [0, 14, "down"], [-14, 0, "left"], [0, -14, "up"]]) {
    await look(dx, dy); await sleep(150);
    s = await state(); console.log(name, JSON.stringify(s));
    await shot(`mouse ${name}: ${s.chosen}, yaw ${s.yaw}`, name);
  }
  await look(14, 0); await sleep(150);
  s = await state(); console.log("right again", JSON.stringify(s));
  await shot(`mouse right: ${s.chosen}, yaw ${s.yaw}`, "right2");
  await page.keyboard.up("Tab"); await sleep(400);
  s = await state(); console.log("released", JSON.stringify(s));
  await shot(`Tab released: holding ${s.held}`, "released");
}
writeFileSync(`${OUT}/${SCENE}-shots.json`, JSON.stringify(shots, null, 1));
await browser.close();
