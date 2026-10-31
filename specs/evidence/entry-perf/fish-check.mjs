// The packed fish, caught live on the member reel (coordinator's check before merging entry-perf round 2). Headless
// Chromium, muted, signed out against `next dev` on :3322 with the Supabase env blanked; the server's catch is routed
// here (as specs/evidence/fish-tiers' reel-shoot does), so each cast is the species asked for; a small bot plays the
// reel (reel-shoot's). Per catch: a still while it is on the line, one of the card with the catch held, and what the
// scene holds in the rig's "Catch" group (meshes, vertices) at both. ORIG=1 serves the remodelled fish GLBs from
// <orig_dir> (origin/main's unpacked files) instead of the worktree's packed ones.
//   node fish-check.mjs <out_dir> <tag> <page path> <fish_key:size>... [ORIG=<orig_dir>] [VIEWS=1]
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const { chromium } = createRequire("/opt/homebrew/lib/node_modules/")("playwright");

const [OUT, TAG, PAGE, ...CATCHES] = process.argv.slice(2);
const HOST = "http://localhost:3322", ORIG = process.env.ORIG ?? "";
mkdirSync(OUT, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
const report = { tag: TAG, page: PAGE, orig: !!ORIG, catches: [], errors: [], ignored: 0, ignoredKinds: [], fishFiles: [] };

const browser = await chromium.launch({ channel: "chromium", headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  const hook = window.__THREE_DEVTOOLS__ = new EventTarget();
  window.__scenes = [];
  hook.addEventListener("observe", e => { if (e.detail?.isScene) window.__scenes.push(e.detail); });
  // The rig's catch: its meshes and vertices, and whether it is drawn (every parent visible).
  window.__catch = () => {
    for (const s of window.__scenes) {
      let found = null;
      s.traverse(o => { if (!found && o.name === "Catch") found = o; });
      if (!found) continue;
      let shown = true; for (let o = found; o; o = o.parent) if (!o.visible) shown = false;
      // A checksum of every vertex attribute and index the meshes hold, and their textures' sizes: the same file loaded
      // the same way gives the same numbers.
      let meshes = 0, verts = 0, sum = 0;
      const maps = [];
      const add = a => { if (a) for (let i = 0; i < a.length; i++) sum = (sum * 31 + Math.round(a[i] * 1e6)) % 1e9; };
      found.traverse(o => {
        if (!o.isMesh) return;
        meshes++; verts += o.geometry.attributes.position?.count ?? 0;
        for (const k of Object.keys(o.geometry.attributes).sort()) add(o.geometry.attributes[k].array);
        add(o.geometry.index?.array);
        for (const m of [o.material].flat()) if (m?.map?.image) maps.push(`${m.map.image.width}x${m.map.image.height}`);
      });
      return { shown, meshes, verts, checksum: sum, maps };
    }
    return null;
  };
});
const page = await ctx.newPage();
page.on("pageerror", e => report.errors.push(`pageerror: ${e.message.slice(0, 300)}`));
page.on("console", m => {
  if (m.type() !== "error") return;
  // Signed out with Supabase blanked: its reads fail, and the routed API answers 401 to what this script doesn't play.
  if (/Failed to load resource|supabase|401|ERR_CONNECTION|ERR_UNSAFE_PORT/i.test(m.text())) { report.ignored++; const t = m.text().slice(0, 140) + " @ " + (m.location()?.url ?? "").replace(/^https?:\/\/[^/]+/, "").slice(0, 80); if (!report.ignoredKinds.includes(t)) report.ignoredKinds.push(t); return; }
  report.errors.push(`console: ${m.text().slice(0, 300)}`);
});
let current = { key: "", size: 0 };
await page.route("**/api/collections", route => {
  const req = route.request();
  if (req.method() === "GET") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ collections: [] }) });
  const body = JSON.parse(req.postData() ?? "{}");
  if (body.action === "cast") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, catch: { item_key: current.key, size_cm: current.size, roll: `check-${current.key}` } }) });
  if (body.action === "land") return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, catch: { item_key: current.key, size_cm: current.size, total_collected: 1, new_record: false } }) });
  return route.fulfill({ status: 401, body: "{}" });
});
// Which fish files the page fetched, and with ORIG, origin/main's unpacked bytes in place of the packed ones.
await page.route("**/assets/game/remodel/fish/*.glb*", route => {
  const path = new URL(route.request().url()).pathname;
  report.fishFiles.push(path);
  if (!ORIG) return route.continue();
  return route.fulfill({ status: 200, contentType: "model/gltf-binary", body: readFileSync(`${ORIG}${path}`) });
});

await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.evaluate(look => {
  localStorage.clear();
  const day = new Date().toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  for (const [k, v] of Object.entries({ "tsi.look.v1": look, "tsi.pixelated.v1": "false", "tsi.welcomed.v1": "1", "tsi.gift.later": day,
    "tsi.held.v1": JSON.stringify({ held: "rod:rod_flimsy", last: null, pins: [], chosen: {} }) })) localStorage.setItem(k, v);
}, JSON.stringify(LOOK));
await page.goto(`${HOST}${PAGE}`, { waitUntil: "domcontentloaded", timeout: 300000 });
await page.waitForSelector("canvas", { timeout: 300000 });
await page.waitForFunction(() => !!window.__move?.sim?.current && !/Tethos Island/.test([...document.querySelectorAll("[role=status]")].map(e => e.textContent).join("")), null, { timeout: 300000 });
await sleep(5000);
await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
report.url = page.url();

