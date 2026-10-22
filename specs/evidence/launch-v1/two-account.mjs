// v1 launch: the two-account live test on a Preview (specs/launch/v1-launch.md items 4 and 7, specs/lanes/launch-v1.md).
// Two real accounts (A, B) play the member world on a Preview deployment against prod Supabase and the prod realtime
// server (Fly tethos-rt); a third (M, tier 2 only for the moderation step) acts through the admin routes. Headless
// Chromium, muted, one browser, never brought to the front. Run under the shared browser lock.
//
//   node two-account.mjs setup                 create the three throwaway accounts (ids to $IDS)
//   node two-account.mjs day                   tags, chat, friends, emotes, dance sync, report and the live mute, flow 3
//   node two-account.mjs night                 the campfire with two dancers (after real nightfall)
//
// Env: PREVIEW (https://<deployment>.vercel.app), SHARE (the deployment's `_vercel_share` token), IDS (a JSON file
// outside the repo with the account and row ids), OUT (where shots and results go).
// Secrets: the service key is read from web/.env.local into memory and never printed or written; passwords are random
// per run (the admin API sets a fresh one), held in memory only. The Supabase management token (row writes) comes from
// the Supabase CLI keychain entry.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const WEB = new URL("../../../web/", import.meta.url).pathname;
const requireWeb = createRequire(WEB + "package.json");
const { createServerClient } = requireWeb("@supabase/ssr");
const { chromium } = createRequire("/opt/homebrew/lib/node_modules/")("playwright");

const [PHASE] = process.argv.slice(2);
const PREVIEW = (process.env.PREVIEW ?? "").replace(/\/+$/, "");
const HOST = PREVIEW.replace(/^https:\/\//, "");
const IDS = process.env.IDS;
const OUT = process.env.OUT ?? new URL(".", import.meta.url).pathname;
const REF = "rtbkrngsdbptbjhfbcud";
if (!IDS) throw new Error("IDS is required");
mkdirSync(OUT, { recursive: true });

// ── Environment (values never printed) ──────────────────────────────
const envFile = Object.fromEntries(readFileSync(WEB + ".env.local", "utf8").split("\n").filter(l => /^[A-Z_]+=/.test(l))
  .map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"/, "").replace(/"$/, "").replace(/\\n$/, "").trim()]));
const SB_URL = envFile.NEXT_PUBLIC_SUPABASE_URL, ANON = envFile.NEXT_PUBLIC_SUPABASE_ANON_KEY, SERVICE = envFile.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL?.includes(REF) || !ANON || !SERVICE) throw new Error("web/.env.local is missing the prod Supabase values");
function mgmtToken() {
  let raw = execFileSync("security", ["find-generic-password", "-s", "Supabase CLI", "-w"]).toString().trim().replace(/^go-keyring-base64:/, "");
  if (!raw.startsWith("sbp_")) raw = Buffer.from(raw, "base64").toString();
  return raw;
}
const MGMT = mgmtToken();

// ── Results ─────────────────────────────────────────────────────────
const results = [];
const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
function record(step, ok, detail = "") { results.push({ step, ok, detail }); log(ok ? "PASS" : "FAIL", step, detail); }
const ids = existsSync(IDS) ? JSON.parse(readFileSync(IDS, "utf8")) : {};
const saveIds = () => writeFileSync(IDS, JSON.stringify(ids, null, 2));

// ── Supabase helpers ────────────────────────────────────────────────
/** SQL through the management API. `write` only for the approved writes (M's tier); everything else reads. */
async function sql(query, { write = false } = {}) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, read_only: !write }),
  });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error(`sql: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}
const admin = (path, init = {}) => fetch(`${SB_URL}/auth/v1/admin/${path}`, { ...init, headers: { apikey: SERVICE, "Content-Type": "application/json", ...(init.headers ?? {}) } });
const password = () => randomBytes(24).toString("base64url");
const uuid = /^[0-9a-f-]{36}$/;

const WHO = {
  a: { email: "probe-a@launch.tethos.invalid", display: "Launch Probe A", world: "Probe Alder" },
  b: { email: "probe-b@launch.tethos.invalid", display: "Launch Probe B", world: "Probe Birch" },
  m: { email: "probe-m@launch.tethos.invalid", display: "Launch Probe M", world: "Probe Cedar" },
};

async function setup() {
  for (const [k, w] of Object.entries(WHO)) {
    if (ids[k]?.id) { log("exists", k); continue; }
    const r = await admin("users", { method: "POST", body: JSON.stringify({ email: w.email, password: password(), email_confirm: true, user_metadata: { display_name: w.display } }) });
    const j = await r.json();
    if (!j.id) throw new Error(`create ${k}: HTTP ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
    ids[k] = { id: j.id, email: w.email };
    saveIds();
    log("created", k, j.id);
  }
  const rows = await sql(`select id, tier, membership, display_name from profiles where id in (${["a", "b", "m"].map(k => `'${ids[k].id}'`).join(",")})`);
  log("profiles", JSON.stringify(rows));
}

