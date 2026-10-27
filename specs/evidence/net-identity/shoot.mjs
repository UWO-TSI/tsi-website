// net-identity evidence (specs/lanes/net-identity.md): a player's saved look and world name reach another client
// without a rejoin, and a later joiner gets them at join. Two (then three) headless clients, muted, never brought to
// the front, against a local realtime (realtime/scripts/cardHarness.ts) whose cards behave as production's (60 s cache, refresh re-read at most every
// 10 s) over a JSON file; the dev server with the Supabase env pointed at nothing. Alice's
// /api/profile and /api/identity/* are answered here: what she saves lands in the cards file, as the database would.
//   CARDS=<file> HOST=http://localhost:<port> node specs/evidence/net-identity/shoot.mjs <out_dir>
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
const require = createRequire("/opt/homebrew/lib/node_modules/");
const { chromium } = require("playwright");

const [OUT] = process.argv.slice(2);
const HOST = process.env.HOST ?? "http://localhost:3462";
const CARDS = process.env.CARDS;
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", extras: [], bangs: "", back: "hair_bob_pigtail", top: "top_tee", bottom: "bottom_shorts", onepiece: null, shoes: "shoes_slipon", acc: {}, colors: {} };
const rad = d => (Number(d) * Math.PI) / 180;
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const results = [];
const record = (step, ok, detail = "") => { results.push({ step, ok, detail }); log(ok ? "PASS" : "FAIL", step, detail); };
const cards = () => { try { return JSON.parse(readFileSync(CARDS, "utf8")); } catch { return {}; } };
const save = (who, patch) => writeFileSync(CARDS, JSON.stringify({ ...cards(), [who]: { ...cards()[who], ...patch } }));
writeFileSync(CARDS, "{}");

const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });

/** A device as `who`, camera at yaw/pitch (degrees); `saved`: a look on the device (no creator). `account`: Alice's routes. */
async function client(who, at, { saved = true, account = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", e => log(who, "pageerror", e.message.slice(0, 300)));
  if (account) {
    await page.route("**/api/profile", async r => {
      if (r.request().method() === "PATCH") {
        save(who, { look: JSON.parse(r.request().postData()).avatar_config.look });
        log(who, "PATCH /api/profile: look saved");
        return r.fulfill({ json: { ok: true } });
      }
      return r.fulfill({ json: { profile: { avatar_config: cards()[who]?.look ? { look: cards()[who].look } : {} } } });
    });
    await page.route("**/api/identity/me", r => r.fulfill({ json: { ok: true, identity: { world_name: cards()[who]?.name ?? null, badge: "member", family: null, settings: null } } }));
    await page.route("**/api/identity/name**", async r => {
      if (r.request().method() === "POST") {
        const { name } = JSON.parse(r.request().postData());
        save(who, { name });
        log(who, "POST /api/identity/name:", name);
        return r.fulfill({ json: { ok: true, name: { world_name: name, name_changes: 0, next_change_at: null } } });
      }
      const name = new URL(r.request().url()).searchParams.get("check");
      return r.fulfill({ json: { ok: true, name: { name, available: true } } }); // the route's shape (jsonResult)
    });
  }
  await page.goto(`${HOST}/lab/island`, { waitUntil: "domcontentloaded" });
  await page.evaluate(([l, c]) => {
    localStorage.clear();
    if (l) localStorage.setItem("tsi.look.v1", l);
    localStorage.setItem("tsi.welcomed.v1", "1");
    localStorage.setItem("tsi.gift.later", new Date().toISOString().slice(0, 10));
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: c[0], pitch: c[1], zoom: 1, sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false }));
  }, [saved ? JSON.stringify(LOOK) : null, [rad(200), rad(30)]]);
  await page.goto(`${HOST}/lab/island?mp=dev&as=${who}&at=${at}&at=13:00`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("canvas", { timeout: 300000 });
  await page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 300000 }).catch(() => log(who, "still preparing"));
  await page.addStyleTag({ content: "#island-options, [aria-controls='island-options'], nextjs-portal { display: none !important; }" }).catch(() => {});
  return page;
}
const remote = (page, name) => page.evaluate(n => (window.__net?.remotes() ?? []).find(r => r.name === n) ?? null, name);
/** A crop around a remote on the page (its middle from the dev hook), or the whole page. */
async function shot(page, file, sid) {
  const at = sid ? await page.evaluate(s => window.__net?.screen(s) ?? null, sid) : null;
  const clip = at ? { x: Math.max(0, at.x - 260), y: Math.max(0, at.y - 230), width: 520, height: 380 } : undefined;
  await page.screenshot({ path: `${OUT}/${file}.png`, ...(clip ? { clip } : {}) });
  log("shot", file);
}

