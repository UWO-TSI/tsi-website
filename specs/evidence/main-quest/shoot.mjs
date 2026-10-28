// Evidence for the main-quest lane (specs/launch/v1-gameplay.md t-next, m1 to m6): the quest dropdown and its guide
// arrow, Juno taking the first catch (chapter 1 ends there), the dropdown on each later chapter, the marked dig spots on
// sand and dirt, and the pickaxe at a rock. Signed out against the dev server (Supabase env blanked) with
// `?progression=demo` (the real progression service on an in-memory store; `&chapter=` and `&tally=` set where the
// member is). Headless Chromium, muted, under the shared browser lock.
//   HOST=http://localhost:3147 node specs/evidence/main-quest/shoot.mjs <out_dir> <scene> [<scene> ...]
// Scenes: r2flow, r2museum, r2dig (round 2); flow, chapters, dig, pickaxe (round 1; the new world: run the dev server with NEXT_PUBLIC_GAME_WORLD=new); village (the
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

/** The HUD in: the arrival's fade over and the tracker shown (round 1's line shot was taken under the fade, David: "i dont see"). */
async function hudIn(page) {
  await page.waitForFunction(() => {
    const t = document.querySelector("[data-testid=quest-tracker]");
    return !!t && !t.hasAttribute("data-hidden") && getComputedStyle(t).opacity === "1" && t.getBoundingClientRect().width > 0;
  }, null, { timeout: 120000 });
  await sleep(9000); // the arrival's fade
}
/** The line and the minimap beside it (top right). */
async function lineClip(page) {
  const r = await page.$eval("[data-testid=quest-tracker]", el => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, b: b.bottom }; });
  return { x: Math.max(0, r.x - 40), y: 40, width: 1440 - Math.max(0, r.x - 40), height: 210 };
}
const widths = page => page.evaluate(() => {
  const t = document.querySelector("[data-testid=quest-tracker]"), l = document.querySelector("#quest-list");
  return { bar: t?.getBoundingClientRect().width ?? null, list: l?.getBoundingClientRect().width ?? null, barLeft: t?.getBoundingClientRect().left ?? null, listLeft: l?.getBoundingClientRect().left ?? null };
});