/** A fresh random password (memory only), then a signed-in session's cookies, as @supabase/ssr writes them. */
async function signIn(k) {
  const pw = password();
  const r = await admin(`users/${ids[k].id}`, { method: "PUT", body: JSON.stringify({ password: pw }) });
  if (!r.ok) throw new Error(`password ${k}: HTTP ${r.status}`);
  const jar = new Map();
  const sb = createServerClient(SB_URL, ANON, { cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: list => { for (const c of list) c.value ? jar.set(c.name, c.value) : jar.delete(c.name); },
  } });
  const { data, error } = await sb.auth.signInWithPassword({ email: ids[k].email, password: pw });
  if (error) throw new Error(`sign-in ${k}: ${error.message}`);
  await new Promise(res => setTimeout(res, 50));
  return { uid: data.user.id, cookies: [...jar].map(([name, value]) => ({ name, value, domain: HOST, path: "/", sameSite: "Lax", secure: true, httpOnly: false })) };
}

// ── Browser helpers ─────────────────────────────────────────────────
let browser;
const LOOKS = {
  a: { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob", top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } },
  b: { skin: 5, hair: 4, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob", top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 5 } },
};
const today = () => new Date().toISOString().slice(0, 10);

/** A context with the Preview's share cookie and k's session; frames from the realtime socket kept for the checks. */
async function player(k, { size = { width: 1280, height: 800 } } = {}) {
  const s = await signIn(k);
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on("pageerror", e => log(k, "pageerror", e.message.slice(0, 200)));
  page.on("console", m => { if (m.type() === "error" && !/Failed to load resource|favicon/i.test(m.text())) log(k, "console", m.text().slice(0, 200)); });
  const frames = [], closes = [];
  page.on("websocket", ws => {
    if (!/fly\.dev/.test(ws.url())) return;
    log(k, "socket", ws.url().replace(/\?.*$/, ""));
    ws.on("framereceived", f => frames.push({ t: Date.now(), p: typeof f.payload === "string" ? Buffer.from(f.payload) : f.payload }));
    ws.on("close", () => { closes.push(Date.now()); log(k, "socket closed"); });
  });
  await page.goto(`${PREVIEW}/api/weather?_vercel_share=${process.env.SHARE}`, { waitUntil: "domcontentloaded" });
  await ctx.addCookies(s.cookies);
  return { k, uid: s.uid, ctx, page, frames, closes, name: WHO[k].world };
}
/** Same-origin JSON from the page (its cookies). */
const api = (p, path, method = "GET", body) => p.page.evaluate(async ([path, method, body]) => {
  const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  let json = null; try { json = await r.json(); } catch {}
  return { status: r.status, json };
}, [path, method, body]);
const shot = async (p, name) => { const f = `${OUT}/${name}.png`; await p.page.screenshot({ path: f }); log("shot", name); };
/** A frame received after `since` carrying `text` (a clip name, a world name, a chat line). */
const heard = (p, text, since) => p.frames.some(f => f.t >= since && f.p.includes(Buffer.from(text)));
async function waitHeard(p, text, since, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (heard(p, text, since)) return Date.now(); await p.page.waitForTimeout(100); }
  return null;
}
/** Is a leaf with exactly this text drawn on the page? `overlay`: only in the world's aria-hidden overlays (name tags and
 * speech bubbles), never the chat log or a sheet. */
const tagShown = (p, text, overlay = true) => p.page.evaluate(([t, overlay]) => [...document.querySelectorAll("div, span, p")].some(el => el.childElementCount === 0
  && el.textContent?.trim() === t && (!overlay || el.closest('[aria-hidden="true"]')) && !el.closest("[hidden]")
  && getComputedStyle(el).visibility !== "hidden" && el.getBoundingClientRect().width > 0), [text, overlay]);
const textShown = (p, text) => p.page.evaluate(t => document.body.innerText.includes(t), text);
async function waitFor(p, fn, ms = 20000, gap = 250) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await fn()) return true; await p.page.waitForTimeout(gap); }
  return false;
}
const focusWorld = p => p.page.getByRole("application", { name: "Island walking area" }).focus();
/** Enter opens the chat bar, Enter sends (and closes it). */
async function say(p, text) {
  await closeSheets(p);
  await focusWorld(p);
  await p.page.keyboard.press("Enter");
  await p.page.waitForSelector("[data-chat-open] input", { timeout: 10000 });
  for (const ch of text) { await p.page.keyboard.type(ch); await p.page.waitForTimeout(30); }
  await p.page.keyboard.press("Enter");
  await p.page.waitForTimeout(300);
}
/** Back to the game: Escape until no sheet, dialog or menu dock is up (Esc 1 is the dock, Esc 2 the system menu). */
async function closeSheets(p) {
  for (let i = 0; i < 5; i++) {
    const up = await p.page.evaluate(() => !!document.querySelector('[data-testid=menu-dock], [role="dialog"], [role="alertdialog"], [role=menu][aria-label="Emote wheel"]'));
    if (!up) return;
    await p.page.keyboard.press("Escape");
    await p.page.waitForTimeout(250);
  }
}
/** Esc 1, the menu dock (with nothing else up). */
async function openDock(p) {
  await closeSheets(p);
  await focusWorld(p);
  await p.page.keyboard.press("Escape");
  await p.page.waitForSelector("[data-testid=menu-dock]", { timeout: 5000 });
}
/** The dock's people entry ("Here (2)"), or null. */
async function peopleLabel(p) {
  await openDock(p);
  const label = await p.page.locator("[data-testid=menu-dock] button", { hasText: /^Here/ }).first().textContent({ timeout: 2000 }).catch(() => null);
  await closeSheets(p);
  return label;
}
async function openFriends(p) {
  await openDock(p);
  await p.page.locator("[data-testid=menu-dock] button", { hasText: /^Friends/ }).first().click();
  await p.page.waitForTimeout(500);
}
/** The emote wheel: hold G (the ring opens after a beat), click the middle to flip to the dances, click the petal, let go. */
async function emote(p, name, dance = false) {
  await closeSheets(p);
  await focusWorld(p);
  await p.page.keyboard.down("g");
  try {
    await p.page.waitForSelector("[role=menu][aria-label='Emote wheel'][data-shown]", { timeout: 5000 });
    if (dance) {
      const flip = p.page.getByRole("menuitem", { name: "Show the dances" });
      if (await flip.count()) { await flip.click(); await p.page.waitForTimeout(250); }
    }
    await p.page.getByRole("menuitem", { name, exact: true }).click();
  } finally {
    await p.page.keyboard.up("g");
  }
}

