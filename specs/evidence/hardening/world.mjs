// In-world check of the server-rolled catches on staging (dev server :3110), signed in as the
// phase1 member, headed Chromium (WebGL): E at a shell node, then a cast from the south shore,
// hooked and reeled in; the requests and answers of POST /api/collections are logged.
//   node specs/evidence/hardening/world.mjs <outDir> [gates]
// gates: chapters 3-4 in the world instead: E at the museum (open once the fund is complete) and at the ruins gate (chapter 4).
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
const WEB = new URL("../../../web/", import.meta.url).pathname;
const { createChunks } = createRequire(WEB + "package.json")("@supabase/ssr/dist/main/utils/chunker.js");
const { chromium } = createRequire("/opt/homebrew/lib/node_modules/")("playwright");
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REF = "jjiyeroyralfbluowbjq", BASE = "http://localhost:3110";
const env = Object.fromEntries(readFileSync(WEB + ".env.staging.local", "utf8").trim().split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes(REF)) throw new Error("not staging");
const places = JSON.parse(readFileSync(new URL("./points.txt", import.meta.url), "utf8"));

const password = execFileSync("security", ["find-generic-password", "-s", "tethos-staging phase1 member", "-w"]).toString().trim();
const s = await (await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: "phase1-member@tethos-staging.test", password }) })).json();
const cookies = createChunks(`sb-${REF}-auth-token`, "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url")).map((c) => ({ name: c.name, value: c.value, domain: "localhost", path: "/" }));

const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
await ctx.addCookies(cookies);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message.slice(0, 160)));
page.on("request", (r) => { if (r.url().endsWith("/api/collections") && r.method() === "POST") console.log("request", r.postData()); });
page.on("response", async (r) => { if (r.url().endsWith("/api/collections") && r.request().method() === "POST") console.log("response", r.status(), (await r.text()).slice(0, 200)); });
const settle = async () => {
  await page.waitForSelector("canvas", { timeout: 180000 });
  // First visit on this browser: the character creator; the saved look is the member's.
  const skip = page.getByRole("button", { name: "Skip", exact: true }).first();
  if (await skip.waitFor({ timeout: 15000 }).then(() => true, () => false)) { await skip.click(); await page.waitForTimeout(2000); }
  for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing")) ? quiet + 1 : 0; }
  await page.waitForTimeout(8000);
};

if (process.argv[3] === "gates") {
  const h1 = () => page.locator("h1").first().innerText();
  for (const [name, at] of [["museum", [11, 6.6]], ["ruins", [15.6, -2.5]]]) {
    await page.goto(`${BASE}/student/dashboard?at=${at[0]},${at[1]}`, { waitUntil: "domcontentloaded" });
    await settle();
    console.log(name, "before E:", await h1());
    await page.screenshot({ path: `${OUT}/G-${name}-door.png` });
    await page.keyboard.press("e");
    await page.waitForTimeout(6000);
    console.log(name, "after E:", await h1());
    await page.screenshot({ path: `${OUT}/G-${name}-inside.png` });
  }
  await browser.close();
  process.exit(0);
}

// 1. A shell node: stand beside it, press E.
const shell = places.nodes.find((n) => n.id === "shell-3");
await page.goto(`${BASE}/student/dashboard?at=${shell.x},${shell.z + 0.8}`, { waitUntil: "domcontentloaded" });
await settle();
await page.screenshot({ path: `${OUT}/W-01-at-shell.png` });
await page.keyboard.press("e");
await page.waitForTimeout(2500);
await page.screenshot({ path: `${OUT}/W-02-harvested.png` });

// 2. The south shore: hold E to charge, release to cast, E again on the bite.
const shore = places.shore[2];
await page.goto(`${BASE}/student/dashboard?at=${shore.x},${shore.z}`, { waitUntil: "domcontentloaded" });
await settle();
await page.keyboard.down("e");
await page.waitForTimeout(900);
await page.keyboard.up("e");
try {
  await page.getByText("Hook it!").waitFor({ timeout: 15000 });
  await page.keyboard.press("e");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/W-03-reeling.png` });
  // Play the reel like a person: hold E while the fish is right of the bar's centre, release otherwise.
  let held = false;
  for (const end = Date.now() + 45000; Date.now() < end;) {
    const d = await page.evaluate(() => {
      const bar = [...document.querySelectorAll("div")].find((el) => el.style.border === "2px solid rgb(61, 143, 82)");
      const fish = bar?.parentElement?.querySelector("img");
      if (!bar || !fish) return null;
      const b = bar.getBoundingClientRect(), f = fish.getBoundingClientRect();
      return f.left + f.width / 2 - (b.left + b.width / 2);
    });
    if (d === null) break;
    if (d > 0 !== held) { held = d > 0; await (held ? page.keyboard.down("e") : page.keyboard.up("e")); }
    await page.waitForTimeout(30);
  }
  if (held) await page.keyboard.up("e");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/W-04-result.png` });
} catch (e) { console.log("fishing:", e.message.slice(0, 120)); await page.screenshot({ path: `${OUT}/W-03-no-bite.png` }); }
await browser.close();