for (const scene of SCENES) {
  if (scene === "r2flow") {
    const { ctx, page } = await open("");
    await go(page, 30, 46, Math.PI);
    await hudIn(page);
    await shot(page, "r2-01-line", await lineClip(page));
    await openList(page);
    await sleep(600);
    log.push({ name: "r2-02-dropdown", widths: await widths(page) });
    await shot(page, "r2-02-dropdown", await dropdownClip(page));
    const arrow = await page.$eval("#quest-list button[aria-pressed]", b => ({ label: b.getAttribute("aria-label"), text: b.textContent }));
    log.push({ name: "r2-03-arrow-button", arrow });
    await page.click("#quest-list button[aria-pressed]");
    await sleep(600);
    await shot(page, "r2-03-arrow-pressed", await dropdownClip(page));
    log.push({ name: "r2-03-arrow-pressed", pressed: await page.$eval("#quest-list button[aria-pressed]", b => [b.getAttribute("aria-pressed"), b.getAttribute("aria-label")]) });
    await page.click("[data-testid=quest-tracker] button[aria-expanded]");
    await sleep(1500);
    await shot(page, "r2-03-arrow-to-museum");
    // To the museum: Juno takes the first catch; chapter 1's XP takes you to level 2 and the card says what's new.
    await go(page, 4, 66, 0);
    await sleep(3000);
    await besides(page, "docent");
    await sleep(1200);
    try { await talkTo(page, "docent", "r2-05-juno-talk"); } catch (e) { console.log("no talk", e.message.slice(0, 120)); }
    await page.waitForSelector("[data-testid=level-up]", { timeout: 20000 }).catch(() => console.log("no level-up card"));
    await sleep(900);
    await shot(page, "r2-06-level-up");
    log.push({ name: "r2-06-level-up", card: await page.$eval("[data-testid=level-up]", el => el.textContent).catch(() => null) });
    await page.keyboard.press("Escape");
    await sleep(800);
    await openList(page);
    await sleep(600);
    await shot(page, "r2-07-next-chapter", await dropdownClip(page));
    await ctx.close();
  }
  if (scene === "r2museum") {
    const { ctx, page } = await open("collections=demo&chapter=the-museum&tally=donations:1");
    await hudIn(page);
    await openList(page);
    await sleep(600);
    await shot(page, "r2-10-the-museum", await dropdownClip(page));
    await page.click("[data-testid=quest-tracker] button[aria-expanded]");
    await sleep(400);
    await go(page, 4, 66, 0);
    await sleep(3000);
    console.log("near", JSON.stringify(await besides(page, "curator")));
    await page.keyboard.press("e");
    await page.waitForSelector("[data-testid=talk-box]", { timeout: 20000 }).catch(() => console.log("no talk box"));
    await sleep(1000);
    await shot(page, "r2-11-odile-drive-talk");
    for (let k = 0; k < 14 && await page.$("[data-testid=talk-box]"); k++) { await page.keyboard.press("e"); await sleep(700); }
    await page.waitForSelector("[data-testid=donate-sheet]", { timeout: 20000 }).catch(() => console.log("no drive sheet"));
    await sleep(2500);
    await shot(page, "r2-12-museum-drive");
    const rows = await page.$$eval("[data-testid=donate-sheet] [data-key]", els => els.map(e => e.textContent));
    log.push({ name: "r2-12-museum-drive", rows: rows.slice(0, 12) });
    const handIn = await page.$("[data-testid=donate-sheet] [data-key]:has-text('Hand in')");
    if (handIn) { await handIn.click(); await sleep(1500); await shot(page, "r2-13-handed-in"); } else console.log("no hand-in row");
    await ctx.close();
  }
  if (scene === "pops") {
    // The reward pop for a bug, a forage find and a dig (and a dig's purse), fired as the world fires them. POPS=before|after.
    const { ctx, page } = await open("");
    await hudIn(page);
    const pops = [
      ["bug", { key: "bug_common_butterfly", name: "Common Butterfly", rarity: "common", size: 6.2, isNew: false, kind: "bug" }],
      ["forage", { key: "shell_asari", name: "Asari Clam", rarity: "common", size: 4.1, isNew: true, kind: "forage" }],
      ["dig", { key: "find_ammonite", name: "Ammonite", rarity: "rare", size: 11.2, isNew: true, kind: "dig" }],
      ["dig-sudo", { key: "find_broken_sudo", name: "Broken Sudo", rarity: "legendary", size: 10.5, isNew: true, kind: "dig" }],
    ];
    for (const [name, detail] of pops) {
      await page.evaluate(d => window.dispatchEvent(new CustomEvent("tsi:peaceful-got", { detail: d })), detail);
      await sleep(900);
      const box = await page.$eval("[data-testid=reward-card]", el => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }).catch(() => null);
      await shot(page, `pop-${process.env.POPS ?? "now"}-${name}`, box ? { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 40), width: Math.min(1440, box.w + 80), height: Math.min(900, box.h + 80) } : undefined);
      await page.mouse.click(10, 880);
      await sleep(700);
    }
    if (process.env.POPS === "after") {
      await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:dig-purse", { detail: { currency: "gems", amount: 1 } })));
      await sleep(900);
      const box = await page.$eval("[data-testid=reward-card]", el => { const b = el.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; }).catch(() => null);
      await shot(page, "pop-after-dig-gem", box ? { x: Math.max(0, box.x - 40), y: Math.max(0, box.y - 40), width: box.w + 80, height: box.h + 80 } : undefined);
    }
    await ctx.close();
  }
  if (scene === "r2dig") {
    const { ctx, page } = await open("collections=demo&time=day", { "tsi.held.v1": JSON.stringify({ held: "shovel:shovel-basic" }) });
    await hudIn(page);
    await go(page, -15.8, 99.5, 0);
    await sleep(2500);
    await shot(page, "r2-20-dig-mark-sand");
    await shot(page, "r2-20-dig-mark-sand-close", { x: 420, y: 260, width: 600, height: 420 });
    await go(page, 36.2, 81.5, 0);
    await sleep(2500);
    await shot(page, "r2-21-dig-mark-dirt");
    await shot(page, "r2-21-dig-mark-dirt-close", { x: 420, y: 260, width: 600, height: 420 });
    await ctx.close();
  }
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
