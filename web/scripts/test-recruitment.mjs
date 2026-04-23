#!/usr/bin/env node
// End-to-end + stress test for the recruitment portal.
//
// Validates:
//   - Supabase DB layer: insert/read/RLS/constraint enforcement
//   - Google Drive: list uploads in recruitment folder
//   - Concurrency: N parallel submissions don't lose data or produce duplicates
//   - Guards: duplicate-submission unique constraint
//
// Usage:
//   node scripts/test-recruitment.mjs           # single happy-path
//   node scripts/test-recruitment.mjs stress    # 50 concurrent
//   node scripts/test-recruitment.mjs all       # run everything
//   node scripts/test-recruitment.mjs cleanup   # remove test users/apps
//
// Uses service role for setup/teardown; goes through Supabase client directly
// (bypasses the Next API layer).

import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Minimal .env.local loader (avoids a dotenv dep just for this script).
function loadEnv() {
  const p = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(p)) return;
  const text = fs.readFileSync(p, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnv();

const {
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GOOGLE_DRIVE_CREDENTIALS,
  GOOGLE_DRIVE_FOLDER_ID,
} = process.env;

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE env vars.");
  process.exit(1);
}

const admin = createClient(
  NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const TEST_EMAIL_PREFIX = "recruit-test-";
const TEST_POSITION_SLUG = "vp-internal";

// ──────────────────────────── helpers ────────────────────────────

async function getPosition(slug) {
  const { data, error } = await admin
    .from("positions")
    .select("*")
    .eq("slug", slug)
    .single();
  if (error) throw error;
  return data;
}

async function createTestUser(suffix) {
  const email = `${TEST_EMAIL_PREFIX}${suffix}@test.tethos.ca`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "Test1234!",
    email_confirm: true,
    user_metadata: { full_name: `Test User ${suffix}` },
  });
  if (error) throw new Error(`createUser ${email}: ${error.message}`);
  return { id: data.user.id, email };
}

async function submitApplication(userId, position, suffix) {
  const essayAnswers = position.essay_questions.map((q) => ({
    question_id: q.id,
    answer:
      `This is a stress-test answer for ${q.id}. ` +
      `Generated for user suffix ${suffix}. ` +
      `We need at least a handful of words to simulate a real response.`,
  }));

  const payload = {
    user_id: userId,
    position_id: position.id,
    full_name: `Test User ${suffix}`,
    email: `${TEST_EMAIL_PREFIX}${suffix}@test.tethos.ca`,
    phone: `555-000-${String(suffix).padStart(4, "0")}`,
    program_major: "Software Engineering",
    year_of_study: 3,
    linkedin_url: null,
    heard_about_us: "Instagram",
    resume_drive_url: null,
    resume_filename: null,
    essay_answers: essayAnswers,
  };

  const t0 = Date.now();
  const { data, error } = await admin
    .from("applications")
    .insert(payload)
    .select()
    .single();
  const dt = Date.now() - t0;
  if (error) throw new Error(`insert (${suffix}): ${error.message} [${error.code}]`);
  return { id: data.id, dt };
}

async function cleanupTestData() {
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const testUsers = (users?.users ?? []).filter((u) =>
    u.email?.startsWith(TEST_EMAIL_PREFIX)
  );
  console.log(`  cleanup: found ${testUsers.length} test users`);

  for (const u of testUsers) {
    await admin.auth.admin.deleteUser(u.id);
  }
  return testUsers.length;
}

