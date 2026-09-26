// Pulls all live applications + linked position info for a quick admin view.
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

const { data: apps, error } = await admin
  .from("applications")
  .select(
    "id, full_name, email, phone, program_major, year_of_study, " +
      "linkedin_url, heard_about_us, resume_filename, resume_drive_url, " +
      "essay_answers, status, submitted_at, " +
      "position:positions(slug, title)"
  )
  .order("submitted_at", { ascending: false });

if (error) {
  console.error("✗", error.message);
  process.exit(1);
}

console.log(`\n=== ${apps?.length ?? 0} application(s) ===\n`);

if (!apps || apps.length === 0) {
  console.log("No applications yet.");
  process.exit(0);
}

const META_KEYS = new Set([
  "__profile_other_links",
  "__profile_commitments_next_year",
  "__portfolio_file",
  "__creative_piece_file",
]);

for (const a of apps) {
  console.log("─".repeat(80));
  console.log(`${a.position?.title ?? "?"} (${a.position?.slug ?? "?"})`);
  console.log(`  Submitted: ${new Date(a.submitted_at).toLocaleString()}`);
  console.log(`  Status:    ${a.status}`);
  console.log(`  Name:      ${a.full_name}`);
  console.log(`  Email:     ${a.email}`);
  console.log(`  Phone:     ${a.phone}`);
  console.log(`  Program:   ${a.program_major} (Year ${a.year_of_study})`);
  console.log(`  LinkedIn:  ${a.linkedin_url || "—"}`);
  console.log(`  Heard via: ${a.heard_about_us}`);
  console.log(`  Resume:    ${a.resume_filename || "—"}`);

  // Profile fields stashed in essay_answers under reserved IDs
  const meta = (a.essay_answers ?? []).filter((e) =>
    META_KEYS.has(e.question_id)
  );
  for (const m of meta) {
    if (m.question_id === "__profile_other_links") {
      console.log(`  Other links:\n    ${m.answer.replace(/\n/g, "\n    ")}`);
    } else if (m.question_id === "__profile_commitments_next_year") {
      console.log(`  Commitments:\n    ${m.answer.replace(/\n/g, "\n    ")}`);
    } else if (m.question_id === "__portfolio_file") {
      try {
        const v = JSON.parse(m.answer);
        console.log(`  Portfolio file:  ${v.filename} (${v.path})`);
      } catch {
        console.log(`  Portfolio file:  ${m.answer}`);
      }
    } else if (m.question_id === "__creative_piece_file") {
      try {
        const v = JSON.parse(m.answer);
        console.log(`  Creative piece:  ${v.filename} (${v.path})`);
      } catch {
        console.log(`  Creative piece:  ${m.answer}`);
      }
    }
  }

  // Real essay answers
  const essays = (a.essay_answers ?? []).filter(
    (e) => !META_KEYS.has(e.question_id)
  );
  for (const e of essays) {
    const trimmed = (e.answer ?? "").trim();
    if (!trimmed) continue;
    console.log(`\n  [${e.question_id}]`);
    const lines = trimmed.split("\n");
    for (const ln of lines) console.log(`    ${ln}`);
  }
  console.log();
}
console.log("─".repeat(80));