/** Into the island: look saved (no creator), world name set, then the arrival (UI for `arrivalUi`, else the route). */
async function enter(p, { arrivalUi = false } = {}) {
  await p.page.evaluate(([look, day]) => {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.welcomed.v1", "1");
    localStorage.setItem("tsi.gift.later", day);
    localStorage.setItem("tsi.camera.v1", JSON.stringify({ yaw: 0, pitch: 0.55, zoom: 1, sensitivity: 1, invertY: false, mouseLook: false, autoFollow: false }));
  }, [JSON.stringify(LOOKS[p.k] ?? LOOKS.a), today()]);
  const name = await api(p, "/api/identity/name", "POST", { name: p.name });
  log(p.k, "name", name.status, JSON.stringify(name.json).slice(0, 160));
  const arrival = await api(p, "/api/world/arrival");
  log(p.k, "arrival GET", arrival.status, JSON.stringify(arrival.json).slice(0, 160));
  if (!arrivalUi && arrival.json && arrival.json.arrived === false) {
    const done = await api(p, "/api/world/arrival", "POST");
    log(p.k, "arrival POST", done.status);
  }
  await p.page.goto(`${PREVIEW}/student/dashboard`, { waitUntil: "domcontentloaded" });
  await p.page.waitForSelector("canvas", { timeout: 300000 });
  if (arrivalUi) {
    const creator = await p.page.waitForSelector("[data-testid=reflection-yes]", { timeout: 180000 }).catch(() => null);
    record(`${p.k}: arrival creator shows`, !!creator);
    if (creator) {
      await p.page.waitForTimeout(1500);
      await shot(p, `${p.k}-arrival-creator`);
      await creator.click({ force: true });
      // Skip the skippable beats (aboard, clearing, crossing) until Bram's walk-along offers its way out.
      const end = Date.now() + 240000;
      let leave = null;
      while (Date.now() < end && !leave) {
        leave = await p.page.$("[data-testid=arrival-leave-tour]");
        if (!leave) { await p.page.keyboard.press("Space"); await p.page.waitForTimeout(1500); }
      }
      record(`${p.k}: arrival reaches Bram's walk-along`, !!leave);
      if (leave) { await shot(p, `${p.k}-arrival-tutorial`); await leave.click({ force: true }); }
    }
  }
  await p.page.waitForFunction(() => !document.querySelector('[role="status"]')?.textContent?.includes("Preparing"), null, { timeout: 300000 }).catch(() => log(p.k, "still preparing"));
  await p.page.waitForSelector('[role="application"][aria-label="Island walking area"]', { timeout: 120000 });
  await p.page.waitForTimeout(3000);
}

/** Where you stand (world x, z), from the minimap's dot (production has no dev hooks). The village plot is mirrored
 * (DefaultIslandMap: +x drawn left) and draws z negated, so the dot is (-x, -z). */
const where = p => p.page.evaluate(() => {
  const dot = document.querySelector('[aria-label="Minimap"] circle[fill="#FFDD57"]');
  return dot ? { x: -Number(dot.getAttribute("cx")), z: -Number(dot.getAttribute("cy")) } : null;
});