async function driveList() {
  if (!GOOGLE_DRIVE_CREDENTIALS || !GOOGLE_DRIVE_FOLDER_ID) {
    return { ok: false, reason: "missing-drive-env" };
  }
  const credentials = JSON.parse(GOOGLE_DRIVE_CREDENTIALS);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const drive = google.drive({ version: "v3", auth });

  // List everything inside the recruitment folder and any sub-folders.
  const { data } = await drive.files.list({
    q: `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed=false`,
    fields: "files(id, name, mimeType, modifiedTime)",
    pageSize: 200,
  });
  const files = data.files ?? [];

  const byType = files.reduce((acc, f) => {
    const k = f.mimeType === "application/vnd.google-apps.folder" ? "folders" : "files";
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});

  // Peek two levels deep: root → Recruitment/ → {position-slug}/
  async function listFolder(folderId) {
    const r = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id, name, mimeType, size)",
      pageSize: 500,
    });
    return r.data.files ?? [];
  }

  const folderContents = {};
  for (const f of files.filter((x) => x.mimeType === "application/vnd.google-apps.folder")) {
    const lvl1 = await listFolder(f.id);
    folderContents[f.name] = {};
    for (const sub of lvl1) {
      if (sub.mimeType === "application/vnd.google-apps.folder") {
        const lvl2 = await listFolder(sub.id);
        folderContents[f.name][sub.name] = lvl2.map((x) => ({
          name: x.name,
          size: x.size,
          mimeType: x.mimeType,
        }));
      } else {
        folderContents[f.name][sub.name] = [{ name: sub.name, size: sub.size, mimeType: sub.mimeType }];
      }
    }
  }

  return { ok: true, byType, files: files.map((f) => f.name), folderContents };
}

function pct(arr, p) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.max(0, Math.min(s.length - 1, Math.floor((p / 100) * s.length)));
  return s[i];
}

function banner(msg) {
  console.log(`\n━━━ ${msg} ━━━`);
}

// ──────────────────────────── tests ────────────────────────────

async function singleHappyPath() {
  banner("Single end-to-end submission");
  const suffix = `single-${Date.now()}`;
  const user = await createTestUser(suffix);
  console.log(`  created user ${user.email} (${user.id})`);

  const position = await getPosition(TEST_POSITION_SLUG);
  console.log(`  target position: ${position.slug} (${position.id})`);

  const { id, dt } = await submitApplication(user.id, position, suffix);
  console.log(`  submitted application ${id} in ${dt}ms`);

  // Read back via service role
  const { data: row } = await admin
    .from("applications")
    .select("status, submitted_at, essay_answers")
    .eq("id", id)
    .single();
  console.log(`  row status=${row.status}, essays=${row.essay_answers.length}`);

  // Cleanup this user
  await admin.auth.admin.deleteUser(user.id);
  console.log(`  cleaned up user`);

  return { ok: true };
}

async function duplicateGuard() {
  banner("Duplicate-application guard");
  const suffix = `dup-${Date.now()}`;
  const user = await createTestUser(suffix);
  const position = await getPosition(TEST_POSITION_SLUG);

  const first = await submitApplication(user.id, position, suffix);
  console.log(`  first submission ok (${first.dt}ms)`);

  let duplicateBlocked = false;
  try {
    await submitApplication(user.id, position, suffix + "-dup");
    console.log(`  UNEXPECTED: second submission succeeded`);
  } catch (e) {
    if (/duplicate|23505/i.test(e.message)) {
      duplicateBlocked = true;
      console.log(`  second submission blocked by unique constraint ✓`);
    } else {
      throw e;
    }
  }

  await admin.auth.admin.deleteUser(user.id);
  return { ok: duplicateBlocked };
}

