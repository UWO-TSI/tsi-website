// Creates a fake applicant so admins can preview the student-side view
// without bothering a real user. Idempotent: re-running upserts the same
// applicant.
//
//   node scripts/_make-test-applicant.mjs
//   node scripts/_make-test-applicant.mjs --position=vp-internal
//
// Prints the application id and the preview URL when done.

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

const TEST_EMAIL = "test-applicant@tethos.local";
const TEST_NAME = "Test Applicant";
const positionArg = process.argv
  .find((a) => a.startsWith("--position="))
  ?.split("=")[1];
const positionSlug = positionArg ?? "vp-internal";

// 1) Find a position to apply to
const { data: position, error: posErr } = await admin
  .from("positions")
  .select("id, title, slug, essay_questions")
  .eq("slug", positionSlug)
  .single();

if (posErr || !position) {
  console.error(`Position not found for slug=${positionSlug}`);
  console.error("Pass --position=<slug> or pick from:");
  const { data: all } = await admin.from("positions").select("slug, title");
  for (const p of all ?? []) console.error(`  ${p.slug.padEnd(20)} ${p.title}`);
  process.exit(1);
}

// 2) Find or create the test auth user
async function findOrCreateUser() {
  // Look for existing user by listing — supabase admin doesn't have a
  // direct "get by email" so we paginate the first page (good enough).
  const { data: list } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  const existing = list?.users.find((u) => u.email === TEST_EMAIL);
  if (existing) return existing;

  const { data: created, error } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: "test-password-not-used",
    email_confirm: true,
    user_metadata: { full_name: TEST_NAME },
  });
  if (error) {
    console.error("createUser failed:", error.message);
    process.exit(1);
  }
  return created.user;
}

const user = await findOrCreateUser();
console.log(`User:  ${user.id} (${user.email})`);
console.log(`Role:  ${position.title} (${position.slug})`);

// 3) Upsert the application
const essayAnswers = (position.essay_questions ?? []).map((q) => ({
  question_id: q.id,
  answer:
    "Sample essay answer for preview purposes. The applicant would normally write a few paragraphs here describing relevant experience, motivation, and fit for the role.",
}));

const { data: existing } = await admin
  .from("applications")
  .select("id")
  .eq("user_id", user.id)
  .eq("position_id", position.id)
  .maybeSingle();

const payload = {
  user_id: user.id,
  position_id: position.id,
  full_name: TEST_NAME,
  email: TEST_EMAIL,
  phone: "555-555-5555",
  program_major: "Software Engineering",
  year_of_study: 3,
  linkedin_url: "https://linkedin.com/in/test",
  heard_about_us: "Instagram",
  essay_answers: essayAnswers,
  status: "screening",
  draft_status: null,
};

let applicationId;
if (existing) {
  const { error } = await admin
    .from("applications")
    .update(payload)
    .eq("id", existing.id);
  if (error) {
    console.error("update failed:", error.message);
    process.exit(1);
  }
  applicationId = existing.id;
  console.log(`App:   ${applicationId} (updated)`);
} else {
  const { data: created, error } = await admin
    .from("applications")
    .insert(payload)
    .select("id")
    .single();
  if (error) {
    console.error("insert failed:", error.message);
    process.exit(1);
  }
  applicationId = created.id;
  console.log(`App:   ${applicationId} (created)`);
}

console.log();
console.log("Preview the student-side view at:");
console.log(`  http://localhost:3000/admin/preview/${applicationId}`);
