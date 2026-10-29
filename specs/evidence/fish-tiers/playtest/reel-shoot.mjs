// The playtest round's reel (copied from ui-world/shoot.mjs; beats add the reel's tension: reel:near, reel:almost).
// Fishing UI in the world (new world, member island): headless Chromium, muted, signed out, against a dev server with
// the Supabase env blanked and NEXT_PUBLIC_GAME_WORLD=new, in daylight, from the normal game camera. The server's
// answer to the cast is routed here (FISH=<key>), so a run is always that species; a small bot plays the reel.
// Frames come from the page's screencast (every frame the compositor draws, with its wall-clock time); beats.json says
// when each phase began, so strips are cut from the frames afterwards (cut.py).
//   PORT=3171 FISH=fish_horse_mackerel node specs/evidence/fish-tiers/ui-world/shoot.mjs <out_dir> <tag> <scene>
// Scenes: probe (stand somewhere, one PNG), run (a whole cast: meter, wait, hook, reel (slips once), land, card).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const { chromium } = createRequire("/opt/homebrew/lib/node_modules/")("playwright");

const [OUT, TAG = "a", SCENE = "run"] = process.argv.slice(2);
const HOST = `http://localhost:${process.env.PORT ?? 3171}`;
const FISH = process.env.FISH ?? "fish_horse_mackerel", SIZE = Number(process.env.SIZE ?? 31);
const AT = process.env.AT ?? "88,46", EXTRA = process.env.QUERY ?? "";
const SLIP = process.env.SLIP !== "0";
// OLD=1: main's cream overlay (components/game/FishingOverlay.tsx, data-fishing-overlay) instead of the flat one.
const OLD = process.env.OLD === "1", ATTR = OLD ? "data-fishing-overlay" : "data-member-fishing";
mkdirSync(OUT, { recursive: true });
const ME = "00000000-0000-4000-8000-000000000001";
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
// The lab page keeps a 40px bar of its own above the game: every shot is cut below it (and the frames in cut.py).
const CLIP = { x: 0, y: 40, width: 1280, height: 760 };
const log = (...a) => console.log(TAG, ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", e => log("pageerror", e.message.slice(0, 300)));
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|WebGL|THREE/i.test(m.text())) log("console", m.text().slice(0, 240)); });
await page.route("**/api/collections", async route => {
  const req = route.request();
  if (req.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ collections: process.env.OWNED === "1" ? [{ item_key: FISH, count: 1 }] : [] }) });
  const body = JSON.parse(req.postData() ?? "{}");
  if (body.action === "cast") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, catch: { item_key: FISH, size_cm: SIZE, roll: "evidence-roll" } }) });
  if (body.action === "land") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, catch: { item_key: FISH, size_cm: SIZE, total_collected: 1, new_record: false } }) });
  return route.fulfill({ status: 401, body: "{}" });
});
await page.route("**/api/collections/bag", route => route.fulfill({ status: 401, body: "{}" }));

await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.evaluate(({ look, me }) => {
  localStorage.clear();
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  const base = { "tsi.look.v1": look, "tsi.pixelated.v1": "false", "tsi.welcomed.v1": "1", "tsi.gift.later": day, "tsi.member.local.v1": me,
    "tsi.held.v1": JSON.stringify({ held: "rod:rod_flimsy", last: null, pins: [], chosen: {} }) };
  for (const [k, v] of Object.entries(base)) localStorage.setItem(k, v);
}, { look: JSON.stringify(LOOK), me: ME });
await page.goto(`${HOST}/lab/island?fixture=v2&weather=clear&at=12:30&at=${AT}${EXTRA ? `&${EXTRA}` : ""}`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForSelector("canvas", { timeout: 300000 });
await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 300000 }).catch(() => log("still preparing"));
await page.waitForFunction(() => !document.body.innerText.includes("Preparing the island"), null, { timeout: 300000 }).catch(() => log("still preparing the island"));
await sleep(Number(process.env.WAIT ?? 6000));
await page.addStyleTag({ content: "nextjs-portal { display: none !important; } p[role=status][style*='fixed'] { display: none !important; }" });
// The lab's own nav bar (dev only) is not the game.
await page.evaluate(() => { for (const el of document.querySelectorAll("nav, header, div")) if (el.textContent?.startsWith("TSI LAB") && el.getBoundingClientRect().top < 4 && el.getBoundingClientRect().height < 60) { el.style.display = "none"; break; } });

if (SCENE === "probe") {
  await page.screenshot({ path: `${OUT}/probe-${TAG}.png`, clip: CLIP });
  await browser.close();
  process.exit(0);
}


// The page's screencast: every frame with its time, kept in memory until saved.
const cdp = await ctx.newCDPSession(page), frames = [];
cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => { frames.push({ t: metadata.timestamp, data }); cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {}); });
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, everyNthFrame: 1 });