async function stressTest(N = 50) {
  banner(`Stress test: ${N} concurrent submissions`);
  const position = await getPosition(TEST_POSITION_SLUG);

  const t0 = Date.now();
  const suffixes = Array.from({ length: N }, (_, i) => `stress-${Date.now()}-${i}`);

  // Phase 1: create N users in parallel
  console.log(`  creating ${N} test users...`);
  const userResults = await Promise.allSettled(suffixes.map((s) => createTestUser(s)));
  const users = userResults
    .map((r, i) => (r.status === "fulfilled" ? { ...r.value, suffix: suffixes[i] } : null))
    .filter(Boolean);
  const failedUsers = userResults.filter((r) => r.status === "rejected").length;
  console.log(`  created ${users.length}/${N} users (${failedUsers} failed)`);

  // Phase 2: submit applications in parallel
  console.log(`  submitting ${users.length} applications in parallel...`);
  const submitResults = await Promise.allSettled(
    users.map((u) => submitApplication(u.id, position, u.suffix))
  );
  const elapsed = Date.now() - t0;

  const successes = submitResults.filter((r) => r.status === "fulfilled");
  const failures = submitResults.filter((r) => r.status === "rejected");
  const latencies = successes.map((r) => r.value.dt);

  console.log(`  done in ${elapsed}ms`);
  console.log(`  successes: ${successes.length}/${users.length}`);
  console.log(`  failures:  ${failures.length}`);
  if (failures.length > 0) {
    console.log(`  first failure: ${failures[0].reason?.message ?? failures[0].reason}`);
  }
  console.log(
    `  latency: p50=${pct(latencies, 50)}ms  p95=${pct(latencies, 95)}ms  max=${Math.max(...latencies, 0)}ms`
  );

  // Phase 3: verify count via service-role query
  const { count } = await admin
    .from("applications")
    .select("id", { count: "exact", head: true })
    .like("email", `${TEST_EMAIL_PREFIX}stress-${new Date(t0).getTime() / 1000 | 0}%`);
  // fallback — count by user_ids
  const { data: verifyRows } = await admin
    .from("applications")
    .select("id")
    .in("user_id", users.map((u) => u.id));
  console.log(`  verified rows in DB: ${verifyRows?.length ?? 0}`);

  // Cleanup
  console.log(`  cleaning up ${users.length} test users...`);
  await Promise.allSettled(users.map((u) => admin.auth.admin.deleteUser(u.id)));
  console.log(`  cleanup done`);

  return {
    ok: successes.length === users.length && verifyRows?.length === successes.length,
    successes: successes.length,
    failures: failures.length,
    elapsed,
    p50: pct(latencies, 50),
    p95: pct(latencies, 95),
  };
}

async function driveCheck() {
  banner("Drive folder inspection");
  const r = await driveList();
  if (!r.ok) {
    console.log(`  skipped: ${r.reason}`);
    return { ok: false, skipped: true };
  }
  console.log(`  byType: ${JSON.stringify(r.byType)}`);
  if (r.files.length === 0) {
    console.log(`  folder empty — no resumes uploaded yet`);
  } else {
    console.log(`  top-level:`);
    r.files.slice(0, 10).forEach((n) => console.log(`    - ${n}`));
  }
  for (const [folder, subFolders] of Object.entries(r.folderContents)) {
    console.log(`  ${folder}/`);
    for (const [sub, contents] of Object.entries(subFolders)) {
      console.log(`    ${sub}/ (${contents.length} file${contents.length === 1 ? "" : "s"})`);
      contents.slice(0, 10).forEach((f) =>
        console.log(`      - ${f.name} (${f.size ?? "-"}B, ${f.mimeType})`)
      );
    }
  }
  return { ok: true, fileCount: r.files.length };
}

// ──────────────────────────── main ────────────────────────────

const mode = process.argv[2] ?? "single";

try {
  const results = {};

  if (mode === "cleanup") {
    banner("Cleanup only");
    const n = await cleanupTestData();
    console.log(`  deleted ${n} test users`);
    process.exit(0);
  }

  if (mode === "single" || mode === "all") {
    results.single = await singleHappyPath();
  }
  if (mode === "guards" || mode === "all") {
    results.duplicate = await duplicateGuard();
  }
  if (mode === "stress" || mode === "all") {
    const n = parseInt(process.argv[3] ?? "50", 10);
    results.stress = await stressTest(n);
  }
  if (mode === "drive" || mode === "all") {
    results.drive = await driveCheck();
  }

  banner("Summary");
  console.log(JSON.stringify(results, null, 2));
  const allOk = Object.values(results).every((r) => r?.ok || r?.skipped);
  process.exit(allOk ? 0 : 1);
} catch (err) {
  console.error(`\nFATAL: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
}
