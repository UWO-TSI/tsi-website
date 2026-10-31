// daily-social r3 evidence on the new world (NEXT_PUBLIC_GAME_WORLD=new on the dev server), headless and muted.
//   PORT=3147 SCRATCH=<dir> ONLY=friends,monument,streak TAG=before|after node specs/evidence/daily-social/r3/shoot.mjs <outDir>
// Signed out locally, so the friendship and economy APIs are mocked in the shapes their routes return (the server side
// is resident_friendship_smoke.sql and welcome_week_smoke.sql); the monument reads the demo club goals (?progression=demo).
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/daily-social/r3"] = process.argv.slice(2);
const TMP = process.env.SCRATCH ?? "/tmp";
const PORT = process.env.PORT ?? 3147;
const BASE = `http://localhost:${PORT}/lab/island`;
const WORLD = JSON.parse(readFileSync(new URL("../../../../web/data/world/world.json", import.meta.url)));
const MONUMENT = WORLD.objects.find(o => o.kind === "landmark" && o.id === "monument");
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const NAMES = { wren: "Alice", mayor: "Mayor Eliza", shopkeeper: "Toren", curator: "Odile", crafter: "Pim", juniper: "Juniper", marlo: "Marlo", nell: "Nell", "wharf-keeper": "Bram", "oracle-keeper": "Sable" };
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null;
const run = name => !ONLY || ONLY.includes(name);
const FULL = { x: 0, y: 24, width: 1100, height: 676 }; // below the lab's link bar
const TOAST = { x: 250, y: 480, width: 600, height: 220 };
const shot = async (page, name, clip = FULL) => { await page.screenshot({ path: `${TMP}/${name}.png`, clip }); console.log("shot", name); };

async function context(day = null) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  await ctx.addInitScript(look => { try { localStorage.setItem("tsi.look.v1", look); localStorage.removeItem("tsi.gift.later"); localStorage.removeItem("tsi.moveKeys.v1"); localStorage.removeItem("tsi.moves.v1"); } catch {} }, LOOK);
  // Odile at 1 heart; the day's first talk adds half (2 to 3), a loved gift a whole heart (3 to 5, heart 2 pays coins).
  await ctx.route("**/api/npc/friendship", r => {
    if (r.request().method() === "GET") return r.fulfill({ json: { ok: true, friends: Object.fromEntries(Object.keys(NAMES).map(s => [s, 2])) } });
    const { resident, gift } = JSON.parse(r.request().postData());
    const move = gift ? { was: 3, level: 5, coins: 100, letter: false, taste: "love" } : { was: 2, level: 3, coins: 0, letter: false, taste: null };
    return r.fulfill({ json: { ok: true, friend: { resident, name: NAMES[resident] ?? resident, ...move } } });
  });
  const BAG = [["bug_ladybug", 2], ["fish_dace", 1], ["apple", 5], ["flower_rose", 3], ["bug_honeybee", 1], ["rock_stone", 4]];
  await ctx.route("**/api/collections/bag", r => r.fulfill({ json: { ok: true, bag: { items: BAG.map(([item_key, count]) => ({ item_key, count, locked: false, best_size_cm: null })),
    capacity: 20, used: 6, chest: [], chest_capacity: 200, chest_used: 0, museum: {} } } }));
  await ctx.route("**/api/world/campfire", r => r.fulfill({ json: { ok: true, campfire: { coins: 25, paid: true, balance: 145 } } }));
  if (day) {
    const icon = k => `/assets/icons/${k}.webp`;
    const REEL = [["wear-top-cardigan", "Cardigan", "top_cardigan"], ["acc-beanie", "Beanie", "acc_beanie"], ["acc-straw-hat", "Straw hat", "acc_straw_hat"],
      ["acc-glasses-round", "Round glasses", "acc_glasses_round"], ["wear-bottom-pleated-skirt", "Pleated skirt", "bottom_pleated_skirt"], ["acc-plaid-scarf", "Plaid scarf", "acc_plaid_scarf"],
      ["wear-top-sweater-vest", "Sweater vest", "top_sweater_vest"], ["acc-cowboy-hat", "Cowboy hat", "acc_cowboy_hat"], ["wear-top-collar-shirt", "Collar shirt", "top_collar_shirt"]]
      .map(([slug, name, k]) => ({ slug, name, icon: icon(k) }));
    await ctx.route("**/api/economy/wallet", r => r.fulfill({ json: { ok: true, wallet: { coins: 120, gems: 0, daily_claimed: false, day: "2026-11-03", welcome_day: day, recent: [] } } }));
    const [coins, gems] = [[200, 0], [300, 0], [0, 5], [400, 0], [0, 10], [600, 0], [0, 10]][day - 1]; // lib/wallet/catalogue.ts WELCOME_TRACK
    await ctx.route("**/api/economy/daily-gift", r => r.fulfill({ json: { ok: true, gift: { coins: 10, balance: 120 + 10 + coins, claimed: true, day: "2026-11-03",
      welcome: { day, coins, gems, item: day === 7 ? REEL[3] : null, reel: day === 7 ? REEL : [] } } } }));
  }
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  return { ctx, page };
}
/** Open the island and wait for the walker and the residents to settle. */
async function open(query, day = null, toastText = null, toastShot = null) {
  const { ctx, page } = await context(day);
  await page.goto(`${BASE}?weather=clear&${query}`, { waitUntil: "domcontentloaded", timeout: 300000 });
  let caught = !toastText;
  for (let i = 0, ok = 0; i < 300 && (ok < 8 || (!caught && i < 120)); i++) {
    await page.waitForTimeout(caught ? 1000 : 250);
    ok = (await page.evaluate(() => !!window.__move?.sim?.current && !!window.__residents)) ? ok + 1 : 0;
    if (!caught && await page.getByText(toastText).first().isVisible().catch(() => false)) { caught = true; await page.waitForTimeout(1200); await shot(page, toastShot); } // a quiet toast eases in over 0.9 s
  }
  await page.waitForTimeout(2000);
  return { ctx, page };
}
const montage = (name, files, tile, geo) => {
  const args = ["montage"];
  files.filter(f => existsSync(`${TMP}/${f}.png`)).forEach(f => args.push("-label", f, `${TMP}/${f}.png`));
  args.push("-tile", tile, "-geometry", geo, "-background", "#0b0e14", "-fill", "#f1ffff", "-font", "/System/Library/Fonts/Monaco.ttf", "-pointsize", "13", "-quality", "75", `${OUT}/${name}.webp`);
  execFileSync("magick", args);
  console.log("wrote", `${OUT}/${name}.webp`);
};


