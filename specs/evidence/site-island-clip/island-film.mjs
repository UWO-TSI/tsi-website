// The home page's island clip: walk down the wharf, fish from the beach (cast, bite, reel, catch), talk to Bram.
// Headless Chromium (Playwright, no window), muted, signed out, against a dev server with Supabase blanked, in
// daylight. The cast's server answer is routed here (a fixed fish); a bot plays the reel. Frames come from the page's
// screencast with their times; beats.json marks each scene so the clip is cut afterwards (island-cut.py).
//   PORT=3123 node island-film.mjs <out_dir>
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const { chromium } = createRequire("/opt/homebrew/lib/node_modules/")("playwright");

const [OUT] = process.argv.slice(2);
const HOST = `http://localhost:${process.env.PORT ?? 3123}`;
const FISH = process.env.FISH ?? "fish_horse_mackerel";
const W = 1600, H = 900, BAR = 40;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const beats = [];
const beat = (name) => { beats.push({ name, t: Date.now() / 1000 }); console.log("beat", name); };
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } });
const CAMERA = JSON.stringify({ yaw: 0, pitch: 0.55, zoom: 1, sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false });

const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H + BAR }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message.slice(0, 200)));
await page.route("**/api/collections", async (route) => {
  const req = route.request();
  if (req.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ collections: [] }) });
  const body = JSON.parse(req.postData() ?? "{}");
  if (body.action === "cast") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, catch: { item_key: FISH, size_cm: 31, roll: "clip" } }) });
  if (body.action === "land") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, catch: { item_key: FISH, size_cm: 31, total_collected: 1, new_record: false } }) });
  return route.fulfill({ status: 401, body: "{}" });
});
await page.route("**/api/collections/bag", (route) => route.fulfill({ status: 401, body: "{}" }));

await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.evaluate(([look, cam]) => {
  localStorage.clear();
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const set = { "tsi.look.v1": look, "tsi.camera.v1": cam, "tsi.pixelated.v1": "false", "tsi.welcomed.v1": "1", "tsi.gift.later": day,
    "tsi.member.local.v1": "00000000-0000-4000-8000-000000000001", "tsi.held.v1": JSON.stringify({ held: "rod:rod_flimsy", last: null, pins: [], chosen: {} }) };
  for (const [k, v] of Object.entries(set)) localStorage.setItem(k, v);
}, [LOOK, CAMERA]);
await page.goto(`${HOST}/lab/island?weather=clear&at=11:30`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForFunction(() => !!window.__move && !!window.__orbit, null, { timeout: 300000 });
await page.waitForFunction(() => !document.body.innerText.includes("Preparing the island"), null, { timeout: 300000 }).catch(() => console.log("still preparing"));
await sleep(8000);
// The lab's bar and the dev tools are not the game.
await page.addStyleTag({ content: "nextjs-portal, #island-options, [aria-controls='island-options'] { display: none !important; } p[role=status][style*='fixed'] { display: none !important; }" });
await page.evaluate(() => { window.__guide?.clear?.(); for (const el of document.querySelectorAll("nav, header, div")) if (el.textContent?.startsWith("TSI LAB") && el.getBoundingClientRect().top < 4 && el.getBoundingClientRect().height < 60) { el.style.visibility = "hidden"; break; } });
const go = (x, z, yaw) => page.evaluate(([a, b, y]) => { window.__move.teleport(a, b, 0); window.__orbit.orbit.target.yaw = y; window.__orbit.orbit.view.yaw = y; }, [x, z, yaw]);
const prompt = () => page.evaluate(() => [...document.querySelectorAll("main button")].map((b) => b.textContent).find((t) => /^(E|Tap|Click)[A-Z ]/.test(t ?? "") && !/^Evening/.test(t ?? "")) ?? null);
await page.screenshot({ path: `${OUT}/start.jpg`, clip: { x: 0, y: BAR, width: W, height: H } });

// The screencast: every frame the compositor draws, with its time.
const cdp = await ctx.newCDPSession(page), frames = [];
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => { frames.push({ t: metadata.timestamp, data }); cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {}); });
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, everyNthFrame: 1 });
await sleep(400);

// 1. Down the wharf.
beat("walk");
await page.keyboard.down("w");
await sleep(Number(process.env.WALK ?? 5200));
await page.keyboard.up("w");
await sleep(500);
beat("walk-end");

