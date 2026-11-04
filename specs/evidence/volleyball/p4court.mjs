// Volleyball round 4 (game/volleyball): the court's leaderboard podium on the island (a still and a frame strip of the
// dance), and the kit piece in the showroom, headless (muted, signed out), against a dev server on PORT with the
// Supabase env blanked.
//   PORT=3473 node specs/evidence/volleyball/p4court.mjs <out_dir>
import { createRequire } from "node:module";
import { mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT = "specs/evidence/volleyball/p4"] = process.argv.slice(2), BASE = `http://localhost:${process.env.PORT ?? 3473}`;
mkdirSync(OUT, { recursive: true });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", extras: [], bangs: "", back: "hair_bob_pigtail", top: "top_tee", bottom: "bottom_shorts", onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {} });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });

async function open(url, wait) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([look]) => { try { localStorage.setItem("tsi.look.v1", look); localStorage.setItem("tsi.liteMode.v1", "false"); localStorage.setItem("tsi.shadows.v1", "true"); } catch {} }, [LOOK]);
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
  await page.goto(BASE + url);
  if (wait) await page.waitForFunction(w => !!window[w], wait, { timeout: 300000 });
  await page.addStyleTag({ content: "nav, nextjs-portal, #island-options, [aria-controls='island-options'] { display: none !important; }" }).catch(() => {});
  return { ctx, page };
}

const island = "/lab/island?fixture=v2&time=day&weather=clear&season=summer";
for (const [name, q, yaw] of [["board-podium", "&at=5.5,101.5&sheet=vboard", -Math.PI / 2]]) {
  try {
    const { ctx, page } = await open(island + q, "__move");
    await page.waitForTimeout(9000);
    await page.evaluate(y => { const g = window.__governor; if (g) { g.hold = 1e9; g.set(0); } const o = window.__orbit?.orbit; if (o) { o.target.yaw = o.view.yaw = y; o.idle = -1e9; } }, yaw);
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    // The dance: six frames a third of a second apart, cropped to the podium, into one strip.
    const box = await page.locator("[role=list][aria-label='Top three this week']").boundingBox();
    const shots = [];
    for (let i = 0; i < 6; i++) { const f = `${OUT}/.dance-${i}.png`; await page.screenshot({ path: f, clip: { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height + 20 } }); shots.push(f); await page.waitForTimeout(330); }
    execFileSync("magick", [...shots, "+append", `${OUT}/.dance.png`]);
    execFileSync("cwebp", ["-quiet", "-q", "85", `${OUT}/.dance.png`, "-o", `${OUT}/board-dance.webp`]);
    for (const f of [...shots, `${OUT}/.dance.png`]) rmSync(f);
    await ctx.close();
    console.log("done", name);
  } catch (e) { console.log("failed", name, e.message.slice(0, 300)); }
}
// The kit piece in the showroom (the base theme), cropped to its section.
try {
  const { ctx, page } = await open("/lab/gui#rank");
  const sec = page.locator("#rank");
  await sec.waitFor({ timeout: 300000 });
  await sec.scrollIntoViewIfNeeded();
  await page.waitForTimeout(8000);
  await sec.screenshot({ path: `${OUT}/podium-showroom.png` });
  await ctx.close();
  console.log("done podium-showroom");
} catch (e) { console.log("failed podium-showroom", e.message.slice(0, 300)); }
await browser.close();
