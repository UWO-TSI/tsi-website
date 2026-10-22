// Flat UI round 2, step 7 (specs/polish/flat-ui.md): the first four menus in the cream palette, before and after.
// The journal, the notice board and the mailbox on /dev/progression's in-memory service (demo=1), the ruins mission
// board on /dev/flat-ui (surface=missions). Desktop and phone. Headless and muted; the dev server on PORT with the
// Supabase env blanked. Run from web/:   PORT=3192 node ../specs/evidence/flat-ui/shots-round2-step7.mjs <out-dir> [scene ...]
// PALETTE=flat shoots them in the clean flat palette (round 3 verdict: beside the cream, for David to pick).
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");
const [OUT, ...ONLY] = process.argv.slice(2);
const PORT = process.env.PORT ?? 3192, HOST = `http://localhost:${PORT}`;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
const PHONE = { width: 390, height: 844, mobile: true };

async function open(path, { width = 1440, height = 900, mobile = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, ...(mobile ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  page.on("pageerror", e => console.log("pageerror", e.message.slice(0, 200)));
  await page.goto(`${HOST}${path}${process.env.PALETTE ? `&palette=${process.env.PALETTE}` : ""}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-gui-dialog]", { timeout: 300000 });
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForTimeout(1800);
  return { ctx, page };
}
const shot = async (page, name) => { await page.mouse.move(1, 1); await page.waitForTimeout(700); await page.screenshot({ path: join(OUT, `${name}.png`) }); console.log("shot", name); };
const dialog = page => page.locator("[data-gui-dialog]").last();
const scene = (name, path, fn = null, size = {}) => async () => {
  const { ctx, page } = await open(path, size);
  if (fn) { await fn(page); await page.waitForTimeout(600); }
  await shot(page, name);
  await ctx.close();
};
const J = "/dev/progression?demo=1&sheet=", M = "/dev/flat-ui?surface=missions";

const SCENES = {
  journal: scene("s7-journal-quests", `${J}journal`),
  goals: scene("s7-journal-goals", `${J}goals`),
  "journal-letters": scene("s7-journal-letters", `${J}journal`, page => dialog(page).getByRole("tab", { name: /^Letters/ }).click()),
  notice: scene("s7-notice", `${J}notice`),
  mail: scene("s7-mail", `${J}letters`),
  "mail-read": scene("s7-mail-read", `${J}letters`, page => dialog(page).getByRole("button", { name: /Fishing Friday/ }).first().click()),
  "mail-compose": scene("s7-mail-compose", `${J}letters`, page => dialog(page).getByRole("button", { name: /Write a note/ }).first().click()),
  missions: scene("s7-missions", `${M}&cool=hunt-crabs`),
  "missions-active": scene("s7-missions-active", `${M}&mission=hunt-foxes`),
  "missions-done": scene("s7-missions-done", `${M}&mission=hunt-foxes&done=1`),
  "notice-read": scene("s7-notice-read", `${J}notice`, page => dialog(page).getByRole("button", { name: /Welcome to the island/ }).first().click()),
  "journal-phone": scene("s7-journal-phone", `${J}journal`, null, PHONE),
  "notice-phone": scene("s7-notice-phone", `${J}notice`, null, PHONE),
  "mail-phone": scene("s7-mail-phone", `${J}letters`, null, PHONE),
  "missions-phone": scene("s7-missions-phone", `${M}&mission=hunt-foxes`, null, PHONE),
};
for (const [name, run] of Object.entries(SCENES)) {
  if (ONLY.length && !ONLY.includes(name)) continue;
  try { await run(); } catch (e) { console.log("failed", name, e.message.slice(0, 300)); }
}
await browser.close();
