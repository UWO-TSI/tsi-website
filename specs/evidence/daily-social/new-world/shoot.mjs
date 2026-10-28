// daily-social evidence on the new world (NEXT_PUBLIC_GAME_WORLD=new on the dev server), headless and muted.
//   PORT=3147 SCRATCH=<dir> ONLY=streak,friends,monument,campfire,dash node specs/evidence/daily-social/new-world/shoot.mjs <outDir>
// Signed out locally, so the economy, friendship and campfire APIs are mocked in the shapes their routes return (the
// server side is welcome_week_smoke.sql and resident_friendship_smoke.sql); the monument reads the demo club goals
// (?progression=demo); `?at=20:30` puts the world clock inside campfire hour. Places come from the world itself
// (web/data/world/world.json): the monument landmark, the campfire object (window.__campfire), the residents (window.__residents).
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/daily-social/new-world"] = process.argv.slice(2);
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
    if (!caught && await page.getByText(toastText).first().isVisible().catch(() => false)) { caught = true; await page.waitForTimeout(300); await shot(page, toastShot); }
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

// d-streak: the gift card's reward track over the new world (day 3 offered and opened, day 5 offered; day 7's box: the
// wheel spinning and stopped).
if (run("streak")) {
  for (const [day, steps] of [[3, [["day3-offer", false, 900], ["day3-opened", true, 1400]]], [5, [["day5-offer", false, 900]]], [7, [["day7-offer", false, 900], ["day7-spin", true, 1700], ["day7-won", false, 3800]]]]) {
    const { ctx, page } = await context(day);
    await page.goto(`${BASE}?time=day&weather=clear`, { waitUntil: "domcontentloaded", timeout: 300000 });
    await page.waitForSelector('[aria-labelledby="daily-gift-title"]', { timeout: 300000 });
    await page.waitForTimeout(6000);
    for (const [name, act, wait] of steps) {
      if (act) await page.locator('[aria-labelledby="daily-gift-title"]').getByRole("button", { name: /Open/ }).click();
      await page.waitForTimeout(wait);
      await shot(page, `streak-${name}`);
    }
    await ctx.close();
  }
  montage("nw-d-streak", ["streak-day3-offer", "streak-day3-opened", "streak-day5-offer", "streak-day7-offer", "streak-day7-spin", "streak-day7-won"], "3x", "550x338+4+4");
}

// d-friends: walk up to Odile, talk (hearts on the box), leave (the level's toast).
if (run("friends")) {
  const { ctx, page } = await open(process.env.FRIENDS_Q ?? "at=14:00&progression=demo");
  let talked = false, spot = null;
  for (let tries = 0; tries < 12 && !talked; tries++) {
    const list = (await page.evaluate(() => window.__residents())).filter(r => !r.hidden);
    const who = list.find(r => r.slug === "curator");
    if (!who) { await page.waitForTimeout(1000); continue; }
    // Approach from the first side (or SIDE) where her Talk prompt shows: buildings and nets stand on some sides.
    let side = null;
    for (const sd of process.env.SIDE ? [process.env.SIDE] : ["x-", "x+", "z-", "z+"]) {
      const d = sd[1] === "+" ? 1.2 : -1.2, [ax, az] = sd[0] === "x" ? [who.x + d, who.z + 0.3] : [who.x + 0.3, who.z + d];
      await page.evaluate(([x, z, y]) => window.__move.teleport(x, z, y), [ax, az, Math.atan2(who.x - ax, who.z - az)]);
      await page.waitForTimeout(800);
      const prompt = await page.evaluate(() => [...document.querySelectorAll("button, p[role=status]")].map(b => b.textContent).filter(t => /Talk to Odile/.test(t ?? "")).join(" | "));
      console.log("try", sd, who.slug, who.x.toFixed(1), who.z.toFixed(1), prompt);
      if (prompt) { side = sd; break; }
    }
    if (!side) { await page.waitForTimeout(1500); continue; }
    await page.keyboard.press("e");
    await page.waitForTimeout(900);
    talked = await page.locator('[data-testid="talk-box"]').isVisible().catch(() => false);
    if (!talked) await page.keyboard.press("Escape");
    if (talked) { await page.waitForTimeout(4000); console.log("talking to", who.slug, who.x.toFixed(1), who.z.toFixed(1)); spot = who; }
  }
  if (talked) {
    await page.waitForTimeout(1500);
    await shot(page, "friends-talk");
    // The gift button: your bag in small cards; a loved one, and her answer while the hearts move.
    await page.getByTestId("give-gift").click();
    await page.waitForTimeout(1200);
    await shot(page, "friends-picker");
    await page.getByTestId("gift-picker").getByRole("button").first().click();
    await page.waitForTimeout(2600);
    console.log("answer:", (await page.locator('[data-testid="talk-box"]').innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 120));
    await shot(page, "friends-gift");
  } else console.log("no talk");
  await ctx.close();
  montage("nw-d-friends", ["friends-talk", "friends-picker", "friends-gift"], "3x", "550x338+4+4");
}

