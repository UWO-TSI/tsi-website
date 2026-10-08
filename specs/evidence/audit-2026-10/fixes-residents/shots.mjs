// Group C evidence (specs/polish/audit-2026-10-world.md items 3, 4, 6, 12, 14): headless Chromium on SwiftShader, muted,
// signed out, ?bots=12, dev server with the Supabase env blanked. node shots.mjs <out_dir> <tag> [scene...]
// Each scene logs what the residents' dev hook (__residents) and the walker (__move) report, then shoots the frame.
import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT, TAG, ...ONLY] = process.argv.slice(2);
const HOST = process.env.HOST ?? "http://localhost:3152";
fs.mkdirSync(OUT, { recursive: true });
const log = o => { fs.appendFileSync(`${OUT}/${TAG}.jsonl`, JSON.stringify(o) + "\n"); console.log(JSON.stringify(o).slice(0, 600)); };
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", e => log({ pageerror: e.message.slice(0, 300) }));
const sleep = ms => page.waitForTimeout(ms);
async function load(query, cam) {
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([l, c]) => {
    localStorage.clear(); localStorage.setItem("tsi.look.v1", l); localStorage.setItem("tsi.pixelated.v1", "false"); localStorage.setItem("tsi.liteMode.v1", "false");
    if (c) localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: c[0] * Math.PI / 180, pitch: c[1] * Math.PI / 180, zoom: c[2] ?? 1, sensitivity: 1, invertY: false, mouseLook: true }));
  }, [JSON.stringify(LOOK), cam ?? null]);
  await page.goto(`${HOST}/lab/island?collections=demo&bots=12&${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector("[role=\"status\"]")?.textContent?.includes("Preparing") && typeof window.__residents === "function", null, { timeout: 300000 }).catch(() => {});
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }).catch(() => {});
  await sleep(8000);
}
const residents = () => page.evaluate(() => window.__residents().map(r => ({ slug: r.slug, x: +r.x.toFixed(2), z: +r.z.toFixed(2), hidden: r.hidden, speed: +r.speed.toFixed(2), seat: r.seat ?? null })));
const me = () => page.evaluate(() => { const s = window.__move?.sim?.current?.state; return s ? { x: +s.x.toFixed(2), z: +s.z.toFixed(2) } : null; });
const shot = name => page.screenshot({ path: `${OUT}/${TAG}-${name}.png` });
const want = s => !ONLY.length || ONLY.includes(s);

if (want("bench")) {
  // Item 3: the lamp bench (bench-1, slots at z 4.92 / 4.08) at 18:40 with bots about.
  await load("at=18:40&at=3.4,4.5", [270, 30, 0.7]);
  for (let i = 0; i < 6; i++) { await sleep(5000); log({ scene: "bench", t: i * 5, residents: (await residents()).filter(r => !r.hidden && Math.hypot(r.x - 5, r.z - 4.5) < 2.5 || Math.hypot(r.x + 6, r.z + 8) < 2.5) }); }
  await shot("bench");
}
if (want("stack")) {
  // Item 4: the pond and plaza at 13:00 (Mayor Eliza and Wren were one body at (-6.65, 2.65)).
  await load("at=13:00&at=-4.6,5.2", [300, 34, 0.8]);
  const pairs = [];
  for (let i = 0; i < 12; i++) {
    await sleep(5000);
    const rs = (await residents()).filter(r => !r.hidden && r.speed < 0.05);
    for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) if (Math.hypot(rs[a].x - rs[b].x, rs[a].z - rs[b].z) < 0.5) pairs.push(`${rs[a].slug}+${rs[b].slug}@${rs[a].x},${rs[a].z}`);
  }
  log({ scene: "stack", within05: [...new Set(pairs)] });
  await shot("stack");
}
if (want("night")) {
  // Item 12: 22:30, the plaza toward the lamp bench and HQ.
  await load("at=22:30&at=0.5,6", [250, 38, 1.4]);
  await sleep(30000);
  const rs = await residents();
  log({ scene: "night", out: rs.filter(r => !r.hidden).map(r => `${r.slug}@${r.x},${r.z}`), inside: rs.filter(r => r.hidden).length });
  await shot("night");
}
if (want("space")) {
  // Item 14: stand on the plaza anchor at 13:00; the nearest stopped resident, every 2 s for a minute.
  await load("at=13:00&at=-3.3,2.3", [0, 30, 0.8]);
  let closest = Infinity, who = "";
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const p = await me(), rs = (await residents()).filter(r => !r.hidden && r.speed < 0.05);
    for (const r of rs) { const d = Math.hypot(r.x - p.x, r.z - p.z); if (d < closest) { closest = d; who = `${r.slug}@${r.x},${r.z}`; } }
  }
  log({ scene: "space", closestStopped: +closest.toFixed(2), who });
  await shot("space");
}
if (want("bridge")) {
  // Item 6: on the bridge deck (bridge-0 at (0, 0.5), rails at x = ±1.45), walk sideways into the rail.
  await load("at=13:00&at=0,0.5", [180, 26, 0.55]);
  // Hold each sideways key in turn: whichever way runs across the deck, the walk stops short of the rail (|x| < 1.45).
  const box = await page.locator("canvas").first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  for (const k of ["a", "d"]) {
    await page.keyboard.down(k); await sleep(4000); await page.keyboard.up(k); await sleep(1500);
    log({ scene: "bridge", key: k, stoppedAt: await me(), rail: 1.45 });
    await shot(`bridge-${k}`);
  }
}
await browser.close();
