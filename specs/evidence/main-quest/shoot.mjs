// Evidence for the main-quest lane (specs/launch/v1-gameplay.md t-next, m1 to m6): the quest dropdown and its guide
// arrow, Juno taking the first catch (chapter 1 ends there), the dropdown on each later chapter, the marked dig spots on
// sand and dirt, and the pickaxe at a rock. Signed out against the dev server (Supabase env blanked) with
// `?progression=demo` (the real progression service on an in-memory store; `&chapter=` and `&tally=` set where the
// member is). Headless Chromium, muted, under the shared browser lock.
//   HOST=http://localhost:3147 node specs/evidence/main-quest/shoot.mjs <out_dir> <scene> [<scene> ...]
// Scenes: flow, chapters, dig, pickaxe (the new world: run the dev server with NEXT_PUBLIC_GAME_WORLD=new); village (the
// default world, no env: the village's one tracker line, unchanged).
// Places are the new world's (lib/collections/rolls.ts activeVillage("new"): museum 4,70.5; dig-sand-0 -17,102;
// dig-soil-15 35,84; rock-1 38,25.1).
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SCENES] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const HOST = process.env.HOST ?? "http://localhost:3147";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const errors = [], log = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
// A saved look (a member who has made their character: no creator over the island).
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", extras: [], bangs: "", back: "hair_wispy_ponytail", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_hoodie: 2 } });
const CAMERA = JSON.stringify({ yaw: 0, pitch: 0.55, zoom: 1, sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false });

async function open(query, store = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", e => { errors.push(e.message.slice(0, 300)); console.log("pageerror", e.message.slice(0, 300)); });
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([cam, extra, look]) => {
    localStorage.clear();
    localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
    localStorage.setItem("tsi.camera.v1", cam);
    localStorage.setItem("tsi.look.v1", look);
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, v);
  }, [CAMERA, store, LOOK]);
  await page.goto(`${HOST}/lab/island?progression=demo&${query}`, { waitUntil: "domcontentloaded" });
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
  await page.waitForFunction(() => !!window.__move && !!document.querySelector("[data-testid=quest-tracker]"), null, { timeout: 300000 });
  await sleep(2500);
  return { ctx, page };
}
const go = (page, x, z, yaw = 0) => page.evaluate(([a, b, y]) => { window.__move.teleport(a, b, 0); window.__orbit.orbit.target.yaw = y; window.__orbit.orbit.view.yaw = y; }, [x, z, yaw]);
const tracker = page => page.$eval("[data-testid=quest-tracker]", el => el.textContent);
const prompt = page => page.evaluate(() => [...document.querySelectorAll("main button")].map(b => b.textContent).find(t => /^(E|Tap|Click)[A-Z ]/.test(t ?? "") && !/^Evening/.test(t ?? "")) ?? null);
/** Stand a step in front of a resident (window.__residents), facing them. */
async function besides(page, slug) {
  for (const [dx, dz, yaw] of [[0, -1, 0], [1, 0, -Math.PI / 2], [-1, 0, Math.PI / 2], [0, 1, Math.PI], [0.7, -0.7, -0.8], [-0.7, -0.7, 0.8]]) {
    const r = await page.evaluate(s => window.__residents?.().find(x => x.slug === s) ?? null, slug);
    if (!r) { console.log("residents", JSON.stringify(await page.evaluate(() => window.__residents?.().map(x => x.slug) ?? null))); return null; }
    await go(page, r.x + dx, r.z + dz, yaw);
    await sleep(400);
    const p = await prompt(page);
    if (p && /Talk|Juno|Odile/.test(p)) return r;
    console.log("side", dx, dz, JSON.stringify(r).slice(0, 120), p);
  }
  return null;
}
async function shot(page, name, clip) {
  await page.screenshot({ path: `${OUT}/${name}.png`, ...(clip ? { clip } : {}) });
  const t = await tracker(page).catch(() => null), p = await prompt(page);
  log.push({ name, tracker: t, prompt: p });
  console.log("shot", name, JSON.stringify({ tracker: t, prompt: p }).slice(0, 240));
}
/** The dropdown and the line, cropped (top right). */
async function dropdownClip(page) {
  const box = await page.evaluate(() => {
    const els = [document.querySelector("[data-testid=quest-tracker]"), document.querySelector("#quest-list")].filter(Boolean);
    const r = els.map(e => e.getBoundingClientRect());
    return { x: Math.min(...r.map(b => b.left)), y: Math.min(...r.map(b => b.top)), r: Math.max(...r.map(b => b.right)), b: Math.max(...r.map(b => b.bottom)) };
  });
  return { x: Math.max(0, box.x - 24), y: Math.max(0, box.y - 16), width: Math.min(1440, box.r + 24) - Math.max(0, box.x - 24), height: box.b - box.y + 32 };
}
const openList = page => page.click("[data-testid=quest-tracker] button[aria-expanded]");
async function talkTo(page, slug, name) {
  console.log("near", JSON.stringify(await besides(page, slug)), await prompt(page));
  await page.keyboard.press("e");
  await page.waitForSelector("[data-testid=talk-box]", { timeout: 20000 });
  await sleep(1200);
  await shot(page, name);
  for (let k = 0; k < 14 && await page.$("[data-testid=talk-box]"); k++) { await page.keyboard.press("e"); await sleep(700); }
}

