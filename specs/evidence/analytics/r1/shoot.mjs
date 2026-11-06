// The analytics lane's evidence shots (an1-*): headless Chromium, muted, no window. Run by shoot.sh (dev server on
// :3498, Supabase env blanked). node shoot.mjs <out_dir>
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const OUT = process.argv[2];
const HOST = process.env.HOST ?? "http://localhost:3498";
const NOW = "2026-11-06T18:00:00Z";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
const shots = [
  ["an1-demo-desktop", `/dev/analytics?now=${NOW}`, { width: 1440, height: 900 }, null],
  ["an1-demo-phone", `/dev/analytics?now=${NOW}`, { width: 390, height: 844 }, null],
  ["an1-backfill-funnel", "/dev/analytics?source=backfill", { width: 1440, height: 900 }, "funnel"],
  ["an1-backfill-quit", "/dev/analytics?source=backfill", { width: 1440, height: 900 }, "quit"],
  ["an1-backfill-phone", "/dev/analytics?source=backfill", { width: 390, height: 844 }, null],
  ["an1-gate-signed-out", "/student/dashboard/admin/game", { width: 1440, height: 900 }, "viewport"],
];
for (const [name, path, viewport, part] of shots) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  page.on("pageerror", (e) => console.log(name, "pageerror", e.message.slice(0, 200)));
  await page.goto(HOST + path, { waitUntil: "networkidle", timeout: 180_000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" }); // the dev overlay's badge
  await page.waitForTimeout(1500);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  if (wide) console.log(name, "horizontal page scroll!");
  if (part === "funnel" || part === "quit") {
    const sections = page.locator("section");
    const first = sections.filter({ hasText: part === "funnel" ? "The funnel" : "Where sessions end" }).first();
    const box = await first.boundingBox();
    const box2 = part === "quit" ? await sections.filter({ hasText: "Where people stop for good" }).first().boundingBox() : box;
    const y = box.y - 8, h = Math.max(box.y + box.height, box2.y + box2.height) - box.y + 16;
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true, clip: { x: 0, y, width: viewport.width, height: h } });
  } else {
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: part !== "viewport" });
  }
  console.log("shot", name, wide ? "(wide)" : "");
  await page.close();
}
await browser.close();
