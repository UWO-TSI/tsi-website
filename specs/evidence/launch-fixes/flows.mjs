// Launch-fixes staging reruns through the real Next routes (dev server on :4200,
// env = web/.env.staging.local) with readbacks through the management API.
// usage: node flows.mjs > flows-run.txt
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
const S = "/private/tmp/claude-501/-Users-DavidLiu/f43cc88e-f162-4021-b1f0-63ceff7a3d0d/scratchpad/";
const WEB = "/Users/DavidLiu/Documents/GitHub/uwotsi/.claude/worktrees/agent-af0be167d23b1348d/web/";
const REF = "jjiyeroyralfbluowbjq";
const BASE = "http://localhost:4200";
const env = Object.fromEntries(readFileSync(WEB + ".env.staging.local", "utf8").trim().split("\n").map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
let raw = execFileSync("security", ["find-generic-password", "-s", "Supabase CLI", "-w"]).toString().trim().replace(/^go-keyring-base64:/, "");
if (!raw.startsWith("sbp_")) raw = Buffer.from(raw, "base64").toString();
const TOKEN = raw;
let fails = 0;
const log = (s) => console.log(s);
const check = (ok, what) => { log(`${ok ? "PASS" : "FAIL"}: ${what}`); if (!ok) fails++; };

async function sql(q, show = true) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error(`sql: ${JSON.stringify(j)}`);
  if (show) {
    log(`SQL> ${q.replace(/\s+/g, " ").trim()}`);
    if (j.length) { log(Object.keys(j[0]).join(" | ")); for (const row of j) log(Object.values(row).map((v) => (v && typeof v === "object" ? JSON.stringify(v) : v)).join(" | ")); } else log("(no rows)");
  }
  return j;
}
const session = (who, pw) => JSON.parse(execFileSync("node", [S + "session.mjs", who, ...(pw ? [pw] : [])]).toString());
async function call(who, s, method, path, body) {
  const r = await fetch(BASE + path, { method, headers: { Cookie: s.cookie, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  log(`${new Date().toISOString()} ${who} ${method} ${path}${body === undefined ? "" : " " + JSON.stringify(body)} -> ${r.status} ${text.slice(0, 260)}`);
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, json };
}
async function adminUser(email, name) {
  const pw = execFileSync("openssl", ["rand", "-base64", "18"]).toString().trim();
  const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users`, { method: "POST", headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ email, password: pw, email_confirm: true, user_metadata: { display_name: name } }) });
  const j = await r.json();
  if (!j.id) throw new Error(JSON.stringify(j));
  execFileSync("security", ["add-generic-password", "-a", "launch-fixes", "-s", `tethos-staging ${email}`, "-w", pw, "-U"]);
  log(`created ${email} (${j.id}) through the GoTrue admin API; password in the keychain as "tethos-staging ${email}"`);
  return { id: j.id, s: session(email, pw) };
}
const profile = (id) => sql(`select p.tier, p.membership, b.badge from profiles p join member_badges b on b.member_id = p.id where p.id = '${id}'`);

const member = session("member"), staff = session("staff");
const MEMBER = "c2982825-3dd1-4572-a9d0-4b7fadd306d6", STAFF = "6d14b24f-7005-4194-adf2-4fc02d186c45";

log("=== A. Admin marks a member (POST /api/admin/members/:id/membership) ===");
const l1 = await adminUser("launch-l1@tethos-staging.test", "Launch One");
let rows = await profile(l1.id);
check(rows[0].tier === 5 && rows[0].membership === "public", "new plain account is public T5 (sign-up trigger)");
let r = await call("member", member, "POST", `/api/admin/members/${l1.id}/membership`, { membership: "member" });
check(r.status === 403, "a T4 member can't mark members");
r = await call("staff", staff, "POST", `/api/admin/members/${l1.id}/membership`, { membership: "boss" });
check(r.status === 400, "bad body refused");
r = await call("staff", staff, "POST", `/api/admin/members/${l1.id}/membership`, { membership: "member" });
check(r.status === 200 && r.json?.member?.membership === "member" && r.json?.member?.tier === 4, "T2 marks the public account a member: T4");
r = await call("staff", staff, "POST", `/api/admin/members/${l1.id}/membership`, { membership: "member" });
check(r.status === 200 && r.json?.member?.tier === 4, "marking again is a no-op");
rows = await profile(l1.id);
check(rows[0].membership === "member" && rows[0].tier === 4 && rows[0].badge === "member", "readback: member, T4, member badge");
r = await call("staff", staff, "POST", `/api/admin/members/${STAFF}/membership`, { membership: "public" });
check(r.status === 409, "staff (T2) can't be made public");
r = await call("staff", staff, "POST", `/api/admin/members/00000000-0000-4000-8000-000000000999/membership`, { membership: "public" });
check(r.status === 404, "unknown account 404");
r = await call("staff", staff, "POST", `/api/admin/members/${MEMBER}/membership`, { membership: "public" });
check(r.status === 200 && r.json?.member?.tier === 5, "T2 makes a member public: T5");
r = await call("staff", staff, "POST", `/api/admin/members/${MEMBER}/membership`, { membership: "member" });
check(r.status === 200 && r.json?.member?.tier === 4, "and back to member: T4");
await profile(MEMBER);
r = await call("public", session("public"), "POST", `/api/admin/members/${MEMBER}/membership`, { membership: "public" });
check(r.status === 403, "a public account can't either");

log("\n=== B. Un-RSVP through /api/events/[id]/rsvp (member) ===");
const EV = "2b43ebdf-a750-4183-b5b7-1f13130a99af";
const att = () => sql(`select status from event_attendance where event_id = '${EV}' and user_id = '${MEMBER}'`);
r = await call("member", member, "POST", `/api/events/${EV}/rsvp`);
check(r.json?.action === "registered", "RSVP");
check((await att()).length === 1, "readback: RSVP row");
r = await call("member", member, "POST", `/api/events/${EV}/rsvp`);
check(r.json?.action === "unregistered", "un-RSVP answered");
check((await att()).length === 0, "readback: RSVP row gone");
r = await call("member", member, "POST", `/api/events/${EV}/rsvp`);
check(r.json?.action === "registered", "RSVP again after cancelling");
const IRL = "b96b913a-c18e-4417-a874-0f41f8bc2d23";
await sql(`insert into event_attendance (event_id, user_id, status) values ('${IRL}', '${l1.id}', 'attended') on conflict (event_id, user_id) do update set status = 'attended'`);
const tokL1 = l1.s.token;
const del = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/event_attendance?event_id=eq.${IRL}&user_id=eq.${l1.id}`, { method: "DELETE", headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${tokL1}`, Prefer: "return=representation" } });
log(`launch-l1 DELETE /rest/v1/event_attendance (own check-in) -> ${del.status} ${await del.text()}`);
check((await sql(`select status from event_attendance where event_id = '${IRL}' and user_id = '${l1.id}'`)).length === 1, "a check-in ('attended') can't be deleted by its owner");
const delOther = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/event_attendance?event_id=eq.${EV}&user_id=eq.${MEMBER}`, { method: "DELETE", headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${tokL1}`, Prefer: "return=representation" } });
log(`launch-l1 DELETE /rest/v1/event_attendance (the member's RSVP) -> ${delOther.status} ${await delOther.text()}`);
check((await att()).length === 1, "someone else's RSVP can't be deleted");

async function chapterWithFailure(who, u, where) {
  const adv = (action) => call(who, u.s, "POST", "/api/progression/chapters/advance", { chapter_slug: "settle-in", action });
  const state = () => sql(`select q.status, q.completed_at is not null as completed,
      (select count(*) from wallet_ledger l where l.member_id = '${u.id}' and l.idempotency_key = 'chapter:settle-in') as reward_rows,
      (select coalesce(sum(amount), 0) from wallet_ledger l where l.member_id = '${u.id}' and l.source = 'chapter') as reward_coins,
      (select count(*) from letters l where l.recipient_id = '${u.id}' and l.broadcast_key = 'chapter:settle-in') as letters
    from member_quest_progress q join quest_chapters c on c.id = q.chapter_id where q.member_id = '${u.id}' and c.slug = 'settle-in'`);
  check((await adv("claim_plot")).status === 200, "claim_plot");
  check((await call(who, u.s, "POST", "/api/collections", { item_key: "fish_anchovy", size_cm: 11.5 })).status === 200, "first catch");
  check((await adv("donate_catch")).status === 200, "donate_catch (chapter now ready)");
  const table = where === "letter" ? "letters" : "wallet_ledger";
  const cond = where === "letter" ? `new.recipient_id = '${u.id}' and new.broadcast_key = 'chapter:settle-in'` : `new.member_id = '${u.id}' and new.idempotency_key = 'chapter:settle-in'`;
  await sql(`create or replace function public.tmp_launch_fail() returns trigger language plpgsql as $f$ begin raise exception 'injected failure (launch-fixes staging test)'; end $f$;
    create trigger tmp_launch_fail before insert on public.${table} for each row when (${cond}) execute function public.tmp_launch_fail();`, false);
  log(`INJECT: trigger tmp_launch_fail on ${table} (raises for this account's chapter:settle-in ${where})`);
  let res = await adv("report_hq");
  check(res.status === 500, `report_hq fails while the ${where} insert raises`);
  let st = await state();
  check(st[0].completed === false, `chapter not saved as completed after the ${where} failure`);
  await sql(`drop trigger tmp_launch_fail on public.${table}; drop function public.tmp_launch_fail();`, false);
  log("INJECT removed");
  res = await adv("report_hq");
  check(res.status === 200 && res.json?.state?.chapters?.[0]?.status === "completed", "retry of report_hq completes the chapter");
  st = await state();
  check(st[0].completed === true && Number(st[0].reward_rows) === 1 && Number(st[0].reward_coins) === 100 && Number(st[0].letters) === 1, "reward paid once (100), letter once");
  res = await adv("report_hq");
  check(res.status === 409, "a third report_hq: already finished, nothing more paid");
  st = await state();
  check(Number(st[0].reward_rows) === 1, "still one reward row");
}

log("\n=== C. Chapter 1 with the letter failing after the reward (launch-l1, member) ===");
await chapterWithFailure("launch-l1", l1, "letter");
log("\n=== D. Chapter 1 with the reward failing (launch-l2, public T5 account) ===");
const l2 = await adminUser("launch-l2@tethos-staging.test", "Launch Two");
await profile(l2.id);
await chapterWithFailure("launch-l2", l2, "credit");

log(`\n${fails === 0 ? "ALL PASS" : fails + " FAILED"}`);
