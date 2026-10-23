// realtime-joins: join reliability on a Preview against prod Fly (tethos-rt) and prod Supabase (specs/lanes/realtime-joins.md).
// Two throwaway accounts take turns joining from a fresh headless browser context each time; each account joins every
// 65 s (past the server's 60 s card cache, so every join reads card, blocks and friends). Adapted from
// specs/evidence/launch-v1/two-account.mjs (same sign-in, share link and look). Run under the shared browser lock.
//
//   node joins.mjs setup      create the two accounts (ids to $IDS), set their world names and arrival (once)
//   node joins.mjs run        N joins (default 20), results to $OUT/results-joins.json (kept in the repo as results-joins.txt)
//   K=a node joins.mjs one    one join for account K (the cold joins after a 10 minute idle), appended to $OUT/results-cold.json
//
// A join is timed from the matchmake POST to the room's JOIN_ROOM frame. A socket that closes before JOIN_ROOM is a
// refusal (4107 busy and friends). Pass: no refusals and every join under 5 s.
// Env: PREVIEW, SHARE (the `_vercel_share` token), IDS (scratch JSON outside the repo), OUT, N.
// Secrets: the service key comes from web/.env.local into memory only; passwords are random per run, never printed.
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const WEB = new URL("../../../web/", import.meta.url).pathname;
const { createServerClient } = createRequire(WEB + "package.json")("@supabase/ssr");
const { chromium } = createRequire("/opt/homebrew/lib/node_modules/")("playwright");

const PREVIEW = (process.env.PREVIEW ?? "").replace(/\/+$/, "");
const HOST = PREVIEW.replace(/^https:\/\//, "");
const IDS = process.env.IDS;
const OUT = process.env.OUT ?? new URL(".", import.meta.url).pathname;
const N = Number(process.env.N ?? 20);
if (!IDS || !PREVIEW) throw new Error("IDS and PREVIEW are required");
mkdirSync(OUT, { recursive: true });

const env = Object.fromEntries(readFileSync(WEB + ".env.local", "utf8").split("\n").filter(l => /^[A-Z_]+=/.test(l))
  .map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"/, "").replace(/"$/, "").replace(/\\n$/, "").trim()]));
const SB_URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SB_URL?.includes("rtbkrngsdbptbjhfbcud") || !ANON || !SERVICE) throw new Error("web/.env.local is missing the prod Supabase values");

const t0 = Date.now();
const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
const ids = existsSync(IDS) ? JSON.parse(readFileSync(IDS, "utf8")) : {};
const admin = (path, init = {}) => fetch(`${SB_URL}/auth/v1/admin/${path}`, { ...init, headers: { apikey: SERVICE, "Content-Type": "application/json", ...(init.headers ?? {}) } });
const password = () => randomBytes(24).toString("base64url");
const WHO = {
  a: { email: "probe-joins-a@launch.tethos.invalid", display: "Joins Probe A", world: "Probe Ash" },
  b: { email: "probe-joins-b@launch.tethos.invalid", display: "Joins Probe B", world: "Probe Beech" },
};
const LOOK = { skin: 3, hair: 2, eyes: "F1.1", mouth: "M1.1", brows: "brow_soft", extras: [], bangs: "bangs_straight", back: "back_bob", top: "top_cardigan", bottom: "bottom_trousers", onepiece: null, shoes: "shoes_sneakers", acc: {}, colors: { top_cardigan: 2 } };

/** A fresh password (memory only), then a session's cookies as @supabase/ssr writes them. */
async function signIn(k) {
  const pw = password();
  const r = await admin(`users/${ids[k].id}`, { method: "PUT", body: JSON.stringify({ password: pw }) });
  if (!r.ok) throw new Error(`password ${k}: HTTP ${r.status}`);
  const jar = new Map();
  const sb = createServerClient(SB_URL, ANON, { cookies: {
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    setAll: list => { for (const c of list) c.value ? jar.set(c.name, c.value) : jar.delete(c.name); },
  } });
  const { error } = await sb.auth.signInWithPassword({ email: ids[k].email, password: pw });
  if (error) throw new Error(`sign-in ${k}: ${error.message}`);
  await new Promise(res => setTimeout(res, 50));
  return [...jar].map(([name, value]) => ({ name, value, domain: HOST, path: "/", sameSite: "Lax", secure: true, httpOnly: false }));
}

/** A fresh context on the Preview with k's session and the saved look (no creator), on the share cookie's page. */
async function context(browser, k, cookies) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await page.goto(`${PREVIEW}/api/weather?_vercel_share=${process.env.SHARE}`, { waitUntil: "domcontentloaded" });
  await ctx.addCookies(cookies);
  await page.evaluate(([look, day]) => {
    localStorage.setItem("tsi.look.v1", look);
    localStorage.setItem("tsi.welcomed.v1", "1");
    localStorage.setItem("tsi.gift.later", day);
  }, [JSON.stringify(LOOK), new Date().toISOString().slice(0, 10)]);
  return { ctx, page };
}