try {
  const bob = await client("Bob", "6,-4.5", { account: true });
  const alice = await client("Alice", "4,-6", { saved: false, account: true });

  // 1. The first creator (Alice has no look yet; she joins once it closes): an empty name is asked for, not dropped.
  const done = alice.getByRole("button", { name: "That's me" });
  await done.waitFor({ timeout: 60000 });
  await done.click();
  const note = await alice.getByText("The island needs a name for you.").waitFor({ timeout: 5000 }).then(() => true, () => false);
  const focused = await alice.evaluate(() => document.activeElement?.closest("label, div")?.textContent ?? "");
  record("first creator: an empty name is asked for, nothing saved", note && !cards().Alice?.look, `focus in: ${focused.slice(0, 40)}`);
  await alice.screenshot({ path: `${OUT}/01-alice-name-needed.png` });
  for (let i = 0; i < 3; i++) { await alice.getByRole("button", { name: "Surprise me" }).click(); await alice.waitForTimeout(300); }
  await alice.getByLabel("Your name on the island").fill("Pebble");
  await alice.waitForTimeout(700); // the availability check answers (the route's shape)
  const free = await alice.getByText("That name is free.").isVisible();
  await done.click();
  const aliceSaved = Date.now();
  const want = cards().Alice;
  record("first creator: the checked name goes with the look", free && !!want?.look && want?.name === "Pebble", JSON.stringify(want).slice(0, 100));
  // Her exact saved look: a card cached from a visit under 60 s ago comes first, then her refresh (11 s after the join).
  await bob.waitForFunction(l => (window.__net?.remotes() ?? []).some(r => r.name === "Pebble" && r.look && JSON.stringify(JSON.parse(r.look)) === l), JSON.stringify(want.look), { timeout: 60000 }).catch(() => {});
  const pebble = await remote(bob, "Pebble");
  record("Bob sees Pebble's name and saved look", !!pebble && JSON.stringify(JSON.parse(pebble.look)) === JSON.stringify(want.look), `${((Date.now() - aliceSaved) / 1000).toFixed(1)} s after her save`);
  await bob.waitForTimeout(2500);
  if (pebble) await shot(bob, "02-bob-sees-pebble", pebble.sid);

  // 2. Mid-session: Bob, joined, names himself and changes his look in the wardrobe (the fitting room by his spawn).
  await alice.waitForFunction(() => (window.__net?.remotes() ?? []).some(r => r.name === "Bob"), null, { timeout: 60000 }).catch(() => {});
  const bobBefore = await remote(alice, "Bob");
  await bob.getByRole("application", { name: "Island walking area" }).focus();
  await bob.keyboard.press("e");
  const wear = bob.getByRole("button", { name: "Wear this" });
  const opened = await wear.waitFor({ timeout: 15000 }).then(() => true, () => false);
  record("the wardrobe opens with the name field", opened && await bob.getByLabel("Your name on the island").isVisible());
  if (opened) {
    await bob.getByLabel("Your name on the island").fill("Kelp");
    // Another skin tone (Head & skin, if the wardrobe starts elsewhere the first unpressed option of its first tab).
    const option = bob.locator('#creator-panel button[aria-pressed="false"]:not([disabled])').nth(3);
    if (await option.count()) await option.click();
    await bob.waitForTimeout(800);
    await bob.screenshot({ path: `${OUT}/03-bob-wardrobe-name.png` });
    await wear.click();
  }
  const bobSaved = Date.now();
  await bob.waitForTimeout(500);
  const bobWant = cards().Bob;
  record("the wardrobe saved Bob's look and name", bobWant?.name === "Kelp" && !!bobWant?.look, `look changed: ${JSON.stringify(bobWant?.look) !== (bobBefore?.look ?? "")}`);
  await alice.waitForFunction(l => (window.__net?.remotes() ?? []).some(r => r.name === "Kelp" && JSON.stringify(JSON.parse(r.look || "null")) === l), JSON.stringify(bobWant?.look ?? null), { timeout: 40000 }).catch(() => {});
  const kelp = await remote(alice, "Kelp");
  record("Alice sees Kelp's new name and look without a rejoin", !!kelp && JSON.stringify(JSON.parse(kelp.look)) === JSON.stringify(bobWant.look), `${((Date.now() - bobSaved) / 1000).toFixed(1)} s after his save (one refresh, no sooner than 11 s after the last card read)`);
  await alice.waitForTimeout(2500);
  if (kelp) await shot(alice, "04-alice-sees-kelp", kelp.sid);

  // 3. A player joining later gets both at join.
  const carol = await client("Carol", "5,-3");
  await carol.waitForFunction(() => ["Pebble", "Kelp"].every(n => (window.__net?.remotes() ?? []).some(r => r.name === n)), null, { timeout: 120000 }).catch(() => {});
  const seenP = await remote(carol, "Pebble"), seenK = await remote(carol, "Kelp");
  record("Carol, joining later, sees Pebble and Kelp with their looks at join",
    !!seenP && !!seenK && JSON.stringify(JSON.parse(seenP.look)) === JSON.stringify(want.look) && JSON.stringify(JSON.parse(seenK.look)) === JSON.stringify(bobWant.look));
  await carol.waitForTimeout(3000);
  if (seenP) await shot(carol, "05-carol-sees-them-at-join");
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
  await browser.close();
}
