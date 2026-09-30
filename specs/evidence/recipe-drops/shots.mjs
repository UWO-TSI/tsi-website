// Rare-catch recipe drop, signed out on ?crafting=demo (dev server :3112, Supabase env blank;
// any supabase.co request is aborted). The demo's drop dice always land. Headed, muted Chromium.
// Writes PNGs; the committed shots are `cwebp -q 82` copies.
//   node specs/evidence/recipe-drops/shots.mjs <outDir> rock <x> <z>
//     stand at a rock that holds a crystal (rare) for the demo member this hour, press E, then open
//     the workbench sheet on the same page (the demo's stores live in the page)
//   node specs/evidence/recipe-drops/shots.mjs <outDir> fish <x> <z>
//     cast from the pond shore with the page's Math.random held at 0.95 for the cast (the demo's
//     server roll then picks the snapping turtle, rare), hook, reel like a person, show the card
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/homebrew/lib/node_modules/")("playwright");
const [OUT, MODE, X, Z] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const ME = "00000000-0000-4000-8000-000000000001"; // lib/crafting/demo.ts

const browser = await chromium.launch({ headless: false, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
await ctx.route(/supabase\.co/, (r) => r.abort());
// The world's node rolls use this browser's member seed: the demo's, so the rock shows what the server rolls.
await ctx.addInitScript((me) => localStorage.setItem("tsi.member.local.v1", me), ME);
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("pageerror", e.message.slice(0, 160)));
await page.goto(`http://localhost:3112/student/dashboard?crafting=demo&at=${X},${Z}`, { waitUntil: "domcontentloaded", timeout: 180000 });
await page.waitForSelector("canvas", { timeout: 180000 });
const skip = page.getByRole("button", { name: "Skip", exact: true }).first();
if (await skip.waitFor({ timeout: 15000 }).then(() => true, () => false)) { await skip.click(); await page.waitForTimeout(2000); }
for (let quiet = 0; quiet < 3;) { await page.waitForTimeout(1000); quiet = await page.evaluate(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing")) ? quiet + 1 : 0; }
await page.waitForTimeout(8000);

if (MODE === "rock") {
  await page.keyboard.press("e");
  await page.getByText("You learned a recipe:").waitFor({ timeout: 15000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/R-02-harvest-taught-recipe.png` });
  console.log("toasts:", await page.evaluate(() => [...document.querySelectorAll("[aria-live] span")].map((s) => s.textContent)));
  // The workbench, opened where the player stands (its prompt listens for this event at the bench).
  await page.evaluate(() => window.dispatchEvent(new CustomEvent("tsi:workbench-near", { detail: true })));
  await page.getByRole("button", { name: /Use the workbench/ }).click();
  await page.getByTestId("crafting-sheet").waitFor({ timeout: 15000 });
  await page.getByText("Laying out your recipes").waitFor({ state: "detached", timeout: 15000 });
  await page.getByLabel("Recipes").getByRole("button", { name: /Glass rod/ }).click();
  await page.waitForTimeout(500);
  console.log("sheet:", (await page.getByTestId("crafting-sheet").innerText()).replace(/\n+/g, " | "));
  await page.screenshot({ path: `${OUT}/R-03-workbench-from-a-rare-catch.png` });
} else {
  await page.evaluate(() => { window.__random = Math.random; Math.random = () => 0.95; });
  await page.keyboard.down("e");
  await page.waitForTimeout(900);
  await page.keyboard.up("e");
  await page.waitForTimeout(1200);
  await page.evaluate(() => { Math.random = window.__random; });
  await page.getByText("Hook it!").waitFor({ timeout: 20000 });
  await page.keyboard.press("e");
  await page.waitForTimeout(800);
  // Hold E while the fish is right of the bar's centre, release otherwise (specs/evidence/hardening/world.mjs).
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
  const line = page.getByText("You learned a recipe:");
  const got = await line.waitFor({ timeout: 12000 }).then(() => true, () => false);
  await page.waitForTimeout(got ? 2500 : 0);
  await page.screenshot({ path: `${OUT}/R-04-${got ? "fish-taught-recipe" : "fish-no-recipe"}.png` });
  console.log("fish:", got ? await line.first().innerText() : "no recipe line");
}
await browser.close();
