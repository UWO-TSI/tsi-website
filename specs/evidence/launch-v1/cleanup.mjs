// Cleanup of the launch test's three throwaway accounts (specs/lanes/launch-v1.md), exact and proven:
//   node cleanup.mjs scan      every public uuid column (and auth.users) counted for the three ids, read-only
//   node cleanup.mjs collect   the rows that only go to NULL on a delete, recorded by id in $IDS
//   node cleanup.mjs delete    A's mute undone, those rows deleted by id, then the three users (their rows cascade)
//   node cleanup.mjs verify    zero rows left for the ids, the recorded row ids and the users (counts only)
// Env: IDS (the scratch JSON with the account ids, outside the repo). The service key comes from web/.env.local and
// the management token from the Supabase CLI keychain entry, both into memory only; nothing secret is printed.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const WEB = new URL("../../../web/", import.meta.url).pathname;
const REF = "rtbkrngsdbptbjhfbcud";
const IDS = process.env.IDS;
if (!IDS) throw new Error("IDS is required");
const ids = JSON.parse(readFileSync(IDS, "utf8"));
const users = ["a", "b", "m"].map(k => ids[k]?.id).filter(Boolean);
if (users.length !== 3 || users.some(u => !/^[0-9a-f-]{36}$/.test(u))) throw new Error("expected three account ids");
const list = users.map(u => `'${u}'`).join(",");

const env = Object.fromEntries(readFileSync(WEB + ".env.local", "utf8").split("\n").filter(l => /^[A-Z_]+=/.test(l))
  .map(l => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).replace(/^"/, "").replace(/"$/, "").replace(/\\n$/, "").trim()]));
let raw = execFileSync("security", ["find-generic-password", "-s", "Supabase CLI", "-w"]).toString().trim().replace(/^go-keyring-base64:/, "");
if (!raw.startsWith("sbp_")) raw = Buffer.from(raw, "base64").toString();
const MGMT = raw;

async function sql(query, write = false) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, read_only: !write }),
  });
  const j = await r.json();
  if (!Array.isArray(j)) throw new Error(`sql: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

/** Every public uuid column (but `id`) and the auth users: how many rows name one of the three. Nonzero ones only. */
async function scan() {
  const cols = await sql(`select c.table_name t, c.column_name c from information_schema.columns c join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name and t.table_type = 'BASE TABLE'
    where c.table_schema = 'public' and c.data_type = 'uuid' and c.column_name <> 'id' order by 1, 2`);
  const parts = cols.map(({ t, c }) => `select '${t}.${c}' as col, count(*)::int as n from public."${t}" where "${c}" in (${list})`);
  parts.push(`select 'auth.users.id', count(*)::int from auth.users where id in (${list})`);
  parts.push(`select 'public.profiles.id', count(*)::int from public.profiles where id in (${list})`);
  const rows = [];
  for (let i = 0; i < parts.length; i += 40) rows.push(...await sql(parts.slice(i, i + 40).join("\nunion all\n")));
  return { columns: rows.length, nonzero: rows.filter(r => r.n > 0) };
}

/** The tables whose rows outlive a user delete (SET NULL), by id. */
const KEEPERS = {
  world_chat_messages: ["member_id"],
  world_reports: ["reporter_id", "target_id", "resolved_by"],
  moderation_log: ["actor_id", "target_id"],
  letters: ["sender_id", "recipient_id"],
  identity_name_log: ["changed_by", "member_id"],
  identity_reports: ["reporter_id", "target_id"],
  museum_donations: ["donor_id"],
  npc_conversations: ["user_id"],
  study_chat_messages: ["member_id", "reported_by"],
  club_goal_contributions: ["created_by"],
};
async function collect() {
  const have = new Set((await sql(`select table_name || '.' || column_name as k from information_schema.columns where table_schema = 'public'`)).map(r => r.k));
  const rows = {};
  for (const [t, cs] of Object.entries(KEEPERS)) {
    const present = cs.filter(c => have.has(`${t}.${c}`));
    if (!present.length || !have.has(`${t}.id`)) continue; // no rows of ours there are keyed otherwise (the scan shows any left)
    const found = await sql(`select id::text from public."${t}" where ${present.map(c => `"${c}" in (${list})`).join(" or ")}`);
    if (found.length) rows[t] = found.map(r => r.id);
  }
  ids.rows = rows;
  writeFileSync(IDS, JSON.stringify(ids, null, 2));
  return Object.fromEntries(Object.entries(rows).map(([t, v]) => [t, v.length]));
}

async function remove() {
  // A's mute (the test undid it through the route; this makes sure).
  await sql(`update public.member_identity set muted_until = null where member_id = '${ids.a.id}' and muted_until is not null`, true);
  const stmts = Object.entries(ids.rows ?? {}).filter(([, v]) => v.length)
    .map(([t, v]) => `delete from public."${t}" where id in (${v.map(x => `'${x}'`).join(",")});`);
  if (stmts.length) await sql(`begin;\n${stmts.join("\n")}\ncommit;`, true);
  const out = {};
  for (const k of ["a", "b", "m"]) {
    const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/admin/users/${ids[k].id}`, { method: "DELETE", headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY } });
    out[k] = r.status;
  }
  return { rowTables: stmts.length, userDeletes: out };
}

async function verify() {
  const s = await scan();
  const recorded = {};
  for (const [t, v] of Object.entries(ids.rows ?? {})) {
    if (!v.length) continue;
    recorded[t] = (await sql(`select count(*)::int n from public."${t}" where id in (${v.map(x => `'${x}'`).join(",")})`))[0].n;
  }
  return { scannedColumns: s.columns, nonzero: s.nonzero, recordedRowsLeft: recorded };
}

const phase = process.argv[2];
const result = phase === "scan" ? await scan() : phase === "collect" ? await collect() : phase === "delete" ? await remove() : phase === "verify" ? await verify() : null;
if (!result) throw new Error("phase: scan | collect | delete | verify");
console.log(JSON.stringify(result, null, 1));
