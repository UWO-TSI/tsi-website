// d-friends, d-monument and s-campfire evidence on the village (/lab/island), headless and muted.
//   PORT=3147 SCRATCH=<dir> node specs/evidence/daily-social/social.mjs <outDir>
// Signed out locally, so the friendship API is mocked in the shapes app/api/npc/friendship returns (the server side is
// resident_friendship_smoke.sql); the monument reads the demo club goals (?progression=demo); `?at=20:30` sets the
// world clock inside campfire hour.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/daily-social"] = process.argv.slice(2);
const TMP = process.env.SCRATCH ?? "/tmp";
const BASE = `http://localhost:${process.env.PORT ?? 3147}/lab/island`;
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const SLUGS = ["wren", "mayor", "shopkeeper", "curator", "crafter", "juniper", "marlo", "nell"];
const shots = [];

async function open(query) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  await ctx.addInitScript(look => { try { localStorage.setItem("tsi.look.v1", look); } catch {} }, LOOK);
  await ctx.route("**/api/npc/friendship", r => r.request().method() === "GET"
    ? r.fulfill({ json: { ok: true, friends: Object.fromEntries(SLUGS.map(s => [s, 2])) } })
    : r.fulfill({ json: { ok: true, friend: { resident: JSON.parse(r.request().postData()).resident, name: "Odile", level: 3, leveled: true, coins: 0, letter: true } } }));
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  await page.goto(`${BASE}?time=day&weather=clear&${query}`, { waitUntil: "domcontentloaded" });
  for (let i = 0, ok = 0; i < 240 && ok < 8; i++) { await page.waitForTimeout(1000); ok = (await page.evaluate(() => !!window.__move?.sim?.current && !!window.__residents)) ? ok + 1 : 0; }
  await page.waitForTimeout(2000);
  return { ctx, page };
}
const shot = async (page, name, clip) => { await page.screenshot({ path: `${TMP}/${name}.png`, clip }); shots.push(name); console.log("shot", name); };
const prompt = page => page.locator("button", { hasText: /^(E|Tap)/ }).first().innerText().catch(() => "");

// d-friends: walk up to a resident, talk (hearts on the box), leave (the level's toast).
{
  const { ctx, page } = await open("progression=demo");
  let talked = false;
  for (let tries = 0; tries < 12 && !talked; tries++) {
    const who = (await page.evaluate(() => window.__residents())).find(r => !r.hidden && r.speed < 0.2) ?? (await page.evaluate(() => window.__residents())).find(r => !r.hidden);
    if (!who) { await page.waitForTimeout(1000); continue; }
    await page.evaluate(([x, z]) => window.__move.teleport(x + 1, z + 0.4, -Math.PI / 2), [who.x, who.z]);
    await page.waitForTimeout(700);
    await page.keyboard.press("e");
    talked = await page.locator('[data-testid="talk-box"]').isVisible({ timeout: 2500 }).catch(() => false);
    if (talked) { await page.waitForTimeout(1600); console.log("talking to", who.slug); }
  }
  await shot(page, "friends-hearts", { x: 150, y: 470, width: 800, height: 230 });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
  await shot(page, "friends-toast", { x: 250, y: 0, width: 600, height: 200 });
  await ctx.close();
}

// d-monument: walk up to the monument, its prompt, E opens the club goal with your share and Contribute.
{
  const { ctx, page } = await open("progression=demo");
  let found = "";
  for (const s of [1, 1.25, 1.5, 1.75, 2, 2.5, 3, 3.5, 4]) {
    for (const [dx, dz] of [[0, 2], [2, 0], [-2, 0], [0, -2], [0, 3]]) {
      await page.evaluate(([x, z]) => window.__move.teleport(x, z, Math.PI), [-5.2 * s + dx, 3.4 * s + dz]);
      await page.waitForTimeout(500);
      const p = await prompt(page);
      if (/club goal/i.test(p)) { found = `${s} ${dx} ${dz}`; break; }
    }
    if (found) break;
  }
  console.log("monument", found || "not found");
  await shot(page, "monument-prompt", { x: 250, y: 300, width: 600, height: 400 });
  await page.keyboard.press("e");
  await page.waitForTimeout(1500);
  await shot(page, "monument-sheet", { x: 0, y: 0, width: 1100, height: 700 });
  await ctx.close();
}

// s-campfire: inside the hour (8:30 pm) the HUD says so and the fire burns.
{
  const { ctx, page } = await open("at=20:30");
  await shot(page, "campfire-toast", { x: 250, y: 0, width: 600, height: 200 });
  const site = await page.evaluate(() => window.__campfire?.site ?? null);
  if (site) { await page.evaluate(([x, z]) => window.__move.teleport(x, z + 4.5, Math.PI), [site.x, site.z]); await page.waitForTimeout(2500); }
  console.log("campfire", JSON.stringify(site), await page.evaluate(() => window.__campfire ? { lit: window.__campfire.lit(), light: window.__campfire.light() } : null));
  await shot(page, "campfire-lit", { x: 250, y: 150, width: 600, height: 450 });
  await ctx.close();
}
await browser.close();
for (const [name, files, tile, geo] of [["d-friends", ["friends-hearts", "friends-toast"], "1x", "800x230+4+4"], ["d-monument", ["monument-prompt", "monument-sheet"], "2x", "550x380+4+4"], ["s-campfire", ["campfire-toast", "campfire-lit"], "2x", "600x450+4+4"]]) {
  const args = ["montage"];
  files.filter(f => shots.includes(f)).forEach(f => args.push("-label", f, `${TMP}/${f}.png`));
  args.push("-tile", tile, "-geometry", geo, "-background", "#0b0e14", "-fill", "#f1ffff", "-pointsize", "13", "-quality", "75", `${OUT}/${name}.webp`);
  execFileSync("magick", args);
  console.log("wrote", `${OUT}/${name}.webp`);
}
