/**
 * Headless check of the built Face Fit page (dist/): served from a local static server with the artifact frame's strict
 * CSP, inside a sandboxed iframe from a second origin (as claude.ai frames it), in headless Chromium (muted), with a
 * stand-in for the artifact's db. Fails on any CSP violation, console error, page error, failed request, blank root or
 * shown error, and renders with localStorage refused (the frame can refuse storage); checks the
 * page starts from saved docs, saves each change, says when it can't save, and writes desktop and phone screenshots to
 * specs/evidence/fit-editor/. `node specs/tools/fit-editor/check.mjs [port]` while holding the browser lock.
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url)), dist = join(here, "dist"), evidence = join(here, "../../evidence/fit-editor");
const PORT = Number(process.argv[2] ?? 3473);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".json": "application/json" };
/** The artifact frame's policy (as the coordinator gave it): own files only, no data:/blob: fetches, no WebAssembly. */
const CSP = "default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://unpkg.com; connect-src 'self'; " +
  "img-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; worker-src 'self' blob:";
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^[/\\]+/, "") || "index.html";
  const file = join(dist, path);
  try {
    if (!file.startsWith(dist) || !statSync(file).isFile()) throw new Error();
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "content-security-policy": CSP }).end(readFileSync(file));
  } catch { res.writeHead(404).end(); }
}).listen(PORT);
/** The host page, on another origin, framing the page as claude.ai does. */
const host = createServer((req, res) => res.writeHead(200, { "content-type": "text/html" }).end(
  `<!doctype html><body style="margin:0"><iframe sandbox="allow-scripts allow-same-origin" src="http://localhost:${PORT}/index.html" style="border:0;width:100vw;height:100vh;display:block"></iframe></body>`,
)).listen(PORT + 1);
mkdirSync(evidence, { recursive: true });
/** What a claude.ai artifact serves, by extension: anything else in dist/ can't be published. */
const SERVED = new Set([".html", ".css", ".js", ".mjs", ".wasm", ".json", ".map", ".txt", ".md", ".csv", ".xml", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".wav", ".ogg", ".mp4", ".webm", ".pdf"]);
const walk = dir => readdirSync(dir).flatMap(f => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const unserved = walk(dist).filter(f => !SERVED.has(extname(f)) || statSync(f).size > 16e6);

/** The artifact runtime's db, in the page: a seeded `fit` collection; every set is recorded on window.__sets. */
const FAKE_DB = seed => `
  window.__sets = [];
  const docs = new Map(Object.entries(${JSON.stringify(seed)}));
  const db = { collection: name => ({
    get: async () => ({ docs: [...docs].map(([id, d]) => ({ id, data: () => d })) }),
    doc: id => ({ set: async d => { docs.set(id, d); window.__sets.push([name, id, d]); } }),
  }) };
  window.claude = { use: async n => (n === "db" ? db : null) };`;
const WATCH = `document.addEventListener("securitypolicyviolation", e => console.error("CSP violation: " + e.violatedDirective + " " + e.blockedURI));`;
const NO_STORAGE = `for (const k of ["localStorage", "sessionStorage"]) Object.defineProperty(window, k, { get() { throw new DOMException("refused", "SecurityError"); } });`;

const problems = unserved.map(f => `not publishable (type or over 16 MB): ${f}`), log = [];
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--enable-unsafe-swiftshader", "--use-angle=swiftshader"] });
async function open(viewport, seed, noStorage = false) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(WATCH);
  if (seed) await context.addInitScript(FAKE_DB(seed));
  if (noStorage) await context.addInitScript(NO_STORAGE);
  const page = await context.newPage();
  page.on("console", m => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });
  page.on("pageerror", e => problems.push(`pageerror: ${e.message}`));
  page.on("requestfailed", r => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  page.on("response", r => {
    if (r.status() >= 400) problems.push(`http ${r.status()}: ${r.url()}`);
    if (r.url().startsWith(`http://localhost:${PORT}/`) && !SERVED.has(extname(new URL(r.url()).pathname))) problems.push(`asks for a type artifacts don't serve: ${r.url()}`);
  });
  await page.goto(`http://127.0.0.1:${PORT + 1}/`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);
  const frame = page.frames().find(f => f.url().endsWith("/index.html"));
  // not blank, and nothing it shows is an error
  const drawn = await frame.evaluate(() => ({ root: document.getElementById("root").childElementCount,
    shown: [...document.querySelectorAll("[role=alert]")].filter(e => !e.hidden).map(e => e.textContent) }));
  expect(drawn.root > 0 && !drawn.shown.length, `renders in the frame${noStorage ? " with storage refused" : ""}: ${JSON.stringify(drawn)}`);
  return { page: frame, shot: page, context };
}
const expect = (ok, what) => { log.push(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) problems.push(what); };
const height = page => page.locator(".lift").first().locator("output").textContent();