for (const scene of SCENES) {
  if (scene === "flow") {
    const { ctx, page } = await open("");
    await go(page, 30, 46, Math.PI);
    await shot(page, "01-line", { x: 760, y: 0, width: 680, height: 200 });
    await openList(page);
    await sleep(500);
    await shot(page, "02-dropdown", await dropdownClip(page));
    await page.click("#quest-list button[aria-pressed]");
    await sleep(1500);
    await shot(page, "03-arrow-to-museum");
    // To the museum: Juno takes the first catch, and chapter 1 ends with her (no report to Alice).
    await page.click("[data-testid=quest-tracker] button[aria-expanded]");
    await go(page, 4, 66, 0);
    await sleep(3000);
    await besides(page, "docent");
    await sleep(1500);
    await shot(page, "04-juno-at-the-museum");
    try { await talkTo(page, "docent", "05-juno-talk"); } catch (e) { console.log("no talk", e.message.slice(0, 120)); }
    await sleep(2500);
    await shot(page, "06-chapter-1-done");
    await openList(page);
    await sleep(500);
    await shot(page, "07-next-chapter", await dropdownClip(page));
    await ctx.close();
  }
  if (scene === "chapters") {
    for (const [slug, tally] of [["odiles-net", "net:1,bugs:1"], ["pims-shovel", "shovel:1,digs:2"], ["brams-challenge", "fish_kinds:3"], ["the-museum", "donations:1"], ["elizas-pickaxe", "pickaxe:1,stone:2"]]) {
      const { ctx, page } = await open(`chapter=${slug}&tally=${tally}`);
      await openList(page);
      await sleep(600);
      await shot(page, `10-${slug}`, await dropdownClip(page));
      await ctx.close();
    }
  }
  if (scene === "dig") {
    const { ctx, page } = await open("collections=demo&time=day", { "tsi.held.v1": JSON.stringify({ held: "shovel:shovel-basic" }) });
    // Beside the spot, the camera behind: your own body would hide a mark straight ahead.
    await go(page, -15.8, 99.5, 0);
    await sleep(2500);
    await shot(page, "20-dig-mark-sand");
    await shot(page, "20-dig-mark-sand-close", { x: 420, y: 260, width: 600, height: 420 });
    await go(page, 36.2, 81.5, 0);
    await sleep(2500);
    await shot(page, "21-dig-mark-dirt");
    await shot(page, "21-dig-mark-dirt-close", { x: 420, y: 260, width: 600, height: 420 });
    await ctx.close();
  }
  if (scene === "juno") {
    // Chapter 1 ready (a fish caught): Juno at the museum finishes it.
    const { ctx, page } = await open("");
    await go(page, 4, 66, 0);
    await sleep(3000);
    await besides(page, "docent");
    await sleep(1500);
    await shot(page, "04-juno-at-the-museum");
    try { await talkTo(page, "docent", "05-juno-talk"); } catch (e) { console.log("no talk", e.message.slice(0, 120)); }
    await sleep(2500);
    await shot(page, "06-chapter-1-done");
    await openList(page);
    await sleep(500);
    await shot(page, "07-next-chapter", await dropdownClip(page));
    await ctx.close();
  }
  if (scene === "pickaxe") {
    const { ctx, page } = await open("collections=demo&time=day", { "tsi.toolQuests.v1": JSON.stringify({ pickaxe: "given" }), "tsi.held.v1": JSON.stringify({ held: "pickaxe:pickaxe-basic" }) });
    await go(page, 36.6, 25.1, Math.PI / 2);
    await sleep(3000);
    await shot(page, "30-pickaxe-at-a-rock");
    // From the side: the pickaxe in the hand and the ore rock in front.
    await page.evaluate(() => { window.__orbit.orbit.target.yaw = 0.2; window.__orbit.orbit.view.yaw = 0.2; });
    await sleep(1500);
    await shot(page, "31-pickaxe-from-the-side");
    await ctx.close();
  }
  if (scene === "village") {
    // The default world: the village's line, which opens the journal (no dropdown, no chevron).
    const { ctx, page } = await open("");
    await sleep(8000); // the arrival's fade
    await shot(page, "50-village-line", { x: 760, y: 0, width: 680, height: 200 });
    await shot(page, "51-village");
    log.push({ name: "50-village-line", dropdown: !!(await page.$("[data-testid=quest-tracker] button[aria-expanded]")), label: await page.$eval("[data-testid=quest-tracker]", el => el.getAttribute("aria-label")) });
    await ctx.close();
  }
}
writeFileSync(`${OUT}/log.json`, JSON.stringify({ log, errors }, null, 2));
await browser.close();
console.log("errors", errors.length);
