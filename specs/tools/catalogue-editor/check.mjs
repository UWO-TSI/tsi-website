/**
 * Headless check of the built catalogue editor (dist/): served from a local static server with the artifact frame's
 * strict CSP, inside a sandboxed iframe from a second origin (as claude.ai frames it), in headless Chromium (muted),
 * with a stand-in for the artifact's db. Fails on any CSP violation, console error, page error, failed request, broken
 * icon or shown error; checks it starts from saved docs, saves each change as one doc of only the changed fields, says
 * when it can't save, renders with storage refused, and fits 390 px with no sideways scroll. Writes screenshots to
 * specs/evidence/catalogue-editor/. `node specs/tools/catalogue-editor/check.mjs [port]` while holding the browser lock.
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const here = dirname(fileURLToPath(import.meta.url)), dist = join(here, "dist"), evidence = join(here, "../../evidence/catalogue-editor");
const PORT = Number(process.argv[2] ?? 3483);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".webp": "image/webp" };
/** The artifact frame's policy: own files only, no data:/blob: fetches, no WebAssembly. */
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
const SERVED = new Set([".html", ".css", ".js", ".mjs", ".json", ".txt", ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".ico", ".woff", ".woff2"]);
const walk = dir => readdirSync(dir).flatMap(f => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));
const files = walk(dist), bytes = files.reduce((n, f) => n + statSync(f).size, 0);
const problems = files.filter(f => !SERVED.has(extname(f))).map(f => `not publishable: ${f}`), log = [];
const expect = (ok, what) => { log.push(`${ok ? "ok  " : "FAIL"} ${what}`); if (!ok) problems.push(what); };

/** The artifact runtime's db: a seeded `species` collection; every write is recorded on window.__writes. */
const FAKE_DB = seed => `
  window.__writes = [];
  const docs = new Map(Object.entries(${JSON.stringify(seed)}));
  const col = name => ({
    limit: () => col(name),
    get: async () => ({ docs: [...docs].map(([id, d]) => ({ id, exists: true, data: () => d })) }),
    doc: id => ({
      set: async d => { docs.set(id, d); window.__writes.push([name, id, d]); },
      delete: async () => { docs.delete(id); window.__writes.push([name, id, null]); },
    }),
  });
  window.claude = { use: async n => (n === "db" ? { collection: col } : null) };`;
const WATCH = `document.addEventListener("securitypolicyviolation", e => console.error("CSP violation: " + e.violatedDirective + " " + e.blockedURI));`;
const NO_STORAGE = `for (const k of ["localStorage", "sessionStorage"]) Object.defineProperty(window, k, { get() { throw new DOMException("refused", "SecurityError"); } });`;

const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
async function open(viewport, { seed, noStorage = false, scheme = "light" } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: scheme });
  await context.addInitScript(WATCH);
  if (seed) await context.addInitScript(FAKE_DB(seed));
  if (noStorage) await context.addInitScript(NO_STORAGE);
  const page = await context.newPage();
  page.on("console", m => { if (m.type() === "error") problems.push(`console: ${m.text()}`); });
  page.on("pageerror", e => problems.push(`pageerror: ${e.message}`));
  page.on("requestfailed", r => problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`));
  page.on("response", r => { if (r.status() >= 400) problems.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(`http://127.0.0.1:${PORT + 1}/`);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  const frame = page.frames().find(f => f.url().endsWith("/index.html"));
  const drawn = await frame.evaluate(() => ({ items: document.querySelectorAll("details").length,
    shown: [...document.querySelectorAll("[role=alert]")].filter(e => !e.hidden).map(e => e.textContent) }));
  return { frame, page, context, drawn };
}