// Where to stand: the spawn (on the wharf), else where the launch check casts from (launch-v1/two-account.mjs: -191.5,
// -275.5); turn until the rod has water ahead (a press on the "Click Cast" prompt starts charging).
const spawn = await page.evaluate(() => { const s = window.__move.sim.current.state; return [s.x, s.z]; });
let at = spawn;
const stand = async yaw => page.evaluate(([[x, z], y]) => { window.__move.teleport(x, z, 0); window.__orbit.orbit.target.yaw = y; window.__orbit.orbit.view.yaw = y; window.__move.sim.current.state.yaw = y; }, [at, yaw]);
const PROMPT = [640, 707];
const phase = () => page.evaluate(() => document.querySelector("[data-member-fishing]")?.getAttribute("data-member-fishing") ?? "idle");
let yaw = null;
for (const where of [spawn, [-191.5, -275.5]]) {
  at = where;
  for (const y of [0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4, -3 * Math.PI / 4]) {
    await stand(y); await sleep(900);
    await page.mouse.move(...PROMPT); await page.mouse.down(); await sleep(400);
    const p = await phase();
    await page.mouse.up(); await sleep(400);
    if (p !== "idle") { yaw = y; break; }
  }
  if (yaw !== null) break;
}
// That probe cast for real: let it play out (a bite unhooked gets away) before the first catch.
if (yaw !== null) await page.waitForFunction(() => !document.querySelector("[data-member-fishing]"), null, { timeout: 60000 }).catch(() => {});
report.yaw = yaw; report.stand = at; report.spawn = spawn;
if (yaw === null) { await page.screenshot({ path: `${OUT}/${TAG}-no-water.png` }); report.errors.push("no water found from the wharf stand"); }

// The reel bot (reel-shoot.mjs): hold while the fish is ahead of the window's middle.
await page.evaluate(() => {
  let held = false;
  const send = type => window.dispatchEvent(new PointerEvent(type, { pointerId: 7, button: 0, pointerType: "mouse", bubbles: true, cancelable: true }));
  const tick = () => {
    const track = document.querySelector('[aria-label="Fishing reel"] [data-in]');
    const win = track?.children[0]?.getBoundingClientRect(), fish = track?.children[1]?.firstElementChild?.getBoundingClientRect();
    if (win && fish) {
      const want = fish.left + fish.width / 2 > win.left + win.width / 2;
      if (want !== held) { send(want ? "pointerdown" : "pointerup"); held = want; }
    } else if (held) { send("pointerup"); held = false; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

for (const spec of yaw === null ? [] : CATCHES) {
  const [key, size] = spec.split(":");
  current = { key, size: Number(size) };
  const c = { key, size: Number(size) };
  report.catches.push(c);
  await stand(yaw); await sleep(1200);
  await page.evaluate(() => { window.__orbit.orbit.target.zoom = Number(new URLSearchParams(location.search).get("zoomcheck") ?? 0.5); });
  await sleep(800);
  await page.mouse.move(...PROMPT); await page.mouse.down(); await sleep(900); await page.mouse.up();
  c.bite = await page.waitForSelector('[data-member-fishing="bite"]', { timeout: 40000 }).then(() => true, () => false);
  if (!c.bite) { await page.screenshot({ path: `${OUT}/${TAG}-${key}-no-bite.png` }); continue; }
  await sleep(150);
  await page.mouse.move(640, 300); await page.mouse.down(); await sleep(60); await page.mouse.up();
  c.reel = await page.waitForSelector('[aria-label="Fishing reel"]', { timeout: 8000 }).then(() => true, () => false);
  await sleep(1500);
  c.onLine = await page.evaluate(() => window.__catch());
  await page.screenshot({ path: `${OUT}/${TAG}-${key}-hooked.png` });
  c.card = await page.waitForSelector('[data-catch-card="developed"], [role="dialog"][aria-label^="You caught"]', { timeout: 90000 }).then(() => true, () => false);
  await sleep(2500);
  c.held = await page.evaluate(() => window.__catch());
  c.cardLabel = await page.evaluate(() => document.querySelector('[role="dialog"][aria-label^="You caught"], [data-catch-card]')?.getAttribute("aria-label") ?? null);
  await page.screenshot({ path: `${OUT}/${TAG}-${key}-card.png` });
  // Continue (and again, for the card's second step), then wait for the line to be idle.
  for (let i = 0; i < 3 && await page.locator('[data-catch-card]').count(); i++) {
    await page.locator('[data-catch-card] button').last().click({ timeout: 3000 }).catch(() => {});
    await sleep(900);
  }
  await page.waitForFunction(() => !document.querySelector("[data-member-fishing]"), null, { timeout: 15000 }).catch(() => {});
  await sleep(1500);
}

// The collection (B) and, with VIEWS=1, the museum's fish (its tank draws fish models).
if (process.env.VIEWS === "1") {
  await page.keyboard.press("b"); await sleep(2500);
  await page.screenshot({ path: `${OUT}/${TAG}-collection.png` });
  await page.keyboard.press("Escape"); await sleep(1000);
  await page.goto(`${HOST}${PAGE}${PAGE.includes("?") ? "&" : "?"}museum=inside`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await sleep(15000);
  await page.screenshot({ path: `${OUT}/${TAG}-museum.png` });
}
await browser.close();
writeFileSync(`${OUT}/${TAG}.json`, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));