// ── Phases ──────────────────────────────────────────────────────────
async function day() {
  browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
  try {
    const A = await player("a"), B = await player("b");
    await enter(A);
    await enter(B);
    await shot(A, "01-a-in-island");

    // 1. Both see each other, with name tags.
    const met = await waitFor(A, async () => (await tagShown(A, B.name)) && (await tagShown(B, A.name)), 90000, 500);
    record("tags: each sees the other's name tag", met, met ? "" : `A sees B: ${await tagShown(A, B.name)}, B sees A: ${await tagShown(B, A.name)}`);
    const people = await peopleLabel(A);
    record("presence: A's menu says Here (2)", /Here \(2\)/.test(people ?? ""), people ?? "no entry");
    await shot(A, "02-a-sees-b-tag");
    await shot(B, "03-b-sees-a-tag");

    // 2. Chat both ways, with bubbles.
    let since = Date.now();
    await say(A, "hi birch, the pier is nice");
    const aLine = await waitFor(B, () => textShown(B, "hi birch, the pier is nice"), 8000, 150);
    const aBubble = await tagShown(B, "hi birch, the pier is nice");
    record("chat: A's line reaches B", aLine, `${Date.now() - since} ms`);
    record("chat: A's bubble over A on B's screen", aBubble);
    await shot(B, "04-b-sees-a-line-bubble");
    since = Date.now();
    await say(B, "hey alder! want to fish");
    const bLine = await waitFor(A, () => textShown(A, "hey alder! want to fish"), 8000, 150);
    record("chat: B's line reaches A", bLine, `${Date.now() - since} ms`);
    record("chat: B's bubble over B on A's screen", await tagShown(A, "hey alder! want to fish"));
    await shot(A, "05-a-sees-b-line-bubble");

    // 3. A friend code: B's code, A asks by it, B accepts; both lists follow live (the /internal/friend notice).
    await openFriends(B);
    await B.page.getByRole("tab", { name: "Add" }).click();
    await B.page.waitForFunction(() => /^[2-9A-Z]{4}-[2-9A-Z]{4}$/.test(document.querySelector("[data-testid=friend-code]")?.textContent ?? ""), null, { timeout: 20000 });
    const code = await B.page.textContent("[data-testid=friend-code]");
    await shot(B, "06-b-friend-code");
    await closeSheets(B);
    await openFriends(A);
    await A.page.getByRole("tab", { name: "Add" }).click();
    await A.page.fill("#friend-code-input", code.toLowerCase());
    const asked = A.page.waitForResponse(r => r.url().includes("/api/world/friends") && r.request().method() === "POST", { timeout: 15000 });
    await A.page.getByRole("button", { name: "Send request" }).click();
    const askedJson = await (await asked).json().catch(() => null);
    record("friends: A asks by B's code", askedJson?.ok === true, JSON.stringify({ status: askedJson?.status }));
    await shot(A, "07-a-request-sent");
    await closeSheets(A);
    await openFriends(B);
    await B.page.getByRole("tab", { name: /Requests/ }).click();
    await B.page.getByRole("button", { name: "Accept" }).waitFor({ timeout: 20000 });
    const accepted = B.page.waitForResponse(r => r.url().includes("/api/world/friends") && ["PATCH", "POST"].includes(r.request().method()), { timeout: 15000 });
    await B.page.getByRole("button", { name: "Accept" }).click();
    const acceptedJson = await (await accepted).json().catch(() => null);
    record("friends: B accepts", acceptedJson?.status === "friends", `realtime: ${acceptedJson?.realtime}`);
    record("moderation env: /internal/friend applied (Vercel and Fly secrets match)", acceptedJson?.realtime === "applied", `realtime: ${acceptedJson?.realtime}`);
    await closeSheets(B);
    // Same shard (two accounts can't fill one): the friend shows as Here, with no Join; the heart tag shows at once.
    await A.page.waitForTimeout(1200);
    await openFriends(A);
    await A.page.getByRole("tab", { name: "Friends" }).click().catch(() => {});
    const here = await waitFor(A, () => tagShown(A, "Here", false), 10000);
    record("join: B listed as Here in A's friends (same shard; cross-shard Join is the local bench's)", here);
    await shot(A, "08-a-friends-here");
    await closeSheets(A);

    // 4. Emotes: A waves, B's socket carries it.
    since = Date.now();
    await emote(A, "Wave");
    const waved = await waitHeard(B, "Wave", since);
    record("emotes: A's wave reaches B", !!waved, waved ? `${waved - since} ms` : "");
    await B.page.waitForTimeout(300);
    await shot(B, "09-b-sees-a-wave");

    // 5. Dance sync: A and B dance side by side (different dances, one beat).
    since = Date.now();
    await emote(A, "Happy bounce", true);
    await emote(B, "Sway", true);
    const aDance = await waitHeard(B, "DanceBounce", since), bDance = await waitHeard(A, "DanceSway", since);
    record("dance: A's dance reaches B", !!aDance);
    record("dance: B's dance reaches A", !!bDance);
    await A.page.waitForTimeout(1500);
    await Promise.all([shot(A, "10-a-dancing-together"), shot(B, "11-b-dancing-together")]);
    for (const p of [A, B]) { await focusWorld(p); await p.page.keyboard.down("s"); await p.page.waitForTimeout(150); await p.page.keyboard.up("s"); }

    // 6. Report then a live mute: B reports A's line; M (tier 2 for this step) mutes A from the queue; A's next line is
    // refused at once (not the 60 s poll), and B never gets it. Then M unmutes and A's line goes through again.
    await focusWorld(B);
    await B.page.keyboard.press("Enter");
    await B.page.waitForSelector("[data-chat-open]", { timeout: 10000 });
    await B.page.getByRole("button", { name: `${A.name}: open their card` }).first().click();
    await B.page.waitForSelector("[data-testid=player-card]", { timeout: 10000 });
    await B.page.getByRole("button", { name: /^Report/ }).click();
    await B.page.getByRole("radiogroup", { name: "Reason" }).getByRole("radio").first().click();
    await shot(B, "12-b-report-reasons");
    const reported = B.page.waitForResponse(r => r.url().includes("/api/world/report"), { timeout: 15000 });
    await B.page.getByRole("button", { name: "Send report" }).click();
    const reportRes = await reported;
    const reportJson = await reportRes.json().catch(() => null);
    record("report: B reports A's line", reportRes.status() === 200 && reportJson?.ok === true, `HTTP ${reportRes.status()}`);
    await closeSheets(B);

    if (!uuid.test(ids.m.id)) throw new Error("bad M id");
    await sql(`update profiles set tier = 2 where id = '${ids.m.id}'`, { write: true });
    mRaised = true;
    let M;
    try {
      M = await player("m", { size: { width: 900, height: 600 } });
      const queue = await api(M, "/api/admin/moderation");
      const item = (queue.json?.world ?? []).find(w => w.target?.id === A.uid);
      record("moderation: the report is in the T1/T2 queue (World chat)", queue.status === 200 && !!item, `HTTP ${queue.status}`);
      if (item) {
        ids.report_ids = [...new Set([...(ids.report_ids ?? []), item.id])]; saveIds();
        const acted = await api(M, "/api/admin/moderation", "POST", { kind: "world", id: item.id, action: "remove_mute" });
        const muteAt = Date.now();
        record("moderation: remove and mute 7 d", acted.status === 200, `HTTP ${acted.status}`);
        record("moderation env: /internal/sanction applied", acted.json?.moderation?.realtime === "applied", `realtime: ${acted.json?.moderation?.realtime}`);
        await say(A, "still here after the mute");
        const refused = await waitFor(A, () => textShown(A, "You can't chat"), 5000, 100);
        record("live mute: A's next line is refused at once", refused, `${Date.now() - muteAt} ms after the mute`);
        await shot(A, "13-a-muted-refused");
        await B.page.waitForTimeout(2500);
        record("live mute: B never receives the muted line", !(await textShown(B, "still here after the mute")));
        const un = await api(M, "/api/identity/moderate", "POST", { member_id: A.uid, action: "unmute" });
        record("moderation: unmute", un.status === 200, `HTTP ${un.status}, realtime: ${un.json?.realtime ?? un.json?.moderation?.realtime}`);
        await A.page.waitForTimeout(2000);
        await say(A, "back again, thanks");
        const back = await waitFor(B, () => textShown(B, "back again, thanks"), 8000, 150);
        record("live unmute: A's line reaches B again", back);
        await shot(B, "14-b-sees-a-after-unmute");
      }
    } finally {
      await sql(`update profiles set tier = 5 where id = '${ids.m.id}'`, { write: true });
      mRaised = false;
      const t = await sql(`select tier from profiles where id = '${ids.m.id}'`);
      log("M tier back to", JSON.stringify(t));
      if (M) await M.ctx.close();
    }
    await flow4(A);
    await Promise.all([A.ctx.close(), B.ctx.close()]);
  } finally {
    await browser.close();
    writeFileSync(`${OUT}/results-${PHASE}.txt`, JSON.stringify({ at: new Date().toISOString(), preview: HOST, results }, null, 2));
    const fails = results.filter(r => !r.ok).length;
    log(`done: ${results.length - fails} pass, ${fails} fail`);
  }
}