async function setup() {
  for (const [k, w] of Object.entries(WHO)) {
    if (ids[k]?.id) { log("exists", k); continue; }
    const r = await admin("users", { method: "POST", body: JSON.stringify({ email: w.email, password: password(), email_confirm: true, user_metadata: { display_name: w.display } }) });
    const j = await r.json();
    if (!j.id) throw new Error(`create ${k}: HTTP ${r.status}`);
    ids[k] = { id: j.id, email: w.email, created: new Date().toISOString() };
    writeFileSync(IDS, JSON.stringify(ids, null, 2));
    log("created", k, j.id.slice(0, 8));
  }
  const browser = await chromium.launch({ headless: true, args: ["--mute-audio"] });
  try {
    for (const k of ["a", "b"]) {
      const { ctx, page } = await context(browser, k, await signIn(k));
      const call = (path, method, body) => page.evaluate(async ([path, method, body]) => {
        const r = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
        return r.status;
      }, [path, method, body]);
      log(k, "name", await call("/api/identity/name", "POST", { name: WHO[k].world }), "arrival", await call("/api/world/arrival", "POST"));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}

/** One cold join: fresh context, the dashboard, until JOIN_ROOM (or 60 s). */
async function join(browser, k, cookies) {
  const { ctx, page } = await context(browser, k, cookies);
  const j = { k, at: new Date().toISOString(), matchmakes: 0, sockets: 0, refused: 0, joinMs: null };
  let firstPost = null;
  let joined = null;
  page.on("request", req => {
    if (/fly\.dev\/matchmake\//.test(req.url()) && req.method() === "POST") { j.matchmakes++; firstPost ??= Date.now(); }
  });
  page.on("websocket", ws => {
    if (!/fly\.dev/.test(ws.url())) return;
    j.sockets++;
    let mine = false;
    ws.on("framereceived", f => {
      const b = typeof f.payload === "string" ? Buffer.from(f.payload) : f.payload;
      if (!mine && b.length && (b[0] & 0x1f) === 10) { mine = true; joined ??= Date.now(); }
    });
    ws.on("close", () => { if (!mine) j.refused++; });
  });
  const nav = Date.now();
  await page.goto(`${PREVIEW}/student/dashboard`, { waitUntil: "domcontentloaded" });
  const end = Date.now() + 60_000;
  while (!joined && Date.now() < end) await page.waitForTimeout(100);
  j.joinMs = joined && firstPost ? joined - firstPost : null;
  j.pageToJoinMs = joined ? joined - nav : null;
  await ctx.close();
  return j;
}

async function run() {
  const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
  const joins = [];
  try {
    const cookies = { a: await signIn("a"), b: await signIn("b") };
    const start = Date.now();
    // A at 0, 65, 130 s...; B at 32.5, 97.5 s...: one join about every 32 s, each account's 65 s apart.
    await Promise.all(["a", "b"].map(async (k, lane) => {
      for (let i = 0; i < Math.ceil((N - lane) / 2); i++) {
        const due = start + lane * 32_500 + i * 65_000;
        if (Date.now() < due) await new Promise(r => setTimeout(r, due - Date.now()));
        const j = await join(browser, k, cookies[k]);
        joins.push(j);
        log(JSON.stringify(j));
      }
    }));
  } finally {
    await browser.close();
  }
  joins.sort((x, y) => x.at.localeCompare(y.at));
  const times = joins.map(j => j.joinMs).filter(x => x !== null).sort((x, y) => x - y);
  const summary = {
    preview: HOST, joins: joins.length, joined: times.length, refusals: joins.reduce((n, j) => n + j.refused, 0),
    maxMs: times.at(-1) ?? null, medianMs: times[Math.floor(times.length / 2)] ?? null,
    pass: joins.length >= 20 && times.length === joins.length && joins.every(j => j.refused === 0 && j.joinMs < 5000),
  };
  writeFileSync(`${OUT}/results-joins.json`, JSON.stringify({ summary, joins }, null, 1));
  log(JSON.stringify(summary));
}

async function one(k) {
  const browser = await chromium.launch({ headless: true, args: ["--mute-audio", "--use-angle=metal", "--ignore-gpu-blocklist", "--enable-gpu"] });
  try {
    const j = await join(browser, k, await signIn(k));
    const f = `${OUT}/results-cold.json`;
    writeFileSync(f, JSON.stringify([...(existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : []), j], null, 1));
    log(JSON.stringify(j));
  } finally {
    await browser.close();
  }
}

const phase = process.argv[2];
if (phase === "setup") await setup();
else if (phase === "run") await run();
else if (phase === "one") await one(process.env.K ?? "a");
else throw new Error("phase: setup | run | one");
