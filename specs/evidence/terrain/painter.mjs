// node painter.mjs <outDir>: the painter's natural preview, brushes, and stroke timing at 256².
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const ROOT = `http://localhost:${process.env.PORT ?? 3117}`;
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
const canvas = () => page.getByTestId("painter-canvas");
async function open(q) { await page.goto(`${ROOT}/lab/map${q}`, { waitUntil: "domcontentloaded" }); await canvas().waitFor({ timeout: 240000 }); await page.waitForTimeout(2500); }
async function shot(name) { await page.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); }
async function tool(name) { await page.getByRole("button", { name, exact: true }).first().click(); }
async function drag(points, alt = false) {
  const box = await canvas().boundingBox();
  const at = ([u, v]) => [box.x + u * box.width, box.y + v * box.height];
  if (alt) await page.keyboard.down("Alt");
  await page.mouse.move(...at(points[0]));
  await page.mouse.down();
  for (const p of points.slice(1)) await page.mouse.move(...at(p), { steps: 8 });
  await page.mouse.up();
  if (alt) await page.keyboard.up("Alt");
  await page.waitForTimeout(600);
}
const results = [];
await open("");
await shot("painter-village");
await open("?fixture=terrain");
await shot("painter-fixture");
await tool("slope");
await drag([[0.62, 0.3], [0.7, 0.32], [0.74, 0.4]]);
await drag([[0.66, 0.33], [0.7, 0.36]]);
await tool("land");
await drag([[0.12, 0.5], [0.08, 0.6]]);
await tool("grow");
await drag([[0.5, 0.88], [0.6, 0.9]]);
await shot("painter-painting");
// Timing on a 256² map: one free stroke of the Slope brush and of the soft land brush, frame by frame.
await page.getByRole("button", { name: "256", exact: true }).click();
await page.waitForTimeout(4000);
await page.locator('input[type="range"]').nth(1).fill("3");
await page.waitForTimeout(3000);
for (const t of ["slope", "land", "smooth"]) {
  await tool(t);
  await page.locator('input[type="range"]').nth(1).fill("3");
  const ms = await canvas().evaluate(async (cv) => {
    const r = cv.getBoundingClientRect(), frames = [];
    const ev = (type, u, v) => cv.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: r.left + u * r.width, clientY: r.top + v * r.height, buttons: 1 }));
    let last = performance.now();
    ev("mousedown", 0.45, 0.45);
    for (let i = 0; i < 30; i++) {
      ev("mousemove", 0.45 + i * 0.003, 0.45 + i * 0.002);
      await new Promise(requestAnimationFrame);
      const now = performance.now(); frames.push(now - last); last = now;
    }
    ev("mouseup", 0.54, 0.51);
    frames.sort((a, b) => a - b);
    return { median: frames[15], p90: frames[27], max: frames[29] };
  });
  results.push(`${t} stroke on 256x256: frame median ${ms.median.toFixed(1)} ms, p90 ${ms.p90.toFixed(1)} ms, max ${ms.max.toFixed(1)} ms`);
  await page.waitForTimeout(1500);
}
await shot("painter-256");
console.log(results.join("\n"));
writeFileSync(`${OUT}/painter-timing.txt`, results.join("\n") + "\n");
await browser.close();