/**
 * Smoke flow 4 for v1 (specs/launch-runbook.md §6): the arrival paid Bram's coins once; then chapter 1 without the
 * plot (drop 4): a catch (cast and land at the wharf, the starter rod), donate, report to Wren: 100 coins once and the
 * chapter letter. Through the routes the island calls, as A.
 */
async function flow4(A) {
  const uid = A.uid;
  const ledger = () => sql(`select source, ref, amount, idempotency_key from wallet_ledger where member_id = '${uid}' order by created_at`);
  const before = await ledger();
  record("flow 4: the arrival paid Bram's coins once", before.filter(r => /arriv/i.test(`${r.ref} ${r.idempotency_key}`)).length === 1, JSON.stringify(before.map(r => [r.source, r.ref, r.amount])));
  // The river mouth by the wharf always bites with a fish (the sea also gives sea stars and the like, which aren't fish).
  for (let i = 0; i < 3; i++) {
    const cast = await api(A, "/api/collections", "POST", { action: "cast", site: "village", at: [8, -19.5], power: 0.6, tool: "rod_flimsy" });
    record(`flow 4: cast at the wharf with the starter rod (${i + 1})`, cast.status === 200 && !!cast.json?.catch?.roll, `HTTP ${cast.status} ${cast.json?.catch?.item_key ?? JSON.stringify(cast.json).slice(0, 120)}`);
    if (!cast.json?.catch?.roll) break;
    await A.page.waitForTimeout(2500);
    const land = await api(A, "/api/collections", "POST", { action: "land", roll: cast.json.catch.roll });
    record(`flow 4: land it (${i + 1})`, land.status === 200, `HTTP ${land.status} ${land.json?.catch?.item_key ?? ""}`);
    if (String(land.json?.catch?.item_key ?? "").startsWith("fish_")) break;
  }
  const donate = await api(A, "/api/progression/chapters/advance", "POST", { chapter_slug: "settle-in", action: "donate_catch" });
  record("flow 4: donate the catch (chapter step)", donate.status === 200, `HTTP ${donate.status} ${donate.json?.error ?? ""}`);
  const report = await api(A, "/api/progression/chapters/advance", "POST", { chapter_slug: "settle-in", action: "report_hq" });
  record("flow 4: report to Wren (no plot step in v1)", report.status === 200, `HTTP ${report.status} ${report.json?.error ?? ""}`);
  const again = await api(A, "/api/progression/chapters/advance", "POST", { chapter_slug: "settle-in", action: "report_hq" });
  record("flow 4: a second report is refused", again.status === 409, `HTTP ${again.status}`);
  const after = await ledger();
  const settle = after.filter(r => r.source === "chapter" && r.ref === "settle-in");
  record("flow 4: 100 coins once (chapter:settle-in)", settle.length === 1 && Number(settle[0].amount) === 100, JSON.stringify(settle.map(r => [r.source, r.ref, r.amount])));
  const letters = await sql(`select count(*)::int as n from letters where recipient_id = '${uid}'`);
  record("flow 4: the chapter letter is in the mailbox", letters[0]?.n >= 1, `letters: ${letters[0]?.n}`);
}

