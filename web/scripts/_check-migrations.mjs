import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Parse .env.local
const env = readFileSync(
  resolve(".env.local"),
  "utf8"
)
  .split("\n")
  .reduce((acc, line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) acc[m[1].trim()] = m[2].trim();
    return acc;
  }, {});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

console.log("\n=== Position visibility ===");
const { data: positions, error: posErr } = await supabase
  .from("positions")
  .select("slug, title, is_active, opens_at, closes_at, visibility")
  .order("phase")
  .order("slug");
if (posErr) {
  console.log("ERROR:", posErr.message);
} else {
  console.table(positions);
}

console.log("\n=== resume_storage_path column exists? ===");
const { error: colErr } = await supabase
  .from("applications")
  .select("resume_storage_path")
  .limit(1);
console.log(colErr ? `MISSING — ${colErr.message}` : "EXISTS");

console.log("\n=== resumes bucket exists? ===");
const { data: buckets, error: bucketErr } = await supabase.storage.listBuckets();
if (bucketErr) {
  console.log("ERROR:", bucketErr.message);
} else {
  const resumesBucket = buckets.find((b) => b.id === "resumes");
  console.log(
    resumesBucket
      ? `EXISTS — public=${resumesBucket.public}, file_size_limit=${resumesBucket.file_size_limit}`
      : "MISSING"
  );
}