// d-monument: walk up to the new world's monument, its prompt; E opens the club goal with your share and Contribute.
if (run("monument")) {
  const { ctx, page } = await open("time=day&progression=demo");
  // Some progress to see: the demo member chips in coins and their dace (the demo's in-page routes, lib/game/progressionDemo.ts).
  console.log("chipped in", await page.evaluate(async () => {
    const post = body => fetch("/api/progression/contribute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json()).then(j => j.contribution?.goal?.points ?? j.error);
    return [await post({ goal_slug: "reopen-cafe", kind: "coins", amount: 1500, item_key: null, idempotency_key: "shot-coins-1" })];
  }));
  const { x: mx, z: mz } = MONUMENT;
  let found = "";
  for (const [dx, dz, yaw] of [[2.4, 0, -Math.PI / 2], [0, 2.2, Math.PI], [0, -2.2, 0], [-2.4, 0, Math.PI / 2], [2.0, 0, -Math.PI / 2], [0, 1.9, Math.PI]]) {
    await page.evaluate(([x, z, y]) => window.__move.teleport(x, z, y), [mx + dx, mz + dz, yaw]);
    await page.waitForTimeout(900);
    const p = await page.evaluate(() => [...document.querySelectorAll("button, p[role=status]")].map(b => b.textContent).filter(t => /club goal/i.test(t ?? "")).slice(0, 2).join(" | "));
    console.log("at", mx + dx, mz + dz, p);
    if (p) { found = `${mx + dx} ${mz + dz}`; break; }
  }
  console.log("monument", found || "not found");
  await shot(page, "monument-prompt");
  await page.keyboard.press("e");
  await page.waitForTimeout(1500);
  await shot(page, "monument-sheet");
  await ctx.close();
  montage("nw-d-monument", ["monument-prompt", "monument-sheet"], "2x", "550x338+4+4");
}

// s-campfire: inside the hour (8:30 pm) the HUD says so, the fire burns, you sit by it (SitWarm) and the bonus lands.
if (run("campfire")) {
  const { ctx, page } = await open("at=20:30", null, /Campfire hour/, "campfire-toast");
  const site = await page.evaluate(() => window.__campfire?.site ?? null);
  console.log("campfire", JSON.stringify(site));
  if (site) {
    await page.evaluate(([x, z]) => window.__move.teleport(x + 2.4, z + 3.6, Math.PI), [site.x, site.z]);
    await page.waitForTimeout(2500);
    await shot(page, "campfire-hour");
    // The wheel's Sit by the lit fire: the nearest seat of its ring, facing the fire (lib/game/emotePlay.ts).
    await page.evaluate(([fx, fz]) => {
      const a = Math.PI / 2, x = fx + Math.sin(a) * 2.1, z = fz + Math.cos(a) * 2.1;
      window.dispatchEvent(new CustomEvent("tsi:sit", { detail: { x, z, yaw: Math.atan2(fx - x, fz - z), clip: "SitWarm", ground: true } }));
    }, [site.x, site.z]);
    let paid = false;
    for (let i = 0; i < 45 && !paid; i++) { await page.waitForTimeout(1000); paid = await page.getByText(/warm by the fire/).first().isVisible().catch(() => false); }
    console.log("bonus toast", paid, await page.evaluate(() => ({ lit: window.__campfire.lit(), light: window.__campfire.light() })));
    await shot(page, "campfire-sat");
  }
  await ctx.close();
  montage("nw-s-campfire", ["campfire-toast", "campfire-sat"], "2x", "550x338+4+4");
}

// x-moves: with the shipped locks on (?moves=locked), Q dashes from the start; the glider stays locked.
if (run("dash")) {
  const { ctx, page } = await open("moves=locked&time=day");
  const st = () => page.evaluate(() => { const s = window.__move?.sim?.current?.state; if (!s) return { dashT: 0, dashCd: 0, speed: 0 }; return { dashT: s.dashT, dashCd: s.dashCd, speed: Math.hypot(s.vx, s.vz) }; });
  await page.mouse.click(550, 350);
  await page.keyboard.down("w");
  await page.waitForTimeout(900);
  const before = await st();
  await shot(page, "dash-walk");
  await page.keyboard.press("q");
  let peak = { dashT: 0, dashCd: 0, speed: 0 }, taken = false;
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(40);
    const s = await st();
    if (s.speed > peak.speed) peak = s;
    if (s.dashCd > peak.dashCd) peak.dashCd = s.dashCd;
    if (!taken && s.dashT > 0) { taken = true; await shot(page, "dash-q"); }
  }
  if (!taken) await shot(page, "dash-q");
  await page.keyboard.up("w");
  console.log(JSON.stringify({ before, peak }), peak.dashCd > 0 || peak.speed > before.speed * 1.5 ? "DASH OK" : "NO DASH");
  await ctx.close();
  montage("nw-x-moves-dash", ["dash-walk", "dash-q"], "2x", "550x350+4+4");
}
// The flat kit's reward pieces in the showroom (/lab/gui?only=flat-rewards): hearts stepped, today opened, the wheel spun.
if (run("kit")) {
  const { ctx, page } = await context();
  await page.goto(`http://localhost:${PORT}/lab/gui?only=flat-rewards`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.getByTestId("flat-rewards").waitFor({ timeout: 300000 });
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Spin" }).click();
  await page.getByRole("button", { name: "Loved +1" }).click();
  await page.waitForTimeout(5200);
  await page.getByRole("button", { name: "Open today" }).click();
  await page.waitForTimeout(900);
  await page.getByTestId("flat-rewards").screenshot({ path: `${TMP}/kit-rewards.png` });
  console.log("shot kit-rewards");
  await ctx.close();
  execFileSync("magick", [`${TMP}/kit-rewards.png`, "-resize", "1100x>", "-quality", "75", `${OUT}/nw-kit-rewards.webp`]);
}
await browser.close();
