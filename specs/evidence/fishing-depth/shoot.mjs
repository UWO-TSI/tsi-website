// fishing-depth evidence: headless Chromium (never a window), muted, signed out, the dev server on :3147 with the
// Supabase env blanked and NEXT_PUBLIC_GAME_WORLD=new. Each arg is name=query, appended to /lab/island?fixture=v2&
// collections=demo&requests=1&; PNGs land in <out_dir>.
//   node specs/evidence/fishing-depth/shoot.mjs <out_dir> name='at=70.8,61.8&press=e&sheet=1' ...
// In the query: wait=<ms> after load (default 9000); keys=<k>:<ms>;... walks first; press=<key> once before the shot;
// click=<text>,<text> clicks buttons or tabs by their text, in turn; sheet=1 shoots the open sheet alone, else the view.
import { createRequire } from "node:module";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SHOTS] = process.argv.slice(2);
const HOST = "http://localhost:3147";
const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 300)));
page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503/i.test(m.text())) console.log("console", m.text().slice(0, 300)); });
// A saved look, so the character creator doesn't open first (as specs/evidence/polish-interiors/shoot.mjs does).
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
await page.evaluate(l => { localStorage.clear(); localStorage.setItem("tsi.look.v1", l); localStorage.setItem("tsi.pixelated.v1", "false"); }, JSON.stringify(LOOK));
for (const spec of SHOTS) {
  const [name, query = ""] = spec.split(/=(.*)/s);
  const q = new URLSearchParams(query);
  const wait = Number(q.get("wait") ?? 9000), keys = q.get("keys"), press = q.get("press"), click = q.get("click"), sheet = q.get("sheet");
  for (const k of ["wait", "keys", "press", "click", "sheet"]) q.delete(k);
  await page.goto(`${HOST}/lab/island?fixture=v2&collections=demo&requests=1&${q.toString().replace(/%2C/g, ",")}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 300000 }).catch(() => {});
  await page.waitForTimeout(wait);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.locator("canvas").first().click({ position: { x: 640, y: 400 } }).catch(() => {});
  for (const step of keys ? keys.split(";") : []) {
    const [k, ms] = step.split(":");
    await page.keyboard.down(k);
    await page.waitForTimeout(Number(ms));
    await page.keyboard.up(k);
    await page.waitForTimeout(300);
  }
  if (press) { await page.keyboard.press(press); await page.waitForTimeout(1500); }
  for (const text of click ? click.split(",") : []) {
    await page.getByRole("button", { name: text }).or(page.getByRole("tab", { name: text })).first().click({ timeout: 10000 }).catch(e => console.log("click", text, e.message.slice(0, 120)));
    await page.waitForTimeout(1500);
  }
  const target = sheet ? page.locator('[data-testid="progression-sheet"]').first() : page;
  await target.screenshot({ path: `${OUT}/${name}.png` }).catch(e => console.log("shot", name, e.message.slice(0, 160)));
  console.log("shot", name);
}
await browser.close();
