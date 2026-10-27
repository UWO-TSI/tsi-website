/**
 * Headless check of the built Residents page (dist/), the way ../fit-editor/check.mjs checks Face Fit: served with the
 * artifact frame's strict CSP inside a sandboxed iframe from a second origin, in headless Chromium (muted), with a
 * stand-in db. Fails on any CSP violation, console error, page error, failed request, blank root or shown error, and
 * renders with storage refused; checks it starts from saved docs, saves only the changed fields of each resident once
 * per burst, deletes a doc reset to the source, says when it can't save, draws the map's pins, and writes desktop and
 * phone screenshots to specs/evidence/npc-editor/. `node specs/tools/npc-editor/check.mjs [port]` with the browser lock.
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url)), dist = join(here, "dist"), evidence = join(here, "../../evidence/npc-editor");
const PORT = Number(process.argv[2] ?? 3483);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".png": "image/png", ".webp": "image/webp", ".json": "application/json" };
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
const host = createServer((req, res) => res.writeHead(200, { "content-type": "text/html" }).end(
  `<!doctype html><body style="margin:0"><iframe sandbox="allow-scripts allow-same-origin" src="http://localhost:${PORT}/index.html" style="border:0;width:100vw;height:100vh;display:block"></iframe></body>`,
)).listen(PORT + 1);
mkdirSync(evidence, { recursive: true });
const SERVED = new Set([".html", ".css", ".js", ".mjs", ".wasm", ".json", ".map", ".txt", ".md", ".csv", ".xml", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".woff", ".woff2", ".ttf", ".otf", ".mp3", ".wav", ".ogg", ".mp4", ".webm", ".pdf"]);
const walk = dir => readdirSync(dir).flatMap(f => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const unserved = walk(dist).filter(f => !SERVED.has(extname(f)) || statSync(f).size > 16e6);

/** The artifact runtime's db: seeded docs; every write is recorded on window.__writes as [collection, id, data | null (deleted)]. */
const FAKE_DB = seed => `
  window.__writes = [];
  const docs = new Map(Object.entries(${JSON.stringify(seed)}));
  const db = { collection: name => ({
    get: async () => ({ docs: [...docs].map(([id, d]) => ({ id, data: () => d })) }),
    doc: id => ({ set: async d => { docs.set(id, d); window.__writes.push([name, id, d]); }, delete: async () => { docs.delete(id); window.__writes.push([name, id, null]); } }),
  }) };
  window.claude = { use: async n => (n === "db" ? db : null) };`;
const WATCH = `document.addEventListener("securitypolicyviolation", e => console.error("CSP violation: " + e.violatedDirective + " " + e.blockedURI));`;
const NO_STORAGE = `for (const k of ["localStorage", "sessionStorage"]) Object.defineProperty(window, k, { get() { throw new DOMException("refused", "SecurityError"); } });`;

const problems = unserved.map(f => `not publishable (type or over 16 MB): ${f}`), log = [];
const expect = (ok, what) => { log.push(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) problems.push(what); };
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
  await page.waitForTimeout(3000);
  const frame = page.frames().find(f => f.url().endsWith("/index.html"));
  const drawn = await frame.evaluate(() => ({ root: document.getElementById("root").childElementCount,
    shown: [...document.querySelectorAll("[role=alert]")].filter(e => !e.hidden && !e.classList.contains("problem")).map(e => e.textContent) }));
  expect(drawn.root > 0 && !drawn.shown.length, `renders in the frame${noStorage ? " with storage refused" : ""}: ${JSON.stringify(drawn)}`);
  return { page: frame, shot: page, context };
}

