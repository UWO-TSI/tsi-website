// The analytics lane's evidence shots (an2-*): headless Chromium, muted, no window. Run by shoot.sh (dev server on
// :3498, Supabase env blanked). node shoot.mjs <out_dir>
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const OUT = process.argv[2];
const HOST = process.env.HOST ?? "http://localhost:3498";
const NOW = "2026-11-13T18:00:00Z";
const DEMO = `/dev/analytics?now=${NOW}`;
const DESK = { width: 1440, height: 900 }, PHONE = { width: 390, height: 844 };
const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
// [name, path, viewport, what: null (full page) | "viewport" | a card's title | "#id", colour scheme]
const shots = [
  ["an2-desktop", DEMO, DESK, null, "light"],
  ["an2-phone", DEMO, PHONE, null, "light"],
  ["an2-dark", DEMO, DESK, "viewport", "dark"],
  ["an2-dark-phone", DEMO, PHONE, "viewport", "dark"],
  ["an2-summary", DEMO, DESK, "What the numbers say", "light"],
  ["an2-tiles", DEMO, DESK, ["This period", "Active and coming back"], "light"],
  ["an2-over-time", DEMO, DESK, "Players over time", "light"],
  ["an2-funnel", DEMO, DESK, "The funnel", "light"],
  ["an2-quit", DEMO, DESK, ["Where people stop for good", "Where sessions end"], "light"],
  ["an2-retention", DEMO, DESK, ["Retention by signup week", "How long a session lasts"], "light"],
  ["an2-features", DEMO, DESK, ["Features", "Time between steps"], "light"],
  ["an2-kinds", DEMO, DESK, "Every kind of event", "light"],
  ["an2-backfill", "/dev/analytics?source=backfill", DESK, ["What the numbers say", "The funnel"], "light"],
  ["an2-kit", "/lab/gui", DESK, "#charts", "light"],
  ["an2-gate-signed-out", "/student/dashboard/admin/game", DESK, "viewport", "light"],
];
const only = process.env.ONLY?.split(",");
for (const [name, path, viewport, what, scheme] of shots) {
  if (only && !only.includes(name)) continue;
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, colorScheme: scheme });
  page.on("pageerror", (e) => console.log(name, "pageerror", e.message.slice(0, 200)));
  await page.goto(HOST + path, { waitUntil: "networkidle", timeout: 180_000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }); // the dev overlay's badge
  await page.waitForTimeout(4000); // the site's loading screen is gone by ~3 s; the bars have grown
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (wide) console.log(name, "horizontal page scroll!");
  if (what === null || what === "viewport") {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: what === null });
  } else {
    const titles = Array.isArray(what) ? what : [what];
    const boxes = [];
    for (const t of titles) {
      const el = t.startsWith("#") ? page.locator(t) : page.locator("section").filter({ has: page.locator("h2", { hasText: new RegExp(`^${t}$`) }) }).first();
      await el.scrollIntoViewIfNeeded();
      const sy = await page.evaluate(() => window.scrollY), b = await el.boundingBox();
      boxes.push({ ...b, y: b.y + sy });
    }
    const x = Math.max(0, Math.min(...boxes.map((b) => b.x)) - 8), y = Math.min(...boxes.map((b) => b.y)) - 8;
    const r = Math.max(...boxes.map((b) => b.x + b.width)) + 8, bottom = Math.max(...boxes.map((b) => b.y + b.height)) + 8;
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true, clip: { x, y, width: r - x, height: bottom - y } });
  }
  console.log("shot", name, wide ? "(wide)" : "");
  await page.close();
}
await browser.close();