// The campfire (lib/game/campfire.ts): lit at real night; A and B walk to it (steered by the minimap's dot), dance, and
// the dance near the fire turns into the stomp dance, which each one's socket carries from the other.
const FIRE = { x: -5.71, z: -16.15 };
async function walkTo(p, target, within = 2.5, ms = 90000) {
  // Calibrate W and D from the dot (the camera stays put: autoFollow off, yaw 0).
  const at = () => where(p);
  const nudge = async key => { const a = await at(); await p.page.keyboard.down(key); await p.page.waitForTimeout(450); await p.page.keyboard.up(key); await p.page.waitForTimeout(350); const b = await at(); return a && b ? { x: b.x - a.x, z: b.z - a.z } : null; };
  await focusWorld(p);
  const w = await nudge("w"), d = await nudge("d");
  const dirs = { w, d, s: w && { x: -w.x, z: -w.z }, a: d && { x: -d.x, z: -d.z } };
  log(p.k, "calibrated", JSON.stringify(dirs));
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const here = await at();
    if (!here) break;
    const dx = target.x - here.x, dz = target.z - here.z, dist = Math.hypot(dx, dz);
    if (dist <= within) return { ok: true, here, dist };
    const keys = Object.entries(dirs).filter(([, v]) => v).map(([k, v]) => [k, (v.x * dx + v.z * dz) / (Math.hypot(v.x, v.z) * dist || 1)]).sort((a, b) => b[1] - a[1]);
    const pick = keys.filter(([, c]) => c > 0.35).slice(0, 2).map(([k]) => k);
    for (const k of pick) await p.page.keyboard.down(k);
    await p.page.waitForTimeout(Math.min(600, 120 + dist * 60));
    for (const k of pick) await p.page.keyboard.up(k);
  }
  const here = await at();
  return { ok: false, here, dist: here ? Math.hypot(target.x - here.x, target.z - here.z) : null };
}

async function night() {
  browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
  try {
    const A = await player("a"), B = await player("b");
    await enter(A); await enter(B);
    const met = await waitFor(A, async () => (await tagShown(A, B.name)) && (await tagShown(B, A.name)), 90000, 500);
    record("night: both in the island and in view", met);
    record("night: no join refused or dropped (sockets closed before play)", A.closes.length + B.closes.length === 0, `A ${A.closes.length}, B ${B.closes.length}`);
    const light = await Promise.all([A, B].map(p => p.page.evaluate(() => document.querySelector("main[data-light]")?.getAttribute("data-light"))));
    record("night: both islands are in the night phase (the fire is lit)", light.every(l => l === "night"), light.join(", "));
    const [wa, wb] = await Promise.all([walkTo(A, { x: FIRE.x + 2.6, z: FIRE.z }), walkTo(B, { x: FIRE.x - 2.6, z: FIRE.z })]);
    record("campfire: A walks to the fire", wa.ok, JSON.stringify(wa));
    record("campfire: B walks to the fire", wb.ok, JSON.stringify(wb));
    await Promise.all([shot(A, "20-a-at-fire"), shot(B, "21-b-at-fire")]);
    const since = Date.now();
    await emote(A, "Happy bounce", true);
    await emote(B, "Happy bounce", true);
    const aStomp = await waitHeard(B, "DanceStomp", since, 10000), bStomp = await waitHeard(A, "DanceStomp", since, 10000);
    record("campfire: A's dance by the fire turns to the stomp, B sees it", !!aStomp);
    record("campfire: B's dance by the fire turns to the stomp, A sees it", !!bStomp);
    await A.page.waitForTimeout(2500);
    await Promise.all([shot(A, "22-a-fire-two-dancers"), shot(B, "23-b-fire-two-dancers")]);
    await A.page.waitForTimeout(4000);
    await Promise.all([shot(A, "24-a-fire-ring-turned"), shot(B, "25-b-fire-ring-turned")]);
    for (const p of [A, B]) { await focusWorld(p); await p.page.keyboard.down("s"); await p.page.waitForTimeout(150); await p.page.keyboard.up("s"); }
    await nightModeration(A, B);
    await Promise.all([A.ctx.close(), B.ctx.close()]);
  } finally {
    await browser.close();
    writeFileSync(`${OUT}/results-${PHASE}.txt`, JSON.stringify({ at: new Date().toISOString(), preview: HOST, results }, null, 2));
    const fails = results.filter(r => !r.ok).length;
    log(`done: ${results.length - fails} pass, ${fails} fail`);
  }
}

