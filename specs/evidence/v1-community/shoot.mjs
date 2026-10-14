// v1 community evidence (specs/v1-drop.md §3): name tags, chat, friends and photo mode, two real clients against a
// local realtime server (DEV_AUTH=1, dev tokens) where it matters. Headless Chromium on the GPU (Metal), muted, never
// brought to the front; the dev server on :3162 with the Supabase env pointed at nothing (never production), the shared
// browser lock held. PNGs land in <out_dir>.
//   node specs/evidence/v1-community/shoot.mjs <out_dir> <scene> [<scene> ...]
// Scenes: tags, chat, friends, photo. `friends` starts 29 bots on the local server (realtime/scripts/bots.ts) so the
// first shard locks and Bob lands in a second one; Alice joins him there by Join.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT, ...SCENES] = process.argv.slice(2);
const HOST = process.env.HOST ?? "http://localhost:3162";
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob",
  top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };
const rad = d => (Number(d) * Math.PI) / 180;

const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
const pages = [];

/** A fresh device as `as` (a saved look skips the creator; greeted; no gift put off), camera at yaw/pitch (degrees), zoom. */
async function client(query, { cam = null, extra = {}, size = { width: 1280, height: 800 } } = {}) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const tag = (query.match(/as=(\w+)/) ?? [, "page"])[1];
  page.on("pageerror", e => console.log(tag, "pageerror", e.message.slice(0, 300)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|supabase|401|503|404|500|127\.0\.0\.1:9/i.test(m.text())) console.log(tag, "console", m.text().slice(0, 300)); });
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([l, c, e]) => {
    localStorage.clear();
    localStorage.setItem("tsi.look.v1", l);
    localStorage.setItem("tsi.welcomed.v1", "1");
    localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
    if (c) localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: c[0], pitch: c[1], zoom: c[2] ?? 1, sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false }));
    for (const [k, v] of Object.entries(e)) localStorage.setItem(k, v);
  }, [JSON.stringify(LOOK), cam && [rad(cam[0]), rad(cam[1]), cam[2]], extra]);
  await page.goto(`${HOST}/lab/island?${query}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 300000 }).catch(() => console.log(tag, "still preparing"));
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
  pages.push(page);
  return page;
}
const shot = (page, name, clip) => page.screenshot({ path: `${OUT}/${name}.png`, ...(clip ? { clip } : {}) }).then(() => console.log("shot", name));
const remotes = page => page.evaluate(() => window.__net?.remotes() ?? []);
async function waitRemote(page, name, ms = 120000) {
  await page.waitForFunction(n => (window.__net?.remotes() ?? []).some(r => r.name === n && r.tier !== "hidden"), name, { timeout: ms });
}
/** Type like a person (the typing flag goes up with the first letter). */
async function typeSlowly(page, text) { for (const ch of text) { await page.keyboard.type(ch); await page.waitForTimeout(60); } }

for (const scene of SCENES) {
  if (scene === "tags") {
    // Bots (the loopback) and the residents near the plaza: names within ~8 steps, members' dots, residents warmer, yours hidden.
    const page = await client("bots=10&seed=3&at=13:00", { cam: [180, 32, 1.1] });
    await page.waitForTimeout(9000);
    await shot(page, "01-name-tags");
    console.log("remotes", JSON.stringify((await remotes(page)).map(r => [r.name, r.tier, r.plate, Math.round(r.dist * 10) / 10])));
    await page.context().close();
  }
  if (scene === "chat") {
    // Two players side by side on the real server: the "…" while Alice writes, her bubble and line on Bob's screen,
    // Bob's refused line said kindly, the log and a player card.
    const alice = await client("mp=dev&as=Alice&at=4,-6&at=13:00", { cam: [200, 30, 1] });
    const bob = await client("mp=dev&as=Bob&at=6,-4.5&at=13:00", { cam: [200, 30, 1] });
    await waitRemote(alice, "Bob");
    await waitRemote(bob, "Alice");
    await bob.waitForTimeout(2500);
    await shot(bob, "02-two-players-tags");
    await alice.getByRole("application", { name: "Island walking area" }).focus();
    await alice.keyboard.press("Enter");
    await alice.waitForSelector("[data-chat-open] input", { timeout: 10000 });
    await shot(alice, "03-chat-bar-open");
    await typeSlowly(alice, "hi Bob! want to go fishing?");
    await bob.waitForTimeout(700);
    await shot(bob, "04-typing-dots");
    await alice.keyboard.press("Enter");
    await bob.waitForTimeout(900);
    await shot(bob, "05-bubble-and-line");
    await shot(alice, "06-own-bubble");
    await bob.getByRole("application", { name: "Island walking area" }).focus();
    await bob.keyboard.press("Enter");
    await bob.waitForSelector("[data-chat-open] input", { timeout: 10000 });
    await typeSlowly(bob, "what the f*ck");
    await bob.keyboard.press("Enter");
    await bob.waitForTimeout(900);
    await shot(bob, "07-refused-kindly");
    await bob.keyboard.press("Enter");
    await bob.waitForSelector("[data-chat-open] input", { timeout: 10000 });
    await bob.waitForTimeout(400);
    await shot(bob, "08-log-open-words-back");
    await bob.keyboard.press("Escape");
    await bob.keyboard.press("Enter");
    await bob.waitForSelector("[data-chat-open]", { timeout: 10000 });
    await bob.getByRole("button", { name: /Alice: open their card/ }).first().click();
    await bob.waitForSelector("[data-testid=player-card]", { timeout: 10000 });
    await bob.waitForTimeout(400);
    await shot(bob, "09-player-card");
    await bob.getByRole("button", { name: /^Report/ }).click();
    await bob.waitForTimeout(300);
    await shot(bob, "10-report-reasons");
    console.log("bob remotes", JSON.stringify((await remotes(bob)).map(r => [r.name, r.tier, r.plate])));
    for (const p of [alice, bob]) await p.context().close();
  }
  if (scene === "photo") {
    // Solo: P opens photo mode; the HUD steps away; filters, frames, the free camera, depth of field, a selfie with a
    // held pose; the snap and Save to device (the saved PNGs land beside the shots).
    const page = await client("at=4,-6&at=17:30", { cam: [200, 30, 1] });
    await page.waitForTimeout(4000);
    await shot(page, "20-before-photo-mode");
    await page.getByRole("application", { name: "Island walking area" }).focus();
    await page.keyboard.press("p");
    await page.waitForSelector("[data-testid=photo-mode]", { timeout: 10000 });
    await page.waitForTimeout(800);
    await shot(page, "21-photo-mode-open");
    const box = await page.getByRole("application", { name: "Island walking area" }).boundingBox();
    const drag = async (dx, dy) => {
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.35);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) await page.mouse.move(box.x + box.width * 0.5 + (dx * i) / 10, box.y + box.height * 0.35 + (dy * i) / 10);
      await page.mouse.up();
    };
    await drag(170, -30);
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.35);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -120);
    await page.waitForTimeout(900);
    await shot(page, "22-orbit-zoom-focus");
    const save = async (name) => {
      await page.getByRole("button", { name: "Take a photo" }).click();
      await page.waitForSelector("img[alt='Your photo of the island']", { timeout: 30000 });
      await page.waitForTimeout(400);
      await shot(page, `${name}-preview`);
      const [download] = await Promise.all([page.waitForEvent("download"), page.getByText("Save to device").click()]);
      await download.saveAs(`${OUT}/${name}-saved.png`);
      console.log("saved", name, download.suggestedFilename());
      await page.getByRole("button", { name: /Take another/ }).click();
    };
    for (const [filter, frame, name] of [["Golden", "Polaroid", "23-golden-polaroid"], ["Night glow", "Postcard", "24-night-postcard"], ["Mono", "TSI", "25-mono-tsi"], ["Soft film", "Plain", "26-soft-plain"], ["Pastel", "Plain", "27-pastel"], ["Polaroid", "Polaroid", "28-polaroid-filter"]]) {
      await page.getByRole("radiogroup", { name: "Filter" }).getByRole("radio", { name: filter, exact: true }).click();
      await page.getByRole("radiogroup", { name: "Frame" }).getByRole("radio", { name: frame, exact: true }).click();
      await page.waitForTimeout(400);
      await shot(page, `${name}-live`);
      await save(name);
    }
    // A selfie, waving, the pose held, focus soft.
    await page.getByRole("radiogroup", { name: "Filter" }).getByRole("radio", { name: "Natural", exact: true }).click();
    await page.getByRole("radio", { name: "Selfie", exact: true }).click();
    await page.getByRole("button", { name: "Wave", exact: true }).click();
    await page.waitForTimeout(700);
    await page.getByRole("button", { name: "Hold pose" }).click();
    await page.waitForTimeout(800);
    await shot(page, "29-selfie-wave-held");
    await page.getByRole("button", { name: "Fold the settings away" }).click();
    await page.waitForTimeout(300);
    await shot(page, "29b-selfie-settings-folded");
    await page.getByRole("button", { name: "Show the settings" }).click();
    await save("29-selfie");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(600);
    await shot(page, "30-closed-hud-back");
    await page.context().close();
  }
  if (scene === "friends") {
    // Shard 1: Alice and 29 bots (locked at 30). Bob lands in shard 2. They add each other by code; Alice joins Bob.
    const alice = await client("mp=dev&as=Alice&at=4,-6&at=13:00", { cam: [200, 30, 1] });
    await alice.waitForFunction(() => document.querySelector('[aria-label^="People on the island"]') !== null, null, { timeout: 120000 });
    const bots = spawn("npm", ["--prefix", "realtime", "run", "bots", "--", "--n", "29", "--near", "-24,22", "--radius", "6", "--quiet"], { stdio: "ignore", detached: true });
    await alice.waitForFunction(() => /30/.test(document.querySelector('[aria-label^="People on the island"]')?.getAttribute("aria-label") ?? ""), null, { timeout: 60000 });
    const bob = await client("mp=dev&as=Bob&at=6,-4.5&at=13:00", { cam: [200, 30, 1] });
    await bob.waitForFunction(() => document.querySelector('[aria-label^="People on the island"]') !== null, null, { timeout: 120000 });
    console.log("alice people", await alice.getAttribute('[aria-label^="People on the island"]', "aria-label"), "bob people", await bob.getAttribute('[aria-label^="People on the island"]', "aria-label"));
    // Bob's code.
    await bob.getByRole("button", { name: /^Friends/ }).click();
    await bob.getByRole("tab", { name: "Add" }).click();
    await bob.waitForFunction(() => /^[2-9A-Z]{4}-[2-9A-Z]{4}$/.test(document.querySelector("[data-testid=friend-code]")?.textContent ?? ""), null, { timeout: 20000 });
    const code = await bob.textContent("[data-testid=friend-code]");
    await shot(bob, "11-your-friend-code");
    await bob.keyboard.press("Escape");
    // Alice asks by code.
    await alice.getByRole("button", { name: /^Friends/ }).click();
    await alice.getByRole("tab", { name: "Add" }).click();
    await alice.fill("#friend-code-input", code.toLowerCase());
    await alice.getByRole("button", { name: "Send request" }).click();
    await alice.waitForTimeout(800);
    await shot(alice, "12-request-by-code");
    await alice.keyboard.press("Escape");
    // Bob answers.
    await bob.getByRole("button", { name: /^Friends/ }).click();
    await bob.getByRole("tab", { name: /Requests/ }).click();
    await bob.getByRole("button", { name: "Accept" }).waitFor({ timeout: 20000 });
    await shot(bob, "13-request-waiting");
    await bob.getByRole("button", { name: "Accept" }).click();
    await bob.waitForTimeout(800);
    await bob.keyboard.press("Escape");
    // Alice sees Bob on the island in another shard: Join.
    await alice.waitForTimeout(1200);
    await alice.getByRole("button", { name: /^Friends/ }).click();
    await alice.getByRole("tab", { name: "Friends" }).click();
    await alice.getByRole("button", { name: /Join/ }).first().waitFor({ timeout: 20000 });
    await shot(alice, "14-friends-list-join");
    await alice.getByRole("button", { name: /Join/ }).first().click();
    await alice.waitForFunction(() => document.body.textContent?.includes("You're with Bob now."), null, { timeout: 30000 });
    await alice.keyboard.press("Escape");
    await waitRemote(alice, "Bob", 60000);
    await alice.waitForTimeout(2500);
    console.log("alice people after", await alice.getAttribute('[aria-label^="People on the island"]', "aria-label"));
    await shot(alice, "15-joined-friend-heart-tag");
    // A click on Bob opens his card: friends, where he is, wave.
    const bobSid = (await remotes(alice)).find(r => r.name === "Bob")?.sid;
    const at = await alice.evaluate(sid => window.__net.screen(sid), bobSid);
    await alice.mouse.click(at.x, at.y);
    await alice.waitForSelector("[data-testid=player-card]", { timeout: 10000 });
    await alice.waitForTimeout(400);
    await shot(alice, "16-card-from-a-click");
    await alice.getByRole("button", { name: "Wave" }).click();
    await alice.waitForTimeout(500);
    await alice.keyboard.press("Escape");
    await bob.waitForTimeout(300);
    await shot(bob, "17-alice-waves");
    await alice.getByRole("application", { name: "Island walking area" }).focus();
    await alice.keyboard.press("m");
    await alice.waitForTimeout(800);
    await shot(alice, "18-minimap-friend");
    try { process.kill(-bots.pid); } catch {}
    for (const p of [alice, bob]) await p.context().close();
  }
}
await browser.close();
