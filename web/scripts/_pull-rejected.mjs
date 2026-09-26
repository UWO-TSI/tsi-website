// Pull email + full_name of every applicant whose released OR draft
// status is "declined". draft_status catches admins who flagged a
// rejection in the dashboard but haven't hit "release" yet.

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

const { data, error } = await admin
  .from("applications")
  .select(
    "full_name, email, status, draft_status, position:positions(slug, title), submitted_at"
  )
  .or(
    "status.in.(rejected,declined),draft_status.in.(rejected,declined)"
  )
  .order("submitted_at", { ascending: false });

if (error) {
  console.error("Query failed:", error.message);
  process.exit(1);
}

const rows = data ?? [];

console.log(`\n=== Rejected applicants (${rows.length}) ===\n`);
for (const r of rows) {
  const role = r.position?.title ?? r.position?.[0]?.title ?? "?";
  const tag =
    r.status === "rejected" || r.status === "declined"
      ? "[released]"
      : "[draft]   ";
  console.log(
    `  ${tag} ${r.full_name.padEnd(28)} ${r.email.padEnd(36)} ${role}`
  );
}

// Status breakdown across the board so we know what's actually in there
const { data: all } = await admin
  .from("applications")
  .select("status, draft_status");
const released = {};
const draft = {};
for (const a of all ?? []) {
  released[a.status] = (released[a.status] ?? 0) + 1;
  if (a.draft_status) draft[a.draft_status] = (draft[a.draft_status] ?? 0) + 1;
}
console.log("\n=== All applications by released status ===");
console.log(released);
console.log("=== Pending drafts ===");
console.log(draft);

// CSV dump
console.log("\n=== CSV ===");
console.log("name,email,position,state,submitted_at");
for (const r of rows) {
  const role = r.position?.title ?? r.position?.[0]?.title ?? "";
  const state =
    r.status === "rejected" || r.status === "declined" ? "released" : "draft";
  const cell = (v) =>
    /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v;
  console.log(
    [cell(r.full_name), cell(r.email), cell(role), state, r.submitted_at].join(",")
  );
}
