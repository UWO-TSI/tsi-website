// Hardening E2E on staging through the real Next routes (dev server on :3110,
// env = web/.env.staging.local only), readbacks through the management API.
// usage: node specs/evidence/hardening/flows.mjs [A] [B] [C] [D] [reset-C] > specs/evidence/hardening/flows-run.txt
// (no sections = all four; reset-C puts the member back before chapter 4's level-10 step, a staging fixture)
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
const WEB = new URL("../../../web/", import.meta.url).pathname;
const { createChunks } = createRequire(WEB + "package.json")("@supabase/ssr/dist/main/utils/chunker.js");
const REF = "jjiyeroyralfbluowbjq";
const BASE = "http://localhost:3110";
const env = Object.fromEntries(readFileSync(WEB + ".env.staging.local", "utf8").trim().split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes(REF)) throw new Error("not staging");
let raw = execFileSync("security", ["find-generic-password", "-s", "Supabase CLI", "-w"]).toString().trim().replace(/^go-keyring-base64:/, "");
if (!raw.startsWith("sbp_")) raw = Buffer.from(raw, "base64").toString();
let fails = 0;
const log = (s) => console.log(s);
const check = (ok, what) => { log(`${ok ? "PASS" : "FAIL"}: ${what}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (p) => `${p}-${Date.now().toString(36)}`;

async function sql(q, show = true) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${raw}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error(`sql: ${JSON.stringify(j)}`);
  if (show) {
    log(`SQL> ${q.replace(/\s+/g, " ").trim()}`);
    if (j.length) { log(Object.keys(j[0]).join(" | ")); for (const row of j) log(Object.values(row).map((v) => (v && typeof v === "object" ? JSON.stringify(v) : v)).join(" | ")); } else log("(no rows)");
  }
  return j;
}
async function session(who) {
  const password = execFileSync("security", ["find-generic-password", "-s", `tethos-staging phase1 ${who}`, "-w"]).toString().trim();
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: `phase1-${who}@tethos-staging.test`, password }) });
  const s = await r.json();
  if (!s.access_token) throw new Error(`sign-in ${who}: ${JSON.stringify(s)}`);
  const cookie = createChunks(`sb-${REF}-auth-token`, "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url")).map((c) => `${c.name}=${c.value}`).join("; ");
  return { who, id: s.user.id, cookie, token: s.access_token };
}
async function call(u, method, path, body) {
  const r = await fetch(BASE + path, { method, headers: { Cookie: u.cookie, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  log(`${new Date().toISOString()} ${u.who} ${method} ${path}${body === undefined ? "" : " " + JSON.stringify(body)} -> ${r.status} ${text.slice(0, 300)}`);
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json };
}
/** PostgREST as the member (the anon key + their JWT): what RLS lets them see. */
async function rest(u, path) {
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${path}`, { headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${u.token}` } });
  const text = await r.text();
  log(`${new Date().toISOString()} ${u.who} REST GET /rest/v1/${path} -> ${r.status} ${text.slice(0, 200)}`);
  return { status: r.status, json: JSON.parse(text) };
}
const chapter = (state, slug) => state.chapters.find((c) => c.slug === slug);
const steps = (c) => c.steps.map((s) => `${s.key}:${s.done ? "done" : "open"}`).join(" ");

const RUN = new Set(process.argv.slice(2).length ? process.argv.slice(2) : ["A", "B", "C", "D"]);
const member = await session("member"), staff = await session("staff"), pub = await session("public");
const MEMBER = member.id, STAFF = staff.id, PUBLIC = pub.id;
log(`staging ${REF}; member ${MEMBER}, staff ${STAFF} (T2), public ${PUBLIC}; ${new Date().toISOString()}`);

let r, state, roll = null;
// Village shore points, an inland point and node positions, from the map (lib/game): points.txt (JSON).
const places = JSON.parse(readFileSync(new URL("./points.txt", import.meta.url), "utf8"));

// ─── A. Server-authoritative catches ────────────────────────────────────────
if (RUN.has("A")) {
log("\n=== A. Catches are rolled by the server (member) ===");
r = await call(member, "POST", "/api/collections", { item_key: "fish_golden_koi", size_cm: 95 });
check(r.status === 400, "A1 a client-reported species and size is refused (400)");
r = await call(member, "POST", "/api/collections", { action: "harvest", node: "rock-0", at: [0, 0] });
check(r.status === 422, "A2 a node out of reach is the wrong place (422)");
const node = places.nodes.find((n) => n.id === "rock-1");
r = await call(member, "POST", "/api/collections", { action: "harvest", node: node.id, at: [node.x, node.z], item_key: "rock_gold_nugget" });
const harvested = r.json?.catch?.item_key;
check(r.status === 200 || r.status === 409, `A3 harvest rock-1 from beside it: ${r.status} ${harvested ?? r.json?.error}`);
r = await call(member, "POST", "/api/collections", { action: "harvest", node: node.id, at: [node.x, node.z] });
check(r.status === 409, "A4 the same node again this hour is refused (409)");
r = await call(member, "POST", "/api/collections", { action: "cast", site: "village", at: places.inland, power: 1 });
check(r.status === 422, "A5 a cast with no water in reach is the wrong place (422)");
const shore = places.shore[2];
r = await call(member, "POST", "/api/collections", { action: "cast", site: "village", at: [shore.x, shore.z], power: 1, item_key: "fish_golden_koi" });
roll = r.json?.catch;
check(r.status === 200 && !!roll?.roll && roll.item_key !== "fish_golden_koi", `A6 cast from the ${shore.water} shore: the server rolled ${roll?.item_key} ${roll?.size_cm} cm`);
r = await call(member, "POST", "/api/collections", { action: "land", roll: roll?.roll });
check(r.status === 429, "A7 landing under 3 s after the roll is too fast (429)");
r = await call(member, "POST", "/api/collections", { action: "cast", site: "village", at: [shore.x, shore.z], power: 1 });
check(r.status === 429, "A8 a second cast inside 4 s is too fast (429)");
await sleep(3300);
r = await call(member, "POST", "/api/collections", { action: "land", roll: roll?.roll, item_key: "fish_golden_koi", size_cm: 999 });
check(r.status === 200 && r.json?.catch?.item_key === roll?.item_key, "A9 land after the reel: the rolled species is recorded, not the client's");
r = await call(member, "POST", "/api/collections", { action: "land", roll: roll?.roll });
check(r.status === 409, "A10 landing the same roll again is refused (409)");
r = await call(pub, "POST", "/api/collections", { action: "land", roll: roll?.roll });
check(r.status === 404, "A11 another member can't land it (404)");
await sql(`select node_id, hour_key, item_key, size_cm, landed_at is not null landed from catch_rolls where member_id = '${MEMBER}' order by rolled_at desc limit 3`);
await sql(`select item_key, count, best_size_cm from member_collections where user_id = '${MEMBER}' and item_key in ('${roll?.item_key}', '${harvested ?? "rock_stone"}')`);

}

// ─── B. Chapter 3: Fund the museum ──────────────────────────────────────────
if (RUN.has("B")) {
log("\n=== B. Chapter 3: Fund the museum ===");
state = (await call(member, "GET", "/api/progression/state")).json?.state;
let c3 = chapter(state, "fund-museum");
log(`chapter 3: ${c3.status} · ${steps(c3)}`);
check(c3.status === "active", "B1 chapter 3 is active after chapters 1-2");
r = await call(member, "POST", "/api/progression/chapters/advance", { chapter_slug: "fund-museum", action: "complete" });
check(r.status === 409, "B2 finishing before the museum fund is complete is refused (409)");
r = await call(member, "POST", "/api/progression/chapters/advance", { chapter_slug: "fund-museum", action: "skip" });
check(r.status === 403, "B3 a club-goal chapter can't be skipped (403)");
r = await call(member, "POST", "/api/progression/contribute", { goal_slug: "fund-museum", kind: "coins", amount: 10, idempotency_key: key("hardening-coins") });
check(r.status === 200, "B4 coins delivered to the museum fund");
r = await call(member, "POST", "/api/progression/contribute", { goal_slug: "fund-museum", kind: "specimen", item_key: roll?.item_key, amount: 1, idempotency_key: key("hardening-specimen") });
check(r.status === 200, `B5 the server-rolled ${roll?.item_key} delivered as a specimen`);
state = (await call(member, "GET", "/api/progression/state")).json?.state;
c3 = chapter(state, "fund-museum");
check(c3.steps.find((s) => s.key === "contribute").done, `B6 the contribute step is done (${steps(c3)})`);
const goal = state.goals.find((g) => g.slug === "fund-museum");
log(`fund-museum: ${goal.points}/${goal.target_points}, mine ${goal.my_points}`);
// Staff fill the rest with admin-logged credit (row 102), spread over the staging accounts under the member cap.
const accounts = (await sql(`select id from profiles where email like '%@tethos-staging.test' order by email`, false)).map((x) => x.id);
for (const id of accounts) {
  state = (await call(member, "GET", "/api/progression/state")).json?.state;
  const g = state.goals.find((x) => x.slug === "fund-museum");
  if (g.completed) break;
  await call(staff, "POST", "/api/progression/goals/fund-museum/credit", { member_id: id, points: Math.min(3000, g.target_points - g.points), note: "hardening E2E fill", idempotency_key: key(`hardening-${id.slice(0, 8)}`) });
}
r = await call(member, "POST", "/api/progression/goals/fund-museum/credit", { member_id: MEMBER, points: 10, idempotency_key: key("hardening-self") });
check(r.status === 403, "B7 a member can't credit the goal (403)");
state = (await call(member, "GET", "/api/progression/state")).json?.state;
c3 = chapter(state, "fund-museum");
check(state.goals.find((g) => g.slug === "fund-museum").completed && c3.status === "ready", `B8 the fund is complete; chapter 3 ready (${steps(c3)})`);
check(state.unlocked_regions.includes("museum") && state.unlocked_regions.includes("woods"), `B9 museum and woods open for the member (${state.unlocked_regions.join(", ")})`);
const pubState = (await call(pub, "GET", "/api/progression/state")).json?.state;
check(pubState.unlocked_regions.includes("museum"), `B10 and for the public account, whose chapter 3 is ${chapter(pubState, "fund-museum").status} (club goals open for everyone)`);
r = await call(member, "POST", "/api/progression/chapters/advance", { chapter_slug: "fund-museum", action: "complete" });
check(r.status === 200 && chapter(r.json.state, "fund-museum").status === "completed", "B11 chapter 3 completed");
r = await call(member, "POST", "/api/progression/chapters/advance", { chapter_slug: "fund-museum", action: "complete" });
check(r.status === 409, "B12 completing again is refused (409)");
await sql(`select subject, broadcast_key, count(*) from letters where broadcast_key like 'goal:fund-museum%' group by 1, 2`);
const box = (await call(pub, "GET", "/api/progression/letters")).json;
check(JSON.stringify(box).includes("The museum is open"), "B13 every member has the museum letter (public account's mailbox)");

}

// ─── C. Chapter 4: Reach the ruins gate ─────────────────────────────────────
if (RUN.has("reset-C")) {
  log("\n=== reset-C (staging fixture): the member back before chapter 4's level-10 step ===");
  await sql(`update member_progression set subclass = null, subclass_chosen_at = null, loadout = '{}', xp = 480, level = combat_level_for_xp(480) where member_id = '${MEMBER}' returning xp, level, subclass`);
  await sql(`delete from member_quest_progress where member_id = '${MEMBER}' and chapter_id = (select id from quest_chapters where slug = 'ruins-gate') returning status`);
}
if (RUN.has("C")) {
log("\n=== C. Chapter 4: Reach the ruins gate ===");
state = (await call(member, "GET", "/api/progression/state")).json?.state;
let c4 = chapter(state, "ruins-gate");
log(`chapter 4: ${c4.status} · ${steps(c4)} · labels: ${c4.steps.map((s) => s.label).join(" / ")}`);
check(c4.status === "active" && c4.steps.find((s) => s.key === "oracle_quiz").done, "C1 chapter 4 active, Oracle quiz done (class Warden)");
r = await call(member, "POST", "/api/progression/chapters/advance", { chapter_slug: "ruins-gate", action: "complete" });
check(r.status === 409, "C2 opening the gate before level 10 and the subclass choice is refused (409)");
let combat = (await call(member, "GET", "/api/combat/progression")).json;
log(`combat gate: ${JSON.stringify(combat?.gate)}`);
log("Staging fixture: member XP to the level-10 threshold (11625; combat XP normally comes from missions).");
await sql(`update member_progression set xp = greatest(xp, 11625), level = combat_level_for_xp(greatest(xp, 11625)) where member_id = '${MEMBER}' returning xp, level`);
r = await call(member, "POST", "/api/combat/subclass", { subclass: "druid", idempotency_key: key("hardening-subclass") });
check(r.status === 200, "C3 level-10 subclass choice within the Warden family (druid)");
combat = (await call(member, "GET", "/api/combat/progression")).json;
check(combat?.gate?.gateOpen === true, `C4 the ruins gate (combat) is open: ${JSON.stringify(combat?.gate)}`);
state = (await call(member, "GET", "/api/progression/state")).json?.state;
c4 = chapter(state, "ruins-gate");
check(c4.steps.find((s) => s.key === "family_trial").done && c4.status === "ready", `C5 chapter 4's level-10 step is done and the chapter is ready (${c4.status} · ${steps(c4)})`);
const before = (await sql(`select coins from wallets where member_id = '${MEMBER}'`, false))[0]?.coins;
// The reward is keyed per member and chapter: after a reset-C it was paid on the first run and must not pay again.
const paid = (await sql(`select 1 from wallet_ledger where member_id = '${MEMBER}' and idempotency_key = 'chapter:ruins-gate'`, false)).length > 0;
r = await call(member, "POST", "/api/progression/chapters/advance", { chapter_slug: "ruins-gate", action: "complete" });
check(r.status === 200 && chapter(r.json?.state ?? { chapters: [] }, "ruins-gate")?.status === "completed", "C6 chapter 4 completed: the gate opens");
const after = (await sql(`select coins from wallets where member_id = '${MEMBER}'`, false))[0]?.coins;
check(after - before === (paid ? 0 : 300), `C7 the 300-coin chapter reward, paid once (${before} → ${after}${paid ? ", already paid on an earlier run" : ""})`);
r = await call(member, "POST", "/api/progression/chapters/advance", { chapter_slug: "ruins-gate", action: "complete" });
check(r.status === 409, "C8 completing again is refused and pays nothing (409)");
state = (await call(member, "GET", "/api/progression/state")).json?.state;
check(state?.unlocked_regions.includes("cliffs") && state?.unlocked_regions.includes("ruins_gate"), `C9 cliffs and the ruins gate open (${state?.unlocked_regions.join(", ")})`);
await sql(`select subject, broadcast_key from letters where recipient_id = '${MEMBER}' and subject = 'Reach the ruins gate'`);
await sql(`select amount, balance_after, source, ref from wallet_ledger where member_id = '${MEMBER}' and source = 'chapter' order by created_at desc limit 2`);

}

// ─── D. Moderation audit log, unmute, the gate on the older routes ──────────
if (RUN.has("D")) {
log("\n=== D. Admin: audit log, unmute, older routes on the gate ===");
r = await call(member, "POST", "/api/progression/letters", { to: PUBLIC, subject: "hardening", body: `a rude note for the queue ${Date.now()}` });
const noteId = r.json?.letter?.id;
r = await call(pub, "PATCH", `/api/progression/letters/${noteId}`, { action: "report", reason: "rude" });
check(r.status === 200, "D1 the public account reports the member's note");
r = await call(member, "GET", "/api/admin/moderation");
check(r.status === 403, "D2 a T4 member can't open the queue (403)");
r = await call(staff, "GET", "/api/admin/moderation");
check(r.status === 200 && r.json.letters.some((l) => l.id === noteId), "D3 staff see it in the queue");
r = await call(staff, "POST", "/api/admin/moderation", { kind: "letter", id: noteId, action: "remove_mute" });
check(r.status === 200, "D4 staff remove the note and mute its author 7 days");
r = await call(member, "POST", "/api/progression/letters", { to: PUBLIC, body: "still here?" });
check(r.status === 403 || r.status === 423 || r.status === 429, `D5 the muted member can't write (${r.status})`);
r = await call(staff, "GET", "/api/admin/moderation");
check(r.json?.muted?.some((w) => w.id === MEMBER), "D6 the member is listed under Muted now");
r = await call(staff, "POST", "/api/identity/moderate", { member_id: MEMBER, action: "unmute" });
check(r.status === 200, "D7 staff unmute the member");
r = await call(member, "POST", "/api/progression/letters", { to: PUBLIC, body: "thanks for the second chance" });
check(r.status === 200, "D8 the member can write again");
r = await call(staff, "GET", "/api/admin/moderation");
const logRows = r.json?.log ?? [];
log(logRows.slice(0, 3).map((e) => `  ${e.created_at} ${e.actor?.name} ${e.action} ${e.item_kind} ${e.item_id ?? ""} → ${e.target?.name} "${e.excerpt ?? ""}"`).join("\n"));
check(logRows[0]?.action === "unmute" && logRows[1]?.action === "remove_mute" && logRows[1]?.item_id === noteId && logRows[0]?.actor?.id === STAFF, "D9 the audit log has both actions: who, what, which item, when");
check(!r.json?.muted?.some((w) => w.id === MEMBER), "D10 and the member is no longer muted");
await sql(`select actor_id, action, item_kind, item_id, target_id, excerpt, created_at from moderation_log order by id desc limit 2`);
r = await rest(member, "moderation_log?select=id");
check(r.status === 200 && r.json.length === 0, "D11 a T4 member reads nothing from moderation_log directly (RLS)");
r = await rest(staff, "moderation_log?select=id&limit=1");
check(r.status === 200 && r.json.length === 1, "D12 a T2 reads the log directly");
r = await call(member, "GET", "/api/npc/spend");
check(r.status === 403, "D13 NPC spend: T4 refused");
r = await call(staff, "GET", "/api/npc/spend");
check(r.status === 200, "D14 NPC spend: T2 allowed (was T1-only)");
r = await call(member, "POST", "/api/economy", { action: "award", user_id: MEMBER, amount: 5 });
check(r.status === 400, "D15 the old award action inside /api/economy is gone (400)");
r = await call(member, "POST", "/api/economy/admin/award", { user_id: MEMBER, amount: 5 });
check(r.status === 403, "D16 /api/economy/admin/award: T4 refused");
r = await call(staff, "POST", "/api/economy/admin/award", { user_id: MEMBER, amount: 1, description: "hardening E2E" });
check(r.status === 200, "D17 /api/economy/admin/award: T2 awards 1 Gem");
r = await call(member, "GET", "/api/directory");
const seesInactive = (m) => (m.json?.members ?? []).some((p) => p.is_active === false);
const staffDir = await call(staff, "GET", "/api/directory");
check(r.status === 200 && !seesInactive(r) && staffDir.status === 200, `D18 directory: T4 sees active members only; staff sees ${staffDir.json?.members?.length} (inactive included: ${seesInactive(staffDir)})`);

}

log(`\n${fails ? `${fails} FAILED` : "ALL PASS"}`);
process.exit(fails ? 1 : 0);
