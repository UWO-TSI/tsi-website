// Painter evidence: /lab/map on the shipped village, then each new tool on a fresh 96×96 island.
// node painter.mjs <outDir> [base=http://localhost:3105]
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT, BASE = "http://localhost:3105"] = process.argv.slice(2);
const browser = await chromium.launch({ headless: false, args: ["--use-angle=metal"] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 })).newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
await page.goto(`${BASE}/lab/map`);
await page.evaluate(() => { localStorage.removeItem("lab-map-village-draft-v1"); });
await page.reload();
const canvas = page.getByTestId("painter-canvas");
await canvas.waitFor();
await page.waitForTimeout(1500);
const shot = async (name, clip) => { await page.screenshot({ path: `${OUT}/${name}.png`, ...(clip ? { clip } : {}) }); console.log("shot", name); };
const button = (name) => page.getByRole("button", { name, exact: true });
const zoom = async (z) => { await page.locator('input[type="range"]').last().fill(String(z)); await page.waitForTimeout(300); };
/** Canvas pixel of a cell centre (game view flips both axes). */
async function at(cx, cz, game = true) {
  const box = await canvas.boundingBox(), W = Number(await canvas.evaluate(c => c.width)), H = Number(await canvas.evaluate(c => c.height));
  const [w, d] = await page.evaluate(() => { const t = document.body.innerText.match(/grid (\d+)×(\d+)/); return [Number(t[1]), Number(t[2])]; });
  const zx = W / w, zz = H / d, u = cx + 0.5, v = cz + 0.5;
  return [box.x + (game ? W - u * zx : u * zx), box.y + (game ? H - v * zz : v * zz)];
}
async function drag(cells, game = true) {
  const [x0, y0] = await at(...cells[0], game);
  await page.mouse.move(x0, y0); await page.mouse.down();
  for (const c of cells.slice(1)) { const [x, y] = await at(...c, game); await page.mouse.move(x, y, { steps: 6 }); }
  await page.mouse.up(); await page.waitForTimeout(400);
}

// 1. The shipped village in the game view, objects on, health and budget live.
await zoom(9);
await page.waitForTimeout(1200);
await shot("painter-village-game-view");
await button("game view").click(); await page.waitForTimeout(500);
await shot("painter-village-raw-view");
await button("raw view").click();

// 2. Object layer: select the shop and drag it one cell, hover readout in world coordinates.
const [sx, sy] = await at(32 + 10, 32 - 6);
await page.mouse.click(sx, sy); await page.waitForTimeout(400);
await shot("painter-object-selected");
await page.keyboard.press("Control+z");

// 3. A fresh 96×96 island from the coastline generator.
await button("new").click();
await button("96").click();
await button("generate a starting coast").click(); await page.waitForTimeout(800);
await zoom(7);
await shot("painter-coast-generator");

// 4. Organic brushes: jitter the south-east (screen-left) coast, grow the east (bottom) coast, shrink the west (top).
const box = await canvas.boundingBox(), clip = { x: box.x, y: box.y, width: box.width, height: box.height };
const coast = [[83, 28], [83, 40], [83, 52], [82, 62]];
await shot("painter-before-organic", clip);
await button("jitter").click(); await drag(coast); await drag(coast.map(([x, z]) => [x - 1, z])); await drag(coast.map(([x, z]) => [x + 1, z]));
await shot("painter-jitter", clip);
await button("smooth").click(); await drag(coast);
await shot("painter-smooth", clip);
await button("grow").click();
for (let i = 0; i < 3; i++) await drag([[36, 15], [48, 14], [60, 15]]);
await button("shrink").click();
for (let i = 0; i < 3; i++) await drag([[38, 78], [48, 79], [58, 78]]);
await shot("painter-grow-shrink", clip);

// 5. Lasso a plateau (flat L2) and ramp into it.
await button("flat").click(); await button("L2").click(); await button("lasso").click();
await drag([[40, 40], [50, 38], [56, 46], [50, 54], [42, 52], [38, 46], [40, 40]]);
await shot("painter-lasso-plateau", clip);

// 6. Place objects: a building, a tree and a bench, then select the building.
await button("object").click();
await page.getByRole("button", { name: "landmark", exact: true }).click();
const [bx, by] = await at(46, 30); await page.mouse.click(bx, by);
await page.getByRole("button", { name: "tree", exact: true }).click();
for (const [x, z] of [[36, 36], [38, 58], [58, 36]]) { const [px, py] = await at(x, z); await page.mouse.click(px, py); }
await page.getByRole("button", { name: "bench", exact: true }).click();
const [cx, cy] = await at(44, 36); await page.mouse.click(cx, cy); await page.keyboard.press("r");
await page.getByRole("button", { name: "select / move", exact: true }).click();
await page.mouse.click(bx, by); await page.waitForTimeout(600);
await shot("painter-objects-placed");
await browser.close();
