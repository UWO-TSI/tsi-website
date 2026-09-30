// Painter evidence: /lab/map on the shipped village, then each new tool on a fresh 96×96 island.
// node painter.mjs <outDir> [base=http://localhost:3105]
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT, BASE = "http://localhost:3105"] = process.argv.slice(2);
const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal"] });
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

// 3. The tools on a scratch patch (nothing here is an island design; it is not saved or shipped):
//    "new" clears to sea, a land rectangle, then each brush along its edges.
await button("new").click();
await zoom(8);
await button("land").click(); await button("rect").click();
await drag([[20, 20], [44, 42]]);
const box = await canvas.boundingBox(), clip = { x: box.x, y: box.y, width: box.width, height: box.height };
await shot("painter-before-organic", clip);
await button("free").click();
const edge = [[44, 22], [44, 30], [44, 38], [44, 42]];
await button("jitter").click(); await drag(edge); await drag(edge);
await shot("painter-jitter", clip);
await button("smooth").click(); await drag(edge); await drag([[20, 20], [44, 20]]);
await shot("painter-smooth", clip);
await button("grow").click(); for (let i = 0; i < 2; i++) await drag([[24, 42], [40, 42]]);
await button("shrink").click(); for (let i = 0; i < 2; i++) await drag([[20, 26], [20, 36]]);
await shot("painter-grow-shrink", clip);

// 4. Lasso a flat L2 plateau on the patch.
await button("flat").click(); await button("L2").click(); await button("lasso").click();
await drag([[27, 26], [34, 25], [37, 31], [33, 36], [27, 35], [26, 30], [27, 26]]);
await shot("painter-lasso-plateau", clip);

// 5. The object layer: place a tree and a bench, turn the bench, select the tree.
await button("object").click();
await page.getByRole("button", { name: "tree", exact: true }).click();
const [tx, ty] = await at(40, 24); await page.mouse.click(tx, ty);
await page.getByRole("button", { name: "bench", exact: true }).click();
const [cx, cy] = await at(40, 36); await page.mouse.click(cx, cy); await page.keyboard.press("r");
await page.getByRole("button", { name: "select / move", exact: true }).click();
await page.mouse.click(tx, ty); await page.waitForTimeout(600);
await shot("painter-objects-placed");
await browser.close();
