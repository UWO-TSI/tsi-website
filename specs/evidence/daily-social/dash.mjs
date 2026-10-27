// x-moves evidence: with the shipped locks on (?moves=locked), Q dashes and the glider stays locked.
//   PORT=3147 node specs/evidence/daily-social/dash.mjs <outDir>   (headless, muted)
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT = "specs/evidence/daily-social"] = process.argv.slice(2);
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 700 } });
const LOOK = JSON.stringify({ skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_curtain", back: "back_bob", top: "top_hoodie", bottom: "bottom_joggers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: {} });
await ctx.addInitScript(look => { try { localStorage.setItem("tsi.look.v1", look); localStorage.removeItem("tsi.moveKeys.v1"); localStorage.removeItem("tsi.moves.v1"); } catch {} }, LOOK);
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
await page.goto(`http://localhost:${process.env.PORT ?? 3147}/lab/island?moves=locked&time=day&weather=clear`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("canvas", { timeout: 240000 });
for (let i = 0, ok = 0; i < 240 && ok < 8; i++) { await page.waitForTimeout(1000); ok = (await page.evaluate(() => !!window.__move?.sim?.current)) ? ok + 1 : 0; }
await page.screenshot({ path: `${process.env.SCRATCH ?? OUT}/dash-start.png` });
const st = () => page.evaluate(() => { const s = window.__move?.sim?.current?.state; if (!s) return { mode: null, dashT: 0, dashCd: 0, speed: 0 }; return { mode: s.mode, dashT: s.dashT, dashCd: s.dashCd, speed: Math.hypot(s.vx, s.vz) }; });
await page.mouse.click(550, 350);
await page.keyboard.down("w");
await page.waitForTimeout(800);
const before = await st();
await page.keyboard.press("q");
let peak = { dashT: 0, dashCd: 0, speed: 0 };
for (let i = 0; i < 12; i++) { await page.waitForTimeout(40); const s = await st(); if (s.speed > peak.speed) peak = s; if (s.dashCd > peak.dashCd) peak.dashCd = s.dashCd; }
await page.screenshot({ path: `${process.env.SCRATCH ?? OUT}/x-moves-dash.png`, clip: { x: 300, y: 150, width: 500, height: 400 } });
await page.keyboard.up("w");
console.log(JSON.stringify({ before, peak }));
console.log(peak.dashCd > 0 || peak.speed > before.speed * 1.5 ? "DASH OK" : "NO DASH");
await browser.close();
