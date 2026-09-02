// Wipe David's applications, drafts, and resume objects so he can
// re-test the apply flow end-to-end. Keeps the auth user intact.

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

const TARGET_EMAIL = "davidliu8473@gmail.com";

// ── Find the user ─────────────────────────────────────────
const { data: usersPage, error: listErr } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
if (listErr) {
  console.error("Failed to list users:", listErr.message);
  process.exit(1);
}
const user = usersPage.users.find(
  (u) => u.email?.toLowerCase() === TARGET_EMAIL.toLowerCase()
);
if (!user) {
  console.log(`No auth user found for ${TARGET_EMAIL}.`);
  process.exit(0);
}
console.log(`Found user: ${user.email} (${user.id})`);

// ── Show what we're about to delete ───────────────────────
// resume_storage_path column doesn't exist in this DB (the migration
// was never applied). Selecting it would fail silently and report 0 apps.
const { data: apps, error: appsErr } = await admin
  .from("applications")
  .select("id, position_id, full_name, submitted_at, resume_drive_url")
  .eq("user_id", user.id);
if (appsErr) {
  console.error("Query failed:", appsErr.message);
  process.exit(1);
}
console.log(`\nApplications: ${apps?.length ?? 0}`);
for (const a of apps ?? []) {
  console.log(`  - ${a.id}  position=${a.position_id}  submitted=${a.submitted_at}`);
}

const { data: drafts } = await admin
  .from("application_drafts")
  .select("id, position_id, updated_at")
  .eq("user_id", user.id);
console.log(`\nDrafts: ${drafts?.length ?? 0}`);
for (const d of drafts ?? []) {
  console.log(`  - ${d.id}  position=${d.position_id}  updated=${d.updated_at}`);
}

const { data: storageObjs } = await admin.storage
  .from("resumes")
  .list(user.id);
console.log(`\nStorage objects under ${user.id}/: ${storageObjs?.length ?? 0}`);
for (const o of storageObjs ?? []) {
  console.log(`  - ${o.name}  (${o.metadata?.size ?? "?"} bytes)`);
}

// ── Delete in dependency order ────────────────────────────
console.log("\n=== Deleting ===");

// status_releases will cascade via FK ON DELETE CASCADE on applications
if (apps && apps.length > 0) {
  const { error: appErr } = await admin
    .from("applications")
    .delete()
    .eq("user_id", user.id);
  if (appErr) {
    console.error(`✗ applications: ${appErr.message}`);
    process.exit(1);
  }
  console.log(`✓ Deleted ${apps.length} application row(s)`);
}

if (drafts && drafts.length > 0) {
  const { error: draftErr } = await admin
    .from("application_drafts")
    .delete()
    .eq("user_id", user.id);
  if (draftErr) {
    console.error(`✗ drafts: ${draftErr.message}`);
    process.exit(1);
  }
  console.log(`✓ Deleted ${drafts.length} draft row(s)`);
}

if (storageObjs && storageObjs.length > 0) {
  const paths = storageObjs.map((o) => `${user.id}/${o.name}`);
  const { error: storeErr } = await admin.storage.from("resumes").remove(paths);
  if (storeErr) {
    console.error(`✗ storage: ${storeErr.message}`);
    process.exit(1);
  }
  console.log(`✓ Deleted ${paths.length} resume file(s)`);
}

console.log(
  "\nDone. Auth user is preserved. You'll need to clear browser " +
    "localStorage 'tethos:draft:*' and sessionStorage 'tethos:ack:*' " +
    "if you want a fully clean slate in the browser too."
);