// What the page's reel looks like to the beats and the bot, for either overlay: the track's window and fish (boxes),
// whether the fish is in the window, the line's fill (0..100).
await page.evaluate(`window.__parts = (reel, old) => {
  const track = old ? reel.querySelector('div[style*="height: 46px"]') : reel.querySelector("[data-in]");
  const win = (old ? track?.firstElementChild : track?.children[0])?.getBoundingClientRect();
  const fish = (old ? track?.querySelector("img") : track?.children[1]?.firstElementChild)?.getBoundingClientRect(); // new: the rail spans the track, its child is the fish
  if (!win || !fish) return null;
  const fx = fish.left + fish.width / 2;
  const bar = reel.querySelector('[role="progressbar"]');
  const fill = bar?.firstElementChild ?? bar;
  const m = /scaleX\\(([\\d.]+)\\)/.exec(fill?.style.transform ?? "");
  const progress = Math.max(Number(bar?.getAttribute("aria-valuenow")) || 0, m ? Number(m[1]) * 100 : 0, parseFloat(bar?.style.width) || 0);
  return { wx: win.left + win.width / 2, fx, inside: fx >= win.left && fx <= win.right, progress };
};`);

// Beats as the page sees them: the fishing phase (and the reel's slip and landing, the card) with the time.
await page.evaluate(([attr, old]) => {
  window.__beats = [];
  let last = "";
  const tick = () => {
    const ph = document.querySelector(`[${attr}]`)?.getAttribute(attr);
    const reel = document.querySelector('[aria-label="Fishing reel"]');
    const card = document.querySelector('[role="dialog"][aria-label^="You caught"], [role="dialog"][aria-label="A catch"]');
    const p = reel && window.__parts(reel, old);
    const key = card ? `card:${card.getAttribute("data-developed") === "true" || card.getAttribute("data-catch-card") === "developed"}`
      : reel ? (p?.progress >= 99 ? "reel:land" : p && !p.inside ? "reel:slip" : reel.dataset.tension ? `reel:${reel.dataset.tension}` : "reel:in") : ph ?? "idle";
    if (key !== last) { window.__beats.push({ phase: key, t: Date.now() / 1000 }); last = key; }
    requestAnimationFrame(tick);
  };
  tick();
}, [ATTR, OLD]);

// The reel bot: hold (a synthetic pointer) to push the window toward the fish (aimed 0.3 s ahead: it has momentum).
// With `slip`, it lets go once the fish has been in the window a moment, until the fish has slipped out, then plays on.
await page.evaluate(([slip, old]) => {
  let held = false, slipped = !slip, enteredAt = 0, prev = null;
  const send = type => window.dispatchEvent(new PointerEvent(type, { pointerId: 7, button: 0, pointerType: "mouse", bubbles: true, cancelable: true }));
  const tick = () => {
    const reel = document.querySelector('[aria-label="Fishing reel"]');
    const p = reel && window.__parts(reel, old);
    if (p) {
      if (p.inside && !enteredAt) enteredAt = performance.now();
      if (!slipped && p.inside && performance.now() - enteredAt > 1300) window.__letGo = true;
      if (!p.inside && window.__letGo) slipped = true;
      const now = performance.now(), vel = prev ? (p.wx - prev.x) / Math.max(1, now - prev.t) : 0;
      prev = { x: p.wx, t: now };
      const want = window.__letGo && !slipped ? false : p.fx > p.wx + vel * 300;
      if (want !== held) { send(want ? "pointerdown" : "pointerup"); held = want; }
    } else if (held) { send("pointerup"); held = false; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, [SLIP, OLD]);

// The cast: charge for a while (the meter), release, wait for the bite, hook it (a click), the bot reels.
await page.mouse.move(640, 707); // the "Click Cast" prompt: the world casts from it while the pointer is not captured
await page.mouse.down();
await sleep(1100);
await page.screenshot({ path: `${OUT}/meter-${TAG}.png`, clip: CLIP });
await sleep(Number(process.env.HOLD ?? 700));
await page.mouse.up();
await page.waitForSelector(`[${ATTR}="waiting"]`, { timeout: 20000 }).catch(() => log("no wait"));
await sleep(1500);
await page.screenshot({ path: `${OUT}/wait-${TAG}.png`, clip: CLIP });
await page.waitForSelector(`[${ATTR}="bite"]`, { timeout: 20000 }).catch(() => log("no bite"));
await sleep(Number(process.env.HOOKAT ?? 300));
await page.mouse.move(640, 300); // off the Cancel button
await page.mouse.down(); await sleep(60); await page.mouse.up();
await page.waitForSelector('[aria-label="Fishing reel"]', { timeout: 8000 }).catch(() => log("no reel"));
await page.waitForFunction(attr => !!document.querySelector('[role="dialog"][aria-label^="You caught"], [role="dialog"][aria-label="A catch"]') || /missed/.test(document.querySelector(`[${attr}]`)?.getAttribute(attr) ?? ""), ATTR, { timeout: 90000 }).catch(() => log("no result"));
await sleep(2500);
await page.screenshot({ path: `${OUT}/card-${TAG}.png`, clip: CLIP });
await sleep(1500);
await cdp.send("Page.stopScreencast").catch(() => {});
const dir = `${OUT}/frames-${TAG}`;
mkdirSync(dir, { recursive: true });
const t0 = frames[0]?.t ?? 0;
frames.forEach((f, i) => writeFileSync(`${dir}/${String(i).padStart(4, "0")}_${Math.round((f.t - t0) * 1000)}.jpg`, Buffer.from(f.data, "base64")));
const beats = await page.evaluate(() => window.__beats);
writeFileSync(`${dir}/beats.json`, JSON.stringify({ t0, beats }, null, 1));
log("frames", frames.length, JSON.stringify(beats.map(b => [b.phase, Math.round((b.t - t0) * 1000)])));
await browser.close();
if (!beats.some(b => b.phase === "card:true")) process.exit(3); // the bot lost the fish: run again
