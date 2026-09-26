// Show all auth users + their applications/drafts to find the source
// of a stale "Applied" badge.
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

console.log("=== All applications in DB ===");
const { data: apps } = await admin
  .from("applications")
  .select("id, user_id, full_name, email, position_id, submitted_at")
  .order("submitted_at", { ascending: false });
console.log(`Total: ${apps?.length ?? 0}`);
for (const a of apps ?? []) {
  console.log(`  ${a.email}  →  position=${a.position_id.slice(0, 8)}  submitted=${a.submitted_at}`);
}

console.log("\n=== All drafts in DB ===");
const { data: drafts } = await admin
  .from("application_drafts")
  .select("id, user_id, position_id, updated_at")
  .order("updated_at", { ascending: false });
console.log(`Total: ${drafts?.length ?? 0}`);
for (const d of drafts ?? []) {
  console.log(`  user=${d.user_id.slice(0, 8)}  position=${d.position_id.slice(0, 8)}  updated=${d.updated_at}`);
}

console.log("\n=== David's accounts (any email containing 'david') ===");
const { data: usersPage } = await admin.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
const davids = usersPage.users.filter((u) =>
  (u.email ?? "").toLowerCase().includes("david")
);
for (const u of davids) {
  console.log(`  ${u.email}  (id=${u.id})  created=${u.created_at}`);
}

console.log("\n=== Storage: all resume objects (top level user folders) ===");
const { data: rootList } = await admin.storage.from("resumes").list("", {
  limit: 100,
});
for (const item of rootList ?? []) {
  if (item.id === null && item.name) {
    // It's a folder
    const { data: contents } = await admin.storage
      .from("resumes")
      .list(item.name);
    console.log(`  ${item.name}/`);
    for (const f of contents ?? []) {
      console.log(`    - ${f.name}`);
    }
  }
}