const TAG = process.env.TAG ?? "after";
/** Walk up to a resident from the first side where their Talk prompt shows; E opens the talk. */
async function talkTo(page, slug, name) {
  for (let tries = 0; tries < 12; tries++) {
    const who = (await page.evaluate(() => window.__residents())).find(r => r.slug === slug && !r.hidden);
    if (!who) { await page.waitForTimeout(1000); continue; }
    for (const sd of ["x+", "x-", "z+", "z-"]) {
      const d = sd[1] === "+" ? 1.2 : -1.2, [ax, az] = sd[0] === "x" ? [who.x + d, who.z + 0.3] : [who.x + 0.3, who.z + d];
      await page.evaluate(([x, z, y]) => window.__move.teleport(x, z, y), [ax, az, Math.atan2(who.x - ax, who.z - az)]);
      await page.waitForTimeout(800);
      const prompt = await page.evaluate(n => [...document.querySelectorAll("button, p[role=status]")].some(b => (b.textContent ?? "").includes(`Talk to ${n}`)), name);
      if (!prompt) continue;
      await page.keyboard.press("e");
      await page.waitForTimeout(900);
      if (await page.locator('[data-testid="talk-box"]').isVisible().catch(() => false)) return true;
      await page.keyboard.press("Escape");
    }
    await page.waitForTimeout(1500);
  }
  return false;
}
const talkState = page => page.evaluate(() => {
  const box = document.querySelector('[data-testid="talk-box"]');
  return box ? { ready: box.hasAttribute("data-ready"), hearts: box.querySelector('[aria-label^="Friendship"]')?.getAttribute("aria-label") ?? "" } : null;
});