/**
 * The moderation steps again on realtime v5 (the coordinator, Oct 22 evening): A says a line, B reports it, M removes
 * and mutes from the queue, A's next line is refused at once and never reaches B, M unmutes. Then a block: B blocks A
 * from A's card, and A's new lines don't reach B (nor B's reach A).
 */
async function nightModeration(A, B) {
  let since = Date.now();
  await say(A, "evening birch, nice fire");
  record("night chat: A's line reaches B", await waitFor(B, () => textShown(B, "evening birch, nice fire"), 8000, 150), `${Date.now() - since} ms`);
  await closeSheets(B);
  await focusWorld(B);
  await B.page.keyboard.press("Enter");
  await B.page.waitForSelector("[data-chat-open]", { timeout: 10000 });
  await B.page.getByRole("button", { name: `${A.name}: open their card` }).last().click();
  await B.page.waitForSelector("[data-testid=player-card]", { timeout: 10000 });
  await B.page.getByRole("button", { name: /^Report/ }).click();
  await B.page.getByRole("radiogroup", { name: "Reason" }).getByRole("radio").first().click();
  const reported = B.page.waitForResponse(r => r.url().includes("/api/world/report"), { timeout: 15000 });
  await B.page.getByRole("button", { name: "Send report" }).click();
  const reportRes = await reported;
  record("night report: B reports A's line", reportRes.status() === 200, `HTTP ${reportRes.status()}`);
  await closeSheets(B);

  if (!uuid.test(ids.m.id)) throw new Error("bad M id");
  await sql(`update profiles set tier = 2 where id = '${ids.m.id}'`, { write: true });
  mRaised = true;
  let M;
  try {
    M = await player("m", { size: { width: 900, height: 600 } });
    const queue = await api(M, "/api/admin/moderation");
    const item = (queue.json?.world ?? []).find(w => w.target?.id === A.uid);
    record("night moderation: the report is in the queue", queue.status === 200 && !!item, `HTTP ${queue.status}`);
    if (item) {
      const acted = await api(M, "/api/admin/moderation", "POST", { kind: "world", id: item.id, action: "remove_mute" });
      const muteAt = Date.now();
      record("night moderation: remove and mute", acted.status === 200, `HTTP ${acted.status}, realtime: ${acted.json?.moderation?.realtime}`);
      record("night moderation env: /internal/sanction applied (realtime v5)", acted.json?.moderation?.realtime === "applied");
      const muted = await sql(`select muted_until is not null and muted_until > now() as muted from member_identity where member_id = '${A.uid}'`);
      record("night moderation: A muted in the database (F4: mute before the report closes)", muted[0]?.muted === true);
      await say(A, "can anyone hear me");
      record("night live mute: A's next line is refused at once", await waitFor(A, () => textShown(A, "You can't chat"), 5000, 100), `${Date.now() - muteAt} ms after the mute`);
      await shot(A, "26-a-muted-refused-night");
      await B.page.waitForTimeout(2500);
      record("night live mute: B never receives the muted line", !(await textShown(B, "can anyone hear me")));
      const un = await api(M, "/api/identity/moderate", "POST", { member_id: A.uid, action: "unmute" });
      record("night moderation: unmute", un.status === 200, `HTTP ${un.status}, realtime: ${un.json?.realtime ?? un.json?.moderation?.realtime}`);
      await A.page.waitForTimeout(2000);
      since = Date.now();
      await say(A, "back by the fire");
      record("night live unmute: A's line reaches B again", await waitFor(B, () => textShown(B, "back by the fire"), 8000, 150), `${Date.now() - since} ms`);
    }
  } finally {
    await sql(`update profiles set tier = 5 where id = '${ids.m.id}'`, { write: true });
    mRaised = false;
    log("M tier back to", JSON.stringify(await sql(`select tier from profiles where id = '${ids.m.id}'`)));
    if (M) await M.ctx.close();
  }

  // The block: from A's card on B's screen.
  await closeSheets(B);
  await focusWorld(B);
  await B.page.keyboard.press("Enter");
  await B.page.waitForSelector("[data-chat-open]", { timeout: 10000 });
  await B.page.getByRole("button", { name: `${A.name}: open their card` }).last().click();
  await B.page.waitForSelector("[data-testid=player-card]", { timeout: 10000 });
  await B.page.getByRole("button", { name: /^Block/ }).first().click();
  const blocked = B.page.waitForResponse(r => r.url().includes("/api/world/blocks") && r.request().method() === "POST", { timeout: 15000 });
  await B.page.getByRole("button", { name: "Block", exact: true }).last().click();
  const blockRes = await blocked;
  const blockJson = await blockRes.json().catch(() => null);
  record("block: B blocks A", blockRes.status() === 200, `HTTP ${blockRes.status()}, realtime: ${blockJson?.realtime}`);
  record("block env: /internal/block applied", blockJson?.realtime === "applied");
  await closeSheets(B);
  await A.page.waitForTimeout(1500);
  await say(A, "are you still there birch");
  await B.page.waitForTimeout(3000);
  record("block: A's new line doesn't reach B (log or bubble)", !(await textShown(B, "are you still there birch")) && !(await tagShown(B, "are you still there birch")));
  await shot(B, "27-b-after-block");
  await say(B, "quiet evening");
  await A.page.waitForTimeout(3000);
  record("block: B's line doesn't reach A either", !(await textShown(A, "quiet evening")));
  record("block: A's tag still shows for B (the world is shared)", await tagShown(B, A.name));
}