try {
  // Desktop, saving: starts from a saved doc, saves each change.
  const { frame: f, page, context, drawn } = await open({ width: 1280, height: 900 }, { seed: { fish_dace: { rarity: "rare" }, not_a_species: { rarity: "epic" } } });
  expect(drawn.items === 81 && !drawn.shown.length, `renders the 81 fish in the frame, nothing shown as an error: ${JSON.stringify(drawn)}`);
  expect((await f.locator(".status[role=status]").textContent()) === "All changes saved", "db connected: All changes saved");
  const tab = name => f.getByRole("tab", { name: new RegExp(`^${name}`) });
  expect(/1 changed/.test(await tab("Fish").textContent()), `the Fish tab counts the saved change: ${await tab("Fish").textContent()}`);
  const dace = f.locator("details", { has: f.locator(".name", { hasText: /^Dace$/ }) });
  expect(await dace.evaluate(d => d.classList.contains("changed")) && await dace.locator(".badge").isVisible(), "the saved species is marked changed");
  await dace.locator("summary").click();
  expect((await dace.locator(".was").first().textContent()) === "was Common", `shows the game's value beside the change: ${await dace.locator(".was").first().textContent()}`);
  const writes = () => f.evaluate(() => window.__writes);
  const last = async () => (await writes()).at(-1);
  const settle = () => f.waitForTimeout(800);
  const field = label => dace.locator(".field", { has: f.locator(".label", { hasText: label }) });

  await field("Rarity").getByRole("button", { name: "Epic" }).click();
  await settle();
  expect(JSON.stringify(await writes()) === JSON.stringify([["species", "fish_dace", { rarity: "epic" }]]), `a rarity click saves the doc: ${JSON.stringify(await writes())}`);
  expect((await field("Sell price").locator("input").inputValue()) === "180", "the price follows the rarity table (epic fish 180)");
  await field("Sell price").locator("input").fill("77");
  await field("Sell price").locator("input").press("Enter");
  await settle();
  expect(JSON.stringify((await last())[2]) === JSON.stringify({ rarity: "epic", price: 77 }), `its own price saved: ${JSON.stringify(await last())}`);

  // the time bar: paint 8:00 to 16:00 across the cells, then drag the end handle past midnight to 4:00
  const bar = field("Time of day").locator(".cells");
  await bar.scrollIntoViewIfNeeded();
  const b = await bar.boundingBox(), xAt = hour => b.x + (b.width * hour) / 24, y = b.y + b.height / 2;
  const n0 = (await writes()).length;
  await page.mouse.move(xAt(8.5), y); await page.mouse.down();
  for (const hr of [10.5, 13.5, 15.5]) await page.mouse.move(xAt(hr), y);
  await page.mouse.up();
  await settle();
  expect(JSON.stringify((await last())[2].hours) === "[8,16]" && (await writes()).length === n0 + 1, `painting the bar sets 8 to 16, saved once: ${JSON.stringify(await last())}`);
  const endH = field("Time of day").getByRole("slider", { name: "Ends at" });
  const e = await endH.boundingBox();
  await page.mouse.move(e.x + e.width / 2, e.y + e.height / 2); await page.mouse.down();
  for (const hr of [20, 23.9, 24]) await page.mouse.move(xAt(hr), y);
  await page.mouse.up();
  await endH.focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press("ArrowRight");
  await settle();
  expect(JSON.stringify((await last())[2].hours) === "[8,4]", `the end handle wraps past midnight to 4:00: ${JSON.stringify(await last())}`);
  expect(/overnight/.test(await field("Time of day").locator(".hint").textContent()), "the readout says overnight");
  await field("Time of day").getByLabel("All day").check();
  await settle();
  expect(!("hours" in (await last())[2]), `all day is the game's value again, so it's dropped: ${JSON.stringify(await last())}`);

  // months, weather, biome, size
  await field("Months").getByRole("button", { name: "January" }).click();
  await field("Weather").getByRole("button", { name: "rain" }).click();
  await field("Biome").locator("select").selectOption("pond");
  await field("Size").locator("input").first().fill("12");
  await field("Size").locator("input").first().press("Tab");
  await settle();
  const d = (await last())[2];
  expect(JSON.stringify(d.months) === "[2,3,4,5,6,7,8,9,10,11,12]" && JSON.stringify(d.weather) === '["rain"]' && d.biome === "pond" && JSON.stringify(d.size) === "[12,18]",
    `months, weather, biome and size saved: ${JSON.stringify(d)}`);
  expect(JSON.stringify(await field("Biome").locator("option").allTextContents()) === JSON.stringify(["river", "pond", "cliff pool", "sea"]), "a fish's biomes are the water ones");
  await page.screenshot({ path: join(evidence, "desktop-fish.png") });

  await dace.getByRole("button", { name: "Reset to the game's values" }).click();
  await settle();
  expect(JSON.stringify(await last()) === JSON.stringify(["species", "fish_dace", null]), `reset deletes the doc: ${JSON.stringify(await last())}`);
  expect(!/changed/.test(await tab("Fish").textContent()), "and the tab count clears");

  // search across every kind; the other tabs
  await f.getByRole("searchbox").fill("monarch");
  expect((await f.locator("details").count()) === 1 && (await f.locator("details .kind").textContent()) === "Bugs", "search finds a bug from the Fish tab, labelled with its kind");
  await f.getByRole("searchbox").fill("");
  for (const [name, n] of [["Sea creatures", 12], ["Bugs", 20], ["Fruit", 8], ["Shells", 15], ["Minerals", 5]]) {
    await tab(name).click();
    expect((await f.locator("details").count()) === n, `${name}: ${n} species`);
  }
  await f.locator("details").first().locator("summary").click();
  expect(!(await f.locator(".field", { has: f.locator(".label", { hasText: "Size" }) }).count()) && /rocks/.test(await f.locator("select").first().inputValue()), "a mineral has no size, and a land biome");
  const broken = await f.evaluate(async () => {
    await Promise.all([...document.images].map(i => (i.loading = "eager", i.decode().catch(() => null))));
    return [...document.images].filter(i => !i.naturalWidth).map(i => i.src);
  });
  expect(!broken.length, `every icon loads: ${broken.join(" ")}`);
  await context.close();

  // phone, dark, storage refused
  const phone = await open({ width: 390, height: 844 }, { seed: { fish_salmon: { months: [], hours: [20, 4] } }, noStorage: true, scheme: "dark" });
  expect(phone.drawn.items === 81 && !phone.drawn.shown.length, `renders at 390 px with storage refused: ${JSON.stringify(phone.drawn)}`);
  const salmon = phone.frame.locator("details", { has: phone.frame.locator(".name", { hasText: /^Salmon$/ }) });
  await salmon.locator("summary").click();
  await salmon.scrollIntoViewIfNeeded();
  const wide = await phone.frame.evaluate(() => ({ doc: document.documentElement.scrollWidth, view: document.documentElement.clientWidth }));
  expect(wide.doc <= wide.view, `no sideways scroll at 390 px: ${JSON.stringify(wide)}`);
  await phone.page.screenshot({ path: join(evidence, "phone-dark.png") });
  await phone.context.close();

  // no db: it says it can't save, and still edits
  const none = await open({ width: 900, height: 700 });
  expect(none.drawn.items === 81 && none.drawn.shown.length === 1 && /can't save/.test(none.drawn.shown[0]), `without a db it says it can't save: ${JSON.stringify(none.drawn.shown)}`);
  await none.context.close();
} catch (err) {
  problems.push(`crashed: ${err.message.split("\n")[0]}`);
} finally {
  await browser.close();
  server.close(); host.close();
}
console.log(log.join("\n"));
console.log(`dist: ${files.length} files, ${(bytes / 1e6).toFixed(2)} MB`);
if (problems.length) { console.log(`\n${problems.length} problem(s):\n${[...new Set(problems)].join("\n")}`); process.exit(1); }
console.log("catalogue editor check ok");
