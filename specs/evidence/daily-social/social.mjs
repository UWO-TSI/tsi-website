// d-friends, d-monument and s-campfire evidence on the village (/lab/island), headless and muted.
//   PORT=3147 SCRATCH=<dir> node specs/evidence/daily-social/social.mjs <outDir>
// Signed out locally, so the friendship API is mocked in the shapes app/api/npc/friendship returns (the server side is
// resident_friendship_smoke.sql); the monument reads the demo club goals (?progression=demo); `?at=20:30` sets the
// world clock inside campfire hour, with that hour's own evening sky (no ?time= override there).
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/daily-social"] = process.argv.slice(2);
const TMP = process.env.SCRATCH ?? "/tmp";
const BASE = `http://localhost:${process.env.PORT ?? 3147}/lab/island`;
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
const SLUGS = ["wren", "mayor", "shopkeeper", "curator", "crafter", "juniper", "marlo", "nell"];
const shots = [];
const ONLY = process.env.ONLY ? process.env.ONLY.split(",") : null; // friends, monument, campfire
const run = name => !ONLY || ONLY.includes(name);

async function open(query, toastText = null, toastShot = null) {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
  await ctx.addInitScript(look => { try { localStorage.setItem("tsi.look.v1", look); } catch {} }, LOOK);
  await ctx.route("**/api/npc/friendship", r => r.request().method() === "GET"
    ? r.fulfill({ json: { ok: true, friends: Object.fromEntries(SLUGS.map(s => [s, 2])) } })
    : r.fulfill({ json: { ok: true, friend: { resident: JSON.parse(r.request().postData()).resident, name: "Odile", level: 3, leveled: true, coins: 0, letter: true } } }));
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  await page.goto(`${BASE}?weather=clear&${query}`, { waitUntil: "domcontentloaded", timeout: 300000 });
  let caught = false;
  for (let i = 0, ok = 0; i < 240 && (ok < 8 || (toastText && !caught && i < 90)); i++) {
    await page.waitForTimeout(1000);
    ok = (await page.evaluate(() => !!window.__move?.sim?.current && !!window.__residents)) ? ok + 1 : 0;
    if (toastText && !caught && await page.getByText(toastText).first().isVisible().catch(() => false)) { caught = true; await page.waitForTimeout(400); await shot(page, toastShot, TOAST); }
  }
  await page.waitForTimeout(2000);
  return { ctx, page };
}
const TOAST = { x: 250, y: 480, width: 600, height: 220 };
const shot = async (page, name, clip) => { await page.screenshot({ path: `${TMP}/${name}.png`, clip }); shots.push(name); console.log("shot", name); };

// d-friends: walk up to a resident, talk (hearts on the box), leave (the level's toast).
if (run("friends")) {
  const { ctx, page } = await open("time=day&progression=demo");
  let talked = false;
  for (let tries = 0; tries < 12 && !talked; tries++) {
    const list = (await page.evaluate(() => window.__residents())).filter(r => !r.hidden);
    const who = list[tries % Math.max(1, list.length)];
    if (!who) { await page.waitForTimeout(1000); continue; }
    await page.evaluate(([x, z]) => window.__move.teleport(x + 1, z + 0.4, -Math.PI / 2), [who.x, who.z]);
    await page.waitForTimeout(700);
    await page.keyboard.press("e");
    await page.waitForTimeout(900);
    talked = await page.locator('[data-testid="talk-box"]').isVisible().catch(() => false);
    if (!talked) await page.keyboard.press("Escape"); // whatever else E opened
    if (talked) { await page.waitForTimeout(1600); console.log("talking to", who.slug); }
  }
  if (talked) {
    await shot(page, "friends-hearts", { x: 150, y: 470, width: 800, height: 230 });
    await page.keyboard.press("Escape");
    await page.getByText(/sent you a letter/).first().waitFor({ timeout: 6000 }).catch(() => {});
    await shot(page, "friends-toast", TOAST);
  } else console.log("no talk");
  await ctx.close();
}

// d-monument: walk up to the monument, its prompt, E opens the club goal with your share and Contribute.
if (run("monument")) {
  const { ctx, page } = await open("time=day&progression=demo");
  // The monument's footprint (lib/game/defaultIsland.ts landmarks): (-5.2, 3.4), 1.1 by 1 half; walk up to its front edge.
  let found = "";
  for (const [x, z] of [[-5.2, 4.9], [-5.2, 4.6], [-3.8, 3.4], [-6.6, 3.4], [-5.2, 1.9]]) {
    await page.evaluate(([x, z]) => window.__move.teleport(x, z, Math.PI), [x, z]);
    await page.waitForTimeout(700);
    const p = await page.evaluate(() => [...document.querySelectorAll("button, p[role=status]")].map(b => b.textContent).filter(t => /goal|monument|E/.test(t ?? "")).slice(0, 4).join(" | "));
    console.log("at", x, z, p);
    if (/club goal/i.test(p)) { found = `${x} ${z}`; break; }
  }
  console.log("monument", found || "not found");
  await shot(page, "monument-prompt", { x: 250, y: 300, width: 600, height: 400 });
  await page.keyboard.press("e");
  await page.waitForTimeout(1500);
  await shot(page, "monument-sheet", { x: 0, y: 0, width: 1100, height: 700 });
  await ctx.close();
}

// s-campfire: inside the hour (8:30 pm) the HUD says so and the fire burns.
if (run("campfire")) {
  // The real evening at 8:30 pm game time (no time-of-day override): the sky and light a player sees in the hour.
  const { ctx, page } = await open("at=20:30", /Campfire hour!/, "campfire-toast");
  const site = await page.evaluate(() => window.__campfire?.site ?? null);
  if (site) { await page.evaluate(([x, z]) => window.__move.teleport(x + 2.5, z + 3, Math.PI), [site.x, site.z]); await page.waitForTimeout(2500); }
  console.log("campfire", JSON.stringify(site), await page.evaluate(() => window.__campfire ? { lit: window.__campfire.lit(), light: window.__campfire.light() } : null));
  await shot(page, "campfire-lit", { x: 0, y: 40, width: 1100, height: 660 });
  await ctx.close();
}
await browser.close();
for (const [name, files, tile, geo] of [["d-friends", ["friends-hearts", "friends-toast"], "1x", "800x230+4+4"], ["d-monument", ["monument-prompt", "monument-sheet"], "2x", "550x380+4+4"], ["s-campfire", ["campfire-toast", "campfire-lit"], "2x", "600x400+4+4"]]) {
  const args = ["montage"];
  files.filter(f => existsSync(`${TMP}/${f}.png`)).forEach(f => args.push("-label", f, `${TMP}/${f}.png`));
  args.push("-tile", tile, "-geometry", geo, "-background", "#0b0e14", "-fill", "#f1ffff", "-font", "/System/Library/Fonts/Monaco.ttf", "-pointsize", "13", "-quality", "75", `${OUT}/${name}.webp`);
  execFileSync("magick", args);
  console.log("wrote", `${OUT}/${name}.webp`);
}
