// One-shot setup: creates resumes bucket, updates position visibility/dates.
// No DDL — uses service role + Supabase JS client only.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8")
  .split("\n")
  .reduce((acc, line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) acc[m[1].trim()] = m[2].trim();
    return acc;
  }, {});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

console.log("\n=== Creating resumes bucket ===");
const { data: existing, error: listErr } = await supabase.storage.listBuckets();
if (listErr) {
  console.error("Failed to list buckets:", listErr.message);
  process.exit(1);
}

const has = existing.some((b) => b.id === "resumes");
if (has) {
  console.log("Bucket exists — updating settings");
  const { error: updateErr } = await supabase.storage.updateBucket("resumes", {
    public: false,
    fileSizeLimit: 5242880,
    allowedMimeTypes: ["application/pdf"],
  });
  if (updateErr) console.error("Update failed:", updateErr.message);
  else console.log("Updated.");
} else {
  const { error: createErr } = await supabase.storage.createBucket("resumes", {
    public: false,
    fileSizeLimit: 5242880,
    allowedMimeTypes: ["application/pdf"],
  });
  if (createErr) {
    console.error("Create failed:", createErr.message);
    process.exit(1);
  }
  console.log("Created.");
}

console.log("\n=== Updating positions ===");
const { error: vpErr } = await supabase
  .from("positions")
  .update({
    is_active: true,
    opens_at: "2026-05-04T00:00:00Z",
    closes_at: "2026-05-31T23:59:59Z",
    visibility: "public",
  })
  .in("slug", ["vp-internal", "vp-external", "vp-marketing"]);
if (vpErr) {
  console.error("VP update failed:", vpErr.message);
  process.exit(1);
}
console.log("VP positions: opens 2026-05-04, closes 2026-05-31, public, active");

const { error: hideErr } = await supabase
  .from("positions")
  .update({ is_active: false })
  .not("slug", "in", '("vp-internal","vp-external","vp-marketing")');
if (hideErr) {
  console.error("Hide-others failed:", hideErr.message);
  process.exit(1);
}
console.log("Other positions: is_active=false");

console.log("\n=== Verify ===");
const { data: all } = await supabase
  .from("positions")
  .select("slug, is_active, opens_at, visibility")
  .order("phase")
  .order("slug");
console.table(all);

console.log("\n=== Verify bucket ===");
const { data: buckets2 } = await supabase.storage.listBuckets();
const r = buckets2.find((b) => b.id === "resumes");
console.log(r ? `bucket: public=${r.public}, limit=${r.file_size_limit}` : "MISSING");
