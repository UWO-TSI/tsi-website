// Wipe ALL applications + drafts + resume storage objects associated
// with davidliu8473@gmail.com regardless of which user_id they sit under.
// Useful when an old account left orphan rows behind.

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

console.log(`=== Applications with email=${TARGET_EMAIL} ===`);
const { data: apps } = await admin
  .from("applications")
  .select("id, user_id, full_name, email, position_id, submitted_at")
  .eq("email", TARGET_EMAIL);
console.log(`Found ${apps?.length ?? 0}`);
const orphanUserIds = new Set();
for (const a of apps ?? []) {
  console.log(
    `  ${a.id}  user_id=${a.user_id}  position=${a.position_id.slice(0, 8)}  submitted=${a.submitted_at}`
  );
  orphanUserIds.add(a.user_id);
}

// Delete by ID list to be precise
if (apps && apps.length > 0) {
  const ids = apps.map((a) => a.id);
  const { error } = await admin
    .from("applications")
    .delete()
    .in("id", ids);
  if (error) {
    console.error("✗", error.message);
    process.exit(1);
  }
  console.log(`✓ Deleted ${ids.length} application row(s)`);
}

// Drafts under any of the user_ids found
if (orphanUserIds.size > 0) {
  const idsArr = [...orphanUserIds];
  const { data: drafts } = await admin
    .from("application_drafts")
    .select("id")
    .in("user_id", idsArr);
  if (drafts && drafts.length > 0) {
    await admin.from("application_drafts").delete().in("user_id", idsArr);
    console.log(`✓ Deleted ${drafts.length} draft row(s)`);
  } else {
    console.log("No drafts found for those user_ids.");
  }

  // Storage objects under each user_id folder
  for (const uid of idsArr) {
    const { data: items } = await admin.storage.from("resumes").list(uid);
    if (items && items.length > 0) {
      const paths = items.map((o) => `${uid}/${o.name}`);
      await admin.storage.from("resumes").remove(paths);
      console.log(`✓ Deleted ${paths.length} storage object(s) under ${uid}/`);
    }
  }
}

console.log("\n=== Verify ===");
const { data: stillThere } = await admin
  .from("applications")
  .select("id, email, user_id")
  .eq("email", TARGET_EMAIL);
console.log(`Applications under ${TARGET_EMAIL}: ${stillThere?.length ?? 0}`);

const { data: storageRoot } = await admin.storage.from("resumes").list("", { limit: 100 });
console.log(`\nStorage user folders remaining: ${storageRoot?.filter((i) => i.id === null).length ?? 0}`);
for (const item of storageRoot ?? []) {
  if (item.id === null) console.log(`  ${item.name}/`);
}