try {
  const { page, shot, context } = await open({ width: 1280, height: 900 }, { mayor: { display_name: "Mayor Elsa" }, nobody: { display_name: "X" } });
  const writes = () => page.evaluate(() => window.__writes);
  const settle = () => page.waitForTimeout(1100);
  const item = name => page.locator("nav li button", { hasText: name });
  expect((await page.locator(".status").textContent()).startsWith("All changes saved"), "db connected: All changes saved");
  expect(await page.locator("nav li").count() === 13, `lists every resident: ${await page.locator("nav li").count()}`);
  expect(await item("Mayor Elsa").locator(".badge").isVisible(), "starts from a saved doc: the mayor's new name, marked changed");
  expect(await item("Alice").isVisible(), "the HQ lead is Alice");
  await shot.screenshot({ path: join(evidence, "desktop-alice.png") });

  // name: a burst of typing saves once, only the changed field; the old value shows beside it; reset deletes the doc
  await item("Juniper").click();
  const name = page.getByRole("textbox", { name: "Name" });
  await name.fill("Juniper Bay");
  await settle();
  expect(JSON.stringify(await writes()) === JSON.stringify([["residents", "juniper", { display_name: "Juniper Bay" }]]), `a name saves once, alone: ${JSON.stringify(await writes())}`);
  expect((await page.locator(".box.changed .was").first().textContent()).includes("Juniper"), "shows the name it was");
  expect(await item("Juniper Bay").locator(".badge").isVisible(), "the list marks Juniper changed");
  await page.getByRole("button", { name: "Reset Name" }).click();
  await settle();
  expect(JSON.stringify((await writes()).at(-1)) === JSON.stringify(["residents", "juniper", null]), `reset to the source deletes the doc: ${JSON.stringify((await writes()).at(-1))}`);
  await name.fill("");
  await page.waitForTimeout(300);
  expect(await page.locator(".problem").first().isVisible(), "an empty name says it must be fixed");
  await page.getByRole("button", { name: "Reset Name" }).click();
  await settle();

  // look: a new hairstyle redraws the big view and saves the whole look
  const big = page.locator(".portrait.big .view"), before = await big.screenshot();
  const hair = page.getByRole("combobox", { name: "Hairstyles" }), was = await hair.inputValue();
  const other = await hair.locator("option").evaluateAll((os, w) => os.map(o => o.value).find(v => v && v !== w), was);
  await hair.selectOption(other);
  await page.waitForTimeout(2500);
  const look = (await writes()).at(-1);
  expect(look[1] === "juniper" && look[2].look?.back === other && Object.keys(look[2]).join() === "look", `a hairstyle saves the look: ${JSON.stringify(look)}`);
  expect(!before.equals(await big.screenshot()), "the 3D view redraws the new hairstyle");
  await page.getByRole("button", { name: "Reset Hair" }).click();
  await settle();
  expect(JSON.stringify((await writes()).at(-1)) === JSON.stringify(["residents", "juniper", null]), "a look reset to the source deletes the doc");
  // a colour swatch
  await page.locator(".box", { hasText: "Tops" }).getByRole("radio", { name: "Colour 3" }).click();
  await settle();
  expect((await writes()).at(-1)[2]?.look?.colors?.top_tee === 2, `a top colour saves: ${JSON.stringify((await writes()).at(-1))}`);

  // places: Juniper's day has the pond, skipped on the new world; adding the shop adds a pin
  await page.getByRole("tab", { name: "Day" }).click();
  await page.waitForTimeout(500);
  const pins = () => page.locator(".map svg g text").evaluateAll(ts => ts.filter(t => t.textContent !== "H").length);
  const pins0 = await pins();
  expect((await page.locator(".skipped").textContent()).includes("Pond (not on the new map)"), "the pond is marked skipped on the new world");
  await page.getByRole("combobox", { name: "Add a Day place" }).selectOption("shop");
  await settle();
  const sched = (await writes()).at(-1)[2];
  expect(sched.schedule?.day?.at(-1) === "shop" && sched.look, `a place saves the schedule beside the look: ${JSON.stringify(sched)}`);
  expect(await pins() === pins0 + 1, `the shop gets a pin on the map: ${pins0} -> ${await pins()}`);
  await shot.screenshot({ path: join(evidence, "desktop-juniper.png"), fullPage: true });

  // lines: a new conversation with a box
  await page.getByRole("button", { name: "+ Add a conversation" }).click();
  const n = await page.locator(".conversation").count();
  await page.getByRole("textbox", { name: `Conversation ${n}, box 1` }).fill("[happy] Race you to the pier!");
  await settle();
  expect(JSON.stringify((await writes()).at(-1)[2].talk?.at(-1)) === JSON.stringify(["[happy] Race you to the pier!"]), "a new conversation saves");

  // search; the chef: look only
  await page.getByRole("searchbox", { name: "Search residents" }).fill("sushi");
  expect(await page.locator("nav li").count() === 2, "search finds the sushi chef and server");
  await item("Sushi chef").click();
  await page.waitForTimeout(1500);
  expect(!(await page.getByRole("textbox", { name: "Name" }).count()) && await page.locator(".note", { hasText: "only the look" }).isVisible(), "the chef has only a look");
  await item("Sushi chef").click();
  await shot.screenshot({ path: join(evidence, "desktop-chef.png") });
  await page.getByRole("searchbox", { name: "Search residents" }).fill("");
  await item("Rosa").click();
  await page.waitForTimeout(800);
  expect(await page.locator(".box-label", { hasText: "Lines out front" }).isVisible(), "Rosa has her lines out front");
  expect(!(await page.getByRole("tab", { name: "Day" }).count()), "Rosa has no schedule (she keeps the café)");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scroll at desktop width");
  await context.close();

  // phone width, no db
  const phone = await open({ width: 390, height: 844 });
  expect((await phone.page.locator(".status").textContent()).startsWith("Can't save here"), "without a db it says it can't save");
  expect(await phone.page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "no horizontal scroll at phone width");
  await phone.shot.screenshot({ path: join(evidence, "phone-top.png") });
  await phone.page.locator(".map").scrollIntoViewIfNeeded();
  await phone.page.waitForTimeout(1200);
  await phone.shot.screenshot({ path: join(evidence, "phone-map.png") });
  await phone.context.close();

  await (await open({ width: 1280, height: 900 }, {}, true)).context.close();
} finally {
  await browser.close();
  server.close();
  host.close();
}
console.log(log.join("\n"));
if (problems.length) { console.error(`\n${problems.length} problem(s):\n${problems.join("\n")}`); process.exit(1); }
console.log("npc-editor check: PASS");