/** Smoke flow 3's routes without a browser: the share cookie from the redirect, A's session cookies, Node's fetch. */
async function routes() {
  const first = await fetch(`${PREVIEW}/api/weather?_vercel_share=${process.env.SHARE}`, { redirect: "manual" });
  const share = (first.headers.getSetCookie?.() ?? []).map(c => c.split(";")[0]).filter(c => c.startsWith("_vercel"));
  const s = await signIn("a");
  const cookie = [...share, ...s.cookies.map(c => `${c.name}=${c.value}`)].join("; ");
  for (const path of ["/api/progression/state", "/api/economy/wallet", "/api/world/arrival", "/api/world/friends", "/api/profile"]) {
    const r = await fetch(PREVIEW + path, { headers: { cookie } });
    record(`flow 3: GET ${path}`, r.status === 200, `HTTP ${r.status}`);
  }
  const dash = await fetch(`${PREVIEW}/student/dashboard`, { headers: { cookie }, redirect: "manual" });
  record("flow 3: /student/dashboard serves the island (no opening-soon, no sign-in redirect)", dash.status === 200, `HTTP ${dash.status} ${dash.headers.get("location") ?? ""}`);
  writeFileSync(`${OUT}/results-${PHASE}.txt`, JSON.stringify({ at: new Date().toISOString(), preview: HOST, results }, null, 2));
}

/** Flow 3's first login: A plays the arrival through the page (the reflection, the skips, Bram's walk-along, its way out). */
async function arrival() {
  browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
  try {
    const A = await player("a");
    await enter(A, { arrivalUi: true });
    const r = await api(A, "/api/world/arrival");
    record("flow 3: the arrival is recorded (arrived)", r.json?.arrived === true, JSON.stringify(r.json));
    const people = await peopleLabel(A);
    record("flow 3: the realtime join (the menu's Here entry)", /Here \(\d+\)/.test(people ?? ""), people ?? "no entry");
    await shot(A, "00-a-after-arrival");
    await A.ctx.close();
  } finally {
    await browser.close();
    writeFileSync(`${OUT}/results-${PHASE}.txt`, JSON.stringify({ at: new Date().toISOString(), preview: HOST, results }, null, 2));
  }
}

// M is tier 2 only for the moderation step: a stopped run puts it back.
let mRaised = false;
process.on("SIGTERM", async () => { if (mRaised) await sql(`update profiles set tier = 5 where id = '${ids.m.id}'`, { write: true }).catch(() => {}); process.exit(143); });

if (PHASE === "setup") await setup();
else if (PHASE === "arrival") await arrival();
else if (PHASE === "diag") {
  // Why joins fail: the page's own WebSocket close codes and the HUD's status line while A tries to join for a minute.
  browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
  try {
    const A = await player("a");
    await A.ctx.addInitScript(() => {
      const Native = window.WebSocket;
      window.__wsLog = [];
      window.WebSocket = class extends Native {
        constructor(...a) { super(...a); const t0 = Date.now(); window.__wsLog.push({ open: t0 }); this.addEventListener("close", e => window.__wsLog.push({ close: e.code, reason: e.reason, after: Date.now() - t0 })); }
      };
    });
    await A.page.goto(`${PREVIEW}/student/dashboard`, { waitUntil: "domcontentloaded" });
    const end = Date.now() + 75000;
    let lastStatus = "";
    while (Date.now() < end) {
      const st = await A.page.evaluate(() => document.querySelector('[role="status"]')?.textContent ?? "").catch(() => "");
      if (st !== lastStatus) { log("status:", st.slice(0, 80)); lastStatus = st; }
      await A.page.waitForTimeout(1000);
    }
    log("ws log", JSON.stringify(await A.page.evaluate(() => window.__wsLog)));
    await A.ctx.close();
  } finally { await browser.close(); }
}
else if (PHASE === "flow4") {
  browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
  try { const A = await player("a"); await flow4(A); await A.ctx.close(); }
  finally { await browser.close(); writeFileSync(`${OUT}/results-${PHASE}.txt`, JSON.stringify({ at: new Date().toISOString(), preview: HOST, results }, null, 2)); }
}
else if (PHASE === "routes") await routes();
else if (PHASE === "day") await day();
else if (PHASE === "night") await night();
else throw new Error("phase: setup | day | night");