try {
  // Desktop, saving: starts from a saved doc, saves each change.
  const { page, shot, context } = await open({ width: 1280, height: 900 }, { hair_baby_sprout: { y: 0.01 } });
  expect((await page.locator(".status").textContent()) === "All changes saved", "db connected: All changes saved");
  await page.getByRole("button", { name: /Baby sprout/ }).click();
  expect((await height(page)) === "+10.0 mm", `starts from a saved round 1 doc ({ y }) (${await height(page)})`);
  expect(await page.getByRole("button", { name: /Baby sprout/ }).locator(".badge").isVisible(), "a saved item is marked set");
  const sets = () => page.evaluate(() => window.__sets);
  const lastSet = async () => (await sets()).at(-1);
  const settle = () => page.waitForTimeout(900);
  const onGrid = (v, step) => Math.abs(Math.round(v / step) * step - v) < 1e-9;
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "Up / down: up" }).click();
  await settle();
  expect((await height(page)) === "+11.5 mm", `three steps up: ${await height(page)}`);
  expect(JSON.stringify(await sets()) === JSON.stringify([["fit", "hair_baby_sprout", { y: 0.0115, z: 0, x: 0 }]]), `saved once after the burst, as { x, y, z }: ${JSON.stringify(await sets())}`);
  // dragging the Front view: right and up, saved once when it ends
  const front = page.locator(".row .cell.move").nth(0), side = page.locator(".row .cell.move").nth(1), orbit = page.locator(".cell.orbit");
  /** A mouse drag from the centre of a view (fraction `fx` across), in `n` moves of (dx, dy) pixels. */
  const dragIn = async (cell, dx, dy, { n = 3, fx = 0.5, shift = false } = {}) => {
    const b = await cell.locator(".view").boundingBox(), x = b.x + b.width * fx, y = b.y + b.height / 2;
    if (shift) await shot.keyboard.down("Shift");
    await shot.mouse.move(x, y); await shot.mouse.down();
    for (let i = 1; i <= n; i++) await shot.mouse.move(x + dx * i, y + dy * i);
    await shot.mouse.up();
    if (shift) await shot.keyboard.up("Shift");
    await settle();
    return b;
  };
  const n0 = (await sets()).length, box = await dragIn(front, 1, -1, { n: 3 });
  const drag = await sets();
  const d = drag.at(-1)[2], perPx = 2 * Math.hypot(0.06, 1.3) * Math.tan(Math.PI / 12) / box.height;
  expect(drag.length === n0 + 1, `a drag saves once: ${drag.length - n0} saves`);
  expect(Math.abs(d.x - 3 * perPx) <= 0.0003 && Math.abs(d.y - 0.0115 - 3 * perPx) <= 0.0003 && d.z === 0 && onGrid(d.x, 0.0005) && onGrid(d.y, 0.0005),
    `the Front drag moves right and up by the drag, on the 0.5 mm grid: ${JSON.stringify(d)} (${(3 * perPx * 1000).toFixed(2)} mm each way)`);
  // the look-around view: a plain drag turns the camera and saves nothing; Shift-drag moves the item, saved once
  const before = await orbit.locator(".view").screenshot(), n1 = (await sets()).length;
  await dragIn(orbit, 25, 6, { n: 4 });
  await page.waitForTimeout(500);
  expect((await sets()).length === n1, `a look-around drag saves nothing: ${(await sets()).length - n1} saves`);
  expect(!before.equals(await orbit.locator(".view").screenshot()), "a look-around drag turns the view");
  const o0 = await lastSet();
  await dragIn(orbit, 0, -1, { n: 3, shift: true });
  const o = await sets(), od = o.at(-1)[2];
  expect(o.length === n1 + 1 && od.y > o0[2].y && onGrid(od.y, 0.0005), `a Shift-drag in the look-around view moves it up, saved once: ${o.length - n1} saves, ${JSON.stringify(o0[2])} -> ${JSON.stringify(od)}`);
  await page.getByRole("button", { name: "Reset view" }).click();
  await page.waitForTimeout(800);
  expect((await sets()).length === o.length, "reset view saves nothing");
  // the arrows on the focused Side view: left is forward (the face looks left there), up is up
  await side.focus();
  await shot.keyboard.press("ArrowLeft"); await shot.keyboard.press("ArrowLeft"); await shot.keyboard.press("ArrowUp");
  await settle();
  const k = await lastSet();
  expect(Math.abs(k[2].z - od.z - 0.001) < 1e-9 && Math.abs(k[2].y - od.y - 0.0005) < 1e-9 && k[2].x === od.x, `Side view arrows: forward 1 mm, up 0.5 mm: ${JSON.stringify(k)}`);
  await front.focus();
  await shot.keyboard.press("Shift+ArrowRight");
  await settle();
  expect(Math.abs((await lastSet())[2].x - od.x - 0.005) < 1e-9, `Front view Shift+arrow: 10 steps right: ${JSON.stringify(await lastSet())}`);
  await shot.screenshot({ path: join(evidence, "desktop-hair.png") });
  await page.getByRole("button", { name: "Reset Forward / back" }).click();
  await settle();
  expect((await lastSet())[2].z === 0, "an axis's reset saves 0");
  await page.getByRole("button", { name: "Reset all" }).click();
  await settle();
  expect(JSON.stringify((await lastSet())[2]) === JSON.stringify({ y: 0, z: 0, x: 0 }), `reset all saves zeros: ${JSON.stringify(await lastSet())}`);
  // a face with eyes that spread: saved as { eyes, eyesApart, eyesSize, mouth, mouthSize }
  const faces = page.locator("nav section").nth(1).locator("button");
  for (let i = 0; i < await faces.count(); i++) {
    await faces.nth(i).click();
    if (await page.getByRole("button", { name: "Eyes apart: apart" }).isEnabled() && await page.getByRole("button", { name: "Mouth up / down: down" }).isEnabled()) break;
  }
  await page.getByRole("button", { name: "Eyes up / down: up" }).click();
  await page.getByRole("button", { name: "Eyes apart: apart" }).click();
  await page.getByRole("button", { name: "Mouth up / down: down" }).click();
  await settle();
  const last = await lastSet();
  expect(last[2].eyes === 0.001 && last[2].eyesApart === 0.001 && last[2].mouth === -0.001, `a face saves { eyes, eyesApart, mouth }: ${JSON.stringify(last)}`);
  // dragging the Front view right on its right half spreads the eyes; with Mouth chosen, up moves the mouth
  await dragIn(front, 1, 0, { n: 3, fx: 0.7 });
  const spread = await lastSet();
  expect(spread[2].eyesApart > 0.001 && spread[2].eyes === 0.001 && spread[2].mouth === -0.001, `a Front drag to the right on the right half spreads the eyes: ${JSON.stringify(spread)}`);
  await page.getByLabel("Mouth", { exact: true }).check();
  await front.focus();
  await shot.keyboard.press("ArrowUp");
  await settle();
  expect((await lastSet())[2].mouth === 0 && (await lastSet())[2].eyes === 0.001, `with Mouth chosen, the arrow moves the mouth: ${JSON.stringify(await lastSet())}`);
  // eyes and mouth size: a burst of steps saves once, shown as a percentage, and the face redraws
  await page.waitForTimeout(1500);
  const unsized = await front.locator(".view").screenshot(), n2 = (await sets()).length;
  for (let i = 0; i < 5; i++) await page.getByRole("button", { name: "Eyes size: bigger" }).click();
  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "Mouth size: smaller" }).click();
  await settle();
  const sized = await sets(), sz = sized.at(-1)[2];
  expect(sized.length === n2 + 1 && sz.eyesSize === 1.1 && sz.mouthSize === 0.96 && sz.eyes === 0.001 && sz.mouth === 0,
    `a size change saves once, as { eyesSize, mouthSize } beside the moves: ${sized.length - n2} saves, ${JSON.stringify(sz)}`);
  const pct = await page.locator(".lift").filter({ hasText: "Eyes size" }).locator("output").textContent();
  expect(pct === "110%", `eyes size shown as a percentage: ${pct}`);
  await page.waitForTimeout(1500);
  expect(!unsized.equals(await front.locator(".view").screenshot()), "a size change redraws the face");
  await shot.screenshot({ path: join(evidence, "desktop-face.png") });
  await page.getByRole("button", { name: "Reset Eyes size" }).click();
  await settle();
  expect((await lastSet())[2].eyesSize === 1 && (await lastSet())[2].mouthSize === 0.96, `a size reset saves 1: ${JSON.stringify(await lastSet())}`);
  await page.getByRole("button", { name: "Reset Eyes up / down" }).click();
  await settle();
  expect((await lastSet())[2].eyes === 0, "reset saves 0");
  await page.getByRole("button", { name: "Reset all" }).click();
  await settle();
  expect(JSON.stringify((await lastSet())[2]) === JSON.stringify({ eyes: 0, eyesApart: 0, eyesSize: 1, mouth: 0, mouthSize: 1 }), `a face's reset all saves zeros and sizes of 1: ${JSON.stringify(await lastSet())}`);
  // a face accessory
  await page.locator("nav section").nth(2).locator("button").first().click();
  await page.waitForTimeout(2500);
  await shot.screenshot({ path: join(evidence, "desktop-accessory.png") });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scroll at desktop width");
  await context.close();

  // Phone width, no db: says it can't save.
  const phone = await open({ width: 390, height: 844 });
  expect((await phone.page.locator(".status").textContent()).startsWith("Can't save here"), "without a db it says it can't save");
  expect(await phone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scroll at phone width");
  // viewport captures: the views draw on one fixed canvas, so a full-page capture leaves the cells below the fold empty
  await phone.shot.screenshot({ path: join(evidence, "phone-top.png") });
  await phone.page.locator(".row").first().scrollIntoViewIfNeeded();
  await phone.page.waitForTimeout(1500);
  await phone.shot.screenshot({ path: join(evidence, "phone-views.png") });
  await phone.context.close();

  // The frame refuses storage: still renders (open checks it).
  await (await open({ width: 1280, height: 900 }, {}, true)).context.close();
} finally {
  await browser.close();
  server.close();
  host.close();
}
console.log(log.join("\n"));
if (problems.length) { console.error(`\n${problems.length} problem(s):\n${problems.join("\n")}`); process.exit(1); }
console.log("fit-editor check: PASS");