// 2. Fishing from the beach, facing the sea.
const [bx, bz, byaw] = (process.env.BEACH ?? "56,100,1.5708").split(",").map(Number);
await go(bx, bz, byaw);
await sleep(1600);
console.log("beach prompt", await prompt());
// The reel bot: hold to push the window toward the fish (aimed a little ahead: it has momentum).
await page.evaluate(() => {
  let held = false, prev = null;
  const send = (type) => window.dispatchEvent(new PointerEvent(type, { pointerId: 7, button: 0, pointerType: "mouse", bubbles: true, cancelable: true }));
  const parts = (reel) => {
    const track = reel.querySelector("[data-in]");
    const win = track?.children[0]?.getBoundingClientRect(), fish = track?.children[1]?.firstElementChild?.getBoundingClientRect();
    if (!win || !fish) return null;
    return { wx: win.left + win.width / 2, fx: fish.left + fish.width / 2 };
  };
  const tick = () => {
    const reel = document.querySelector('[aria-label="Fishing reel"]');
    const p = reel && parts(reel);
    if (p) {
      const now = performance.now(), vel = prev ? (p.wx - prev.x) / Math.max(1, now - prev.t) : 0;
      prev = { x: p.wx, t: now };
      const want = p.fx > p.wx + vel * 300;
      if (want !== held) { send(want ? "pointerdown" : "pointerup"); held = want; }
    } else if (held) { send("pointerup"); held = false; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
beat("fish");
const cast = await page.evaluate(() => { const b = document.querySelector("[data-use]"); const r = b?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; });
console.log("cast button", JSON.stringify(cast));
await page.mouse.move(cast?.x ?? W / 2, cast?.y ?? H - 60);
await page.mouse.down();
await sleep(1500);
await page.mouse.up();
await page.waitForSelector('[data-member-fishing="bite"]', { timeout: 20000 }).catch(() => console.log("no bite"));
await sleep(250);
await page.mouse.move(W / 2, 300);
await page.mouse.down(); await sleep(60); await page.mouse.up();
await page.waitForSelector('[aria-label="Fishing reel"]', { timeout: 8000 }).catch(() => console.log("no reel"));
await page.waitForSelector('[role="dialog"][aria-label^="You caught"]', { timeout: 60000 }).then(() => beat("caught"), () => console.log("no catch"));
await sleep(3000);
beat("fish-end");
await page.evaluate(() => [...document.querySelectorAll('[role="dialog"] button')].find((b) => /Continue/.test(b.textContent ?? ""))?.click());
await sleep(800);

// 3. Talk to Bram at the wharf.
const slugs = await page.evaluate(() => window.__residents?.().map((r) => `${r.slug}@${Math.round(r.x)},${Math.round(r.z)}`) ?? null);
console.log("residents", JSON.stringify(slugs));
const SLUG = process.env.SLUG ?? "wharf-keeper";
let near = null;
for (const [dx, dz, yaw] of [[0, -1.2, 0], [1.2, 0, -Math.PI / 2], [-1.2, 0, Math.PI / 2], [0, 1.2, Math.PI]]) {
  const r = await page.evaluate((s) => window.__residents?.().find((x) => x.slug === s) ?? null, SLUG);
  if (!r) break;
  await go(r.x + dx, r.z + dz, yaw);
  await sleep(500);
  const p = await prompt();
  if (p && /Talk/.test(p)) { near = p; break; }
}
console.log("talk prompt", near);
await sleep(900);
beat("talk");
await page.keyboard.press("e");
await page.waitForSelector("[data-testid=talk-box]", { timeout: 20000 }).catch(() => console.log("no talk box"));
for (let k = 0; k < 4 && await page.$("[data-testid=talk-box]"); k++) { await sleep(2600); await page.keyboard.press("e"); }
await sleep(800);
beat("talk-end");

await cdp.send("Page.stopScreencast").catch(() => {});
const dir = `${OUT}/frames`;
mkdirSync(dir, { recursive: true });
const t0 = frames[0]?.t ?? 0;
frames.forEach((f, i) => writeFileSync(`${dir}/${String(i).padStart(5, "0")}_${Math.round((f.t - t0) * 1000)}.jpg`, Buffer.from(f.data, "base64")));
writeFileSync(`${OUT}/beats.json`, JSON.stringify({ t0, beats: beats.map((b) => ({ name: b.name, ms: Math.round((b.t - t0) * 1000) })) }, null, 1));
console.log("frames", frames.length, JSON.stringify(beats.map((b) => [b.name, Math.round((b.t - t0) * 1000)])));
await browser.close();
