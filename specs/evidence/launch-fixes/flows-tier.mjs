// Rulings rerun on staging: the members-page editor through PATCH /api/admin/members/:id.
// usage: node flows-tier.mjs > flows-tier-run.txt   (dev server :4200 on staging)
import { execFileSync } from "node:child_process";
const S = "/private/tmp/claude-501/-Users-DavidLiu/f43cc88e-f162-4021-b1f0-63ceff7a3d0d/scratchpad/";
const REF = "jjiyeroyralfbluowbjq";
const BASE = "http://localhost:4200";
let raw = execFileSync("security", ["find-generic-password", "-s", "Supabase CLI", "-w"]).toString().trim().replace(/^go-keyring-base64:/, "");
if (!raw.startsWith("sbp_")) raw = Buffer.from(raw, "base64").toString();
let fails = 0;
const log = (s) => console.log(s);
const check = (ok, what) => { log(`${ok ? "PASS" : "FAIL"}: ${what}`); if (!ok) fails++; };
async function sql(q) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: "POST", headers: { Authorization: `Bearer ${raw}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: q }) });
  const j = await r.json();
  log(`SQL> ${q}`);
  for (const row of j) log(Object.entries(row).map(([k, v]) => `${k}=${v}`).join(" | "));
  return j;
}
const session = (who, pw) => JSON.parse(execFileSync("node", [S + "session.mjs", who, ...(pw ? [pw] : [])]).toString());
async function patch(who, s, id, body) {
  const r = await fetch(`${BASE}/api/admin/members/${id}`, { method: "PATCH", headers: { Cookie: s.cookie, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const text = await r.text();
  log(`${new Date().toISOString()} ${who} PATCH /api/admin/members/${id} ${JSON.stringify(body)} -> ${r.status} ${text.slice(0, 200)}`);
  return r.status;
}
const L1 = "8b41199c-f94f-4557-bfa8-8e75e4c11d3f", STAFF = "6d14b24f-7005-4194-adf2-4fc02d186c45";
const member = session("member"), staff = session("staff"), pub = session("public");
const row = async (id) => (await sql(`select tier, is_active, is_alumni from profiles where id = '${id}'`))[0];

check((await patch("member", member, L1, { tier: 3 })) === 403, "T4 member refused");
check((await patch("public", pub, L1, { tier: 3 })) === 403, "T5 public account refused");
check((await patch("staff", staff, L1, { tier: 3, xp: 9999 })) === 400, "unknown field refused");
check((await patch("staff", staff, STAFF, { tier: 3 })) === 409, "staff can't change own tier");
check((await patch("staff", staff, L1, { tier: 1 })) === 403, "T2 can't grant T1");
check((await patch("staff", staff, L1, { tier: 3 })) === 200, "T2 sets launch-l1 to T3");
check((await row(L1)).tier === 3, "readback: tier 3 persisted");
check((await patch("staff", staff, L1, { is_active: false, is_alumni: true })) === 200, "T2 deactivates and marks alumni");
let r = await row(L1);
check(r.is_active === false && r.is_alumni === true, "readback: inactive, alumni");
check((await sql(`select badge from member_badges where member_id = '${L1}'`))[0].badge === null, "inactive member loses the badge");
check((await patch("staff", staff, L1, { tier: 4, is_active: true, is_alumni: false })) === 200, "restore T4, active, not alumni");
r = await row(L1);
check(r.tier === 4 && r.is_active === true && r.is_alumni === false, "readback: restored");
log(`\n${fails === 0 ? "ALL PASS" : fails + " FAILED"}`);
