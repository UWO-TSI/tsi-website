// One-off reset for recruitment testing.
//   node scripts/_reset-applications.mjs           -> dry run, just prints what would change
//   node scripts/_reset-applications.mjs --apply   -> actually resets
//
// Resets every application back to status='screening', clears draft_status
// and released_at, and wipes the status_releases audit log. Useful when
// the dashboard has accumulated stale draft verdicts from testing.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8")
  .split("\n")
  .reduce((acc, line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) acc[m[1].trim()] = m[2].trim();
    return acc;
  }, {});

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const apply = process.argv.includes("--apply");

const { data: apps, error } = await admin
  .from("applications")
  .select("id, full_name, status, draft_status");

if (error) {
  console.error("Fetch failed:", error.message);
  process.exit(1);
}

const dirty = apps.filter(
  (a) => a.status !== "screening" || a.draft_status !== null
);

console.log(`${apps.length} applications total`);
console.log(`${dirty.length} need reset`);
for (const a of dirty.slice(0, 8)) {
  console.log(
    `  · ${a.full_name.padEnd(28)} status=${a.status}  draft=${a.draft_status ?? "-"}`
  );
}
if (dirty.length > 8) console.log(`  ... +${dirty.length - 8} more`);

if (!apply) {
  console.log("\nDry run. Re-run with --apply to commit.");
  process.exit(0);
}

console.log("\nResetting...");

const { error: updErr } = await admin
  .from("applications")
  .update({
    status: "screening",
    draft_status: null,
    released_at: null,
  })
  .neq("id", "00000000-0000-0000-0000-000000000000");

if (updErr) {
  console.error("Update failed:", updErr.message);
  process.exit(1);
}

const { error: delErr } = await admin
  .from("status_releases")
  .delete()
  .neq("id", "00000000-0000-0000-0000-000000000000");

if (delErr) {
  console.error("Release log delete failed:", delErr.message);
  process.exit(1);
}

console.log("Done. Refresh the dashboard.");