// d-friends: half a heart only for a whole talk. Leave one early (nothing sent), then talk to Odile to her last line: the
// half heart lands as that line is read.
if (run("friends")) {
  const { ctx, page } = await open("at=15:40&progression=demo");
  const posts = [];
  page.on("request", r => { if (r.url().includes("/api/npc/friendship") && r.method() === "POST") posts.push(r.postData()); });
  if (await talkTo(page, "curator", "Odile")) {
    await page.waitForTimeout(2500);
    await shot(page, "friends-1-open");
    await page.keyboard.press("Escape"); // left after the first line
    await page.waitForTimeout(1500);
    console.log("left early, posts:", posts.length);
    await talkTo(page, "curator", "Odile");
    let n = 0;
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(700);
      const s = await talkState(page);
      if (!s) break;
      const last = await page.evaluate(() => /Bye/.test(document.querySelector('[data-testid="talk-box"]')?.textContent ?? ""));
      if (s.ready && last) { await page.waitForTimeout(1600); await shot(page, "friends-3-last-line"); console.log("last line, posts:", posts.length, (await talkState(page)).hearts); break; }
      if (s.ready) { if (n === 0) await shot(page, "friends-2-mid"); console.log("line", ++n, "posts:", posts.length, s.hearts); await page.keyboard.press("e"); }
    }
    await page.keyboard.press("e"); // Bye
    await page.waitForTimeout(1200);
    await shot(page, "friends-4-bye");
    console.log("posts", posts.length, posts.join(" "));
  } else console.log("no talk");
  await ctx.close();
  for (const f of ["friends-2-mid", "friends-3-last-line"]) execFileSync("magick", [`${TMP}/${f}.png`, "-crop", "180x60+700+420", "+repage", "-resize", "300%", `${TMP}/${f}-hearts.png`]);
  montage("r3-d-friends-talk", ["friends-1-open", "friends-2-mid", "friends-3-last-line", "friends-4-bye", "friends-2-mid-hearts", "friends-3-last-line-hearts"], "2x", "550x338+4+4");
}

// d-monument: the monument area from the game camera, a few steps north of it, at each build stage (STAGES, the dev
// ?monument= override; the club goal's percent picks it in the game, lib/progression/goals.ts monumentStage).
if (run("monument")) {
  for (const stage of (process.env.STAGES ?? "0,1,2,3,4").split(",")) {
    const { ctx, page } = await open(`time=day&progression=demo&monument=${stage}`);
    const { x: mx, z: mz } = MONUMENT;
    await page.evaluate(([x, z, y]) => window.__move.teleport(x, z, y), [mx + 1.2, mz - 4.2, 0]);
    await page.waitForTimeout(3500);
    await shot(page, `monument-${TAG}-${stage}`);
    await ctx.close();
  }
}

// d-streak: day 7 ahead on the track shows a rare gear icon with the rare edge; its shake, frame by frame (the CSS
// animation paused at points through its wiggle).
if (run("streak")) {
  const { ctx, page } = await context(6);
  await page.goto(`${BASE}?time=day&weather=clear`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.waitForSelector('[aria-labelledby="daily-gift-title"]', { timeout: 300000 });
  await page.waitForTimeout(6000);
  await shot(page, "streak-track");
  const tile = await page.locator("li[data-rarity]").boundingBox();
  const clip = { x: tile.x - 14, y: tile.y - 14, width: tile.width + 28, height: tile.height + 28 };
  const frames = [];
  for (const [i, f] of [0, 0.83, 0.86, 0.89, 0.92, 0.95].entries()) {
    await page.evaluate(t => document.getAnimations().filter(a => a.animationName === "shake" || /shake/.test(a.animationName ?? "")).forEach(a => { a.pause(); a.currentTime = 1200 + 3600 * (1 + t); }), f);
    await page.waitForTimeout(150);
    await shot(page, `streak-shake-${i}`, clip);
    frames.push(`streak-shake-${i}`);
  }
  console.log("shake animations", await page.evaluate(() => document.getAnimations().filter(a => /shake/.test(a.animationName ?? "")).length));
  await ctx.close();
  montage("r3-d-streak", ["streak-track"], "1x", "1100x676+0+0");
  montage("r3-d-streak-shake", frames, "6x", "180x+10+6");
}
await browser.close();
