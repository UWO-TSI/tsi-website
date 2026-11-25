// Round 6 evidence for the tutorial-v2 lane (David's round 5 playtest, 2026-11-01): headless, muted, signed out against
// a dev server with the Supabase env blanked, on the new world.
//
//   HOST=http://localhost:3172 node specs/evidence/tutorial-v2/v6/shoot.mjs <out> day|night
//
// One run per light (day 14:20, night 22:10): the creator's Yes, then the crossing played out (not skipped), each of
// its five cuts at 15%, 50% and 90% (a strip per cut, `<P>-cut-<n>-<id>-fNN`) and the middles plus the landing as one
// strip (`<P>-cuts-fNN`); then ashore, Bram's first line on the dock in the talk box (no hearts, no gift in the tutorial).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, LIGHT = "day"] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3172";
const P = LIGHT === "night" ? "n" : "d";
const CLOCK = LIGHT === "night" ? "22:10" : "14:20";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const log = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const CAMERA = JSON.stringify({ yaw: 0, pitch: 0.55, zoom: 1, sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false });
// The cuts (lib/game/arrival/sequence.ts CROSSING_SHOTS) and the docking's share of them (boatTrip CROSS_TIME = 25 - 1.3).
const CUTS = [["drone", 0, 6], ["bow", 6, 11], ["closeup", 11, 15.5], ["wake", 15.5, 20], ["wharf", 20, 25]];
const CROSS_TIME = 25 - 1.3;

const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on("pageerror", e => { log.push({ pageerror: e.message.slice(0, 300) }); console.log("pageerror", e.message.slice(0, 300)); });
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|ERR_CONNECTION/i.test(m.text())) log.push({ console: m.text().slice(0, 300) }); });
await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
await page.evaluate(x => { localStorage.clear(); localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10)); for (const [k, v] of Object.entries(x)) localStorage.setItem(k, v); }, { "tsi.camera.v1": CAMERA });
await page.goto(`${HOST}/lab/island?arrival=1&weather=clear&at=${CLOCK}`, { waitUntil: "domcontentloaded" });
await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal, body > div > nav { display: none !important; }" }).catch(() => {});
const T = page.evaluate.bind(page);
const shot = async name => { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const at = (phase, t) => page.waitForFunction(([p, tt]) => { const s = window.__arrival?.state(); return s && s.phase === p && s.t >= tt; }, [phase, t], { timeout: 300000, polling: 16 });
/** Wait until the crossing's shot clock (cross: its t; dock: CROSS_TIME + t) reaches `t` s. */
const crossAt = t => page.waitForFunction(([tt, ct]) => {
  const tr = window.__arrival?.state()?.trip;
  if (!tr) return true;
  const now = tr.phase === "cross" ? tr.t : tr.phase === "dock" ? ct + tr.t : tr.phase === "load" ? -1 : 99;
  return now >= tt;
}, [t, CROSS_TIME], { timeout: 300000, polling: 16 });

try {
  await page.waitForFunction(() => window.__arrival?.state()?.phase, null, { timeout: 300000 });
  await T(() => window.__arrival.skip());
  await at("creator", 1.0);
  await page.click('[data-testid="reflection-yes"]', { force: true });
  await at("crossing", 0.2);
  // Let the crossing's world settle under the load, then play it through.
  await page.waitForFunction(() => window.__arrival?.state()?.trip?.phase === "cross", null, { timeout: 300000, polling: 16 });
  const mids = [];
  for (const [n, [id, a, b]] of CUTS.entries()) {
    for (const [j, f] of [0.15, 0.5, 0.9].entries()) {
      await crossAt(a + (b - a) * f);
      const name = `${P}-cut-${n + 1}-${id}-f0${j + 1}`;
      await shot(name);
      if (j === 1) mids.push(name);
      log.push({ cut: id, frac: f, trip: await T(() => window.__arrival?.state()?.trip) });
    }
  }
  await at("landing", 0.6);
  await shot(`${P}-landing`);
  // One strip of the cuts' middles and the landing (copies under the strip's own names).
  const { copyFileSync } = await import("node:fs");
  [...mids, `${P}-landing`].forEach((m, i) => copyFileSync(`${OUT}/${m}.png`, `${OUT}/${P}-cuts-f${String(i + 1).padStart(2, "0")}.png`));

  // Ashore: Bram's first line on the dock in the talk box.
  await at("tutorial", 1.2);
  await page.waitForFunction(() => window.__arrivalStops?.()?.length, null, { timeout: 60000 });
  const dock = await T(() => window.__arrivalStops().find(s => s.id === "dockNew"));
  await page.waitForFunction(() => window.__bram?.().talkable, null, { timeout: 120000, polling: 50 });
  await T(([a, b]) => { window.__move.teleport(a, b, 0); }, [dock.stand.x + 0.9, dock.stand.z - 0.9]);
  await sleep(900);
  await page.keyboard.press("e");
  await page.waitForSelector("[data-testid=talk-box][data-ready]", { timeout: 30000 });
  await sleep(1300);
  await shot(`${P}-talk-bram-first`);
  log.push({ friendRow: await T(() => !!document.querySelector("[data-testid=talk-box] [data-testid=give-gift]")), line: await T(() => document.querySelector("[data-testid=talk-box] [aria-live]")?.textContent ?? "") });
} catch (e) {
  log.push({ failed: String(e).slice(0, 400) }); console.log("FAILED", String(e).slice(0, 400));
  await shot(`${P}-zz-failed`).catch(() => {});
}
writeFileSync(`${OUT}/log-${LIGHT}.json`, JSON.stringify(log, null, 1));
await browser.close();
