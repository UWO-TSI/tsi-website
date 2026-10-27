/**
 * Headless check of the built Face Fit page (dist/): served from a local static server, opened in headless Chromium
 * (muted), with a stand-in for the artifact's db. Fails on any console error, page error or failed request; checks the
 * page starts from saved docs, saves each change, says when it can't save, and writes desktop and phone screenshots to
 * specs/evidence/fit-editor/. `node specs/tools/fit-editor/check.mjs [port]` while holding the browser lock.
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url)), dist = join(here, "dist"), evidence = join(here, "../../evidence/fit-editor");
const PORT = Number(process.argv[2] ?? 3473);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".json": "application/json" };
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^[/\\]+/, "") || "index.html";
  const file = join(dist, path);
  try {
    if (!file.startsWith(dist) || !statSync(file).isFile()) throw new Error();
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" }).end(readFileSync(file));
  } catch { res.writeHead(404).end(); }
}).listen(PORT);
mkdirSync(evidence, { recursive: true });

/** The artifact runtime's db, in the page: a seeded `fit` collection; every set is recorded on window.__sets. */
const FAKE_DB = seed => `
  window.__sets = [];
  const docs = new Map(Object.entries(${JSON.stringify(seed)}));
  const db = { collection: name => ({
    get: async () => ({ docs: [...docs].map(([id, d]) => ({ id, data: () => d })) }),
    doc: id => ({ set: async d => { docs.set(id, d); window.__sets.push([name, id, d]); } }),
  }) };
  window.claude = { use: async n => (n === "db" ? db : null) };`;

const problems = [], log = [];
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
async function open(viewport, seed) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  if (seed) await context.addInitScript(FAKE_DB(seed));
  const page = await context.newPage();
  page.on("console", m => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });
  page.on("pageerror", e => problems.push(`pageerror: ${e.message}`));
  page.on("requestfailed", r => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  page.on("response", r => { if (r.status() >= 400) problems.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(`http://localhost:${PORT}/index.html`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);
  return { page, context };
}
const expect = (ok, what) => { log.push(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) problems.push(what); };
const height = page => page.locator(".lift").first().locator("output").textContent();

try {
  // Desktop, saving: starts from a saved doc, saves each change.
  const { page, context } = await open({ width: 1280, height: 900 }, { hair_baby_sprout: { y: 0.01 } });
  expect((await page.locator(".status").textContent()) === "All changes saved", "db connected: All changes saved");
  await page.getByRole("button", { name: /Baby sprout/ }).click();
  expect((await height(page)) === "+10.0 mm", `starts from the saved doc (${await height(page)})`);
  expect(await page.getByRole("button", { name: /Baby sprout/ }).locator(".badge").isVisible(), "a saved item is marked set");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Height up" }).click();
  await page.waitForTimeout(900);
  expect((await height(page)) === "+11.5 mm", `three steps up: ${await height(page)}`);
  const sets = await page.evaluate(() => window.__sets);
  expect(JSON.stringify(sets.at(-1)) === JSON.stringify(["fit", "hair_baby_sprout", { y: 0.0115 }]), `saved once after the burst: ${JSON.stringify(sets)}`);
  await page.screenshot({ path: join(evidence, "desktop-hair.png") });
  // a face: two lifts, saved as { eyes, mouth }
  const face = page.locator("nav section").nth(1).locator("button").first();
  await face.click();
  await page.getByRole("button", { name: "Eyes height up" }).click();
  await page.getByRole("button", { name: "Mouth height down" }).click();
  await page.waitForTimeout(900);
  const last = (await page.evaluate(() => window.__sets)).at(-1);
  expect(last[2].eyes === 0.001 && last[2].mouth === -0.001, `a face saves { eyes, mouth }: ${JSON.stringify(last)}`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(evidence, "desktop-face.png") });
  await page.getByRole("button", { name: "Reset" }).first().click();
  await page.waitForTimeout(900);
  expect((await page.evaluate(() => window.__sets)).at(-1)[2].eyes === 0, "reset saves 0");
  // a face accessory
  await page.locator("nav section").nth(2).locator("button").first().click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(evidence, "desktop-accessory.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scroll at desktop width");
  await context.close();

  // Phone width, no db: says it can't save.
  const phone = await open({ width: 390, height: 844 });
  expect((await phone.page.locator(".status").textContent()).startsWith("Can't save here"), "without a db it says it can't save");
  expect(await phone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scroll at phone width");
  await phone.page.screenshot({ path: join(evidence, "phone.png"), fullPage: true });
  await phone.context.close();
} finally {
  await browser.close();
  server.close();
}
console.log(log.join("\n"));
if (problems.length) { console.error(`\n${problems.length} problem(s):\n${problems.join("\n")}`); process.exit(1); }
console.log("fit-editor check: PASS");
