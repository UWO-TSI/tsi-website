// E2E test: signup → upload → submit application → verify
// Runs against the local dev server (localhost:3001 or :3000) using
// service role to set up a throwaway user.

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";

const env = readFileSync(".env.local", "utf8")
  .split("\n")
  .reduce((acc, line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) acc[m[1].trim()] = m[2].trim();
    return acc;
  }, {});

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SVC_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.APP_URL || "http://localhost:3001";

const admin = createClient(SUPA_URL, SVC_KEY, {
  auth: { persistSession: false },
});

function log(label, value) {
  console.log(`\n— ${label}`);
  if (value !== undefined) console.log(value);
}

// Throwaway test user
const testEmail = `apply-test-${Date.now()}@tethos-test.dev`;
const testPassword = "TestPassword12345!";

// ──────────────────────────────────────────────
// 1. Create test user via admin
// ──────────────────────────────────────────────
log("Creating test user", testEmail);
const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
  email: testEmail,
  password: testPassword,
  email_confirm: true,
  user_metadata: { full_name: "Test Applicant" },
});
if (createErr) {
  console.error("FAIL:", createErr.message);
  process.exit(1);
}
const userId = createdUser.user.id;
console.log("user_id:", userId);

// ──────────────────────────────────────────────
// 2. Sign in as user (browser-equivalent)
// ──────────────────────────────────────────────
const userClient = createClient(SUPA_URL, ANON_KEY);
const { data: signInData, error: signInErr } =
  await userClient.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  });
if (signInErr) {
  console.error("FAIL:", signInErr.message);
  process.exit(1);
}
const accessToken = signInData.session.access_token;
const refreshToken = signInData.session.refresh_token;
log("Signed in", `access_token length=${accessToken.length}`);

// ──────────────────────────────────────────────
// 3. Fetch positions (public)
// ──────────────────────────────────────────────
log("GET /api/positions");
const posRes = await fetch(`${APP_URL}/api/positions`);
if (!posRes.ok) {
  console.error("FAIL:", posRes.status);
  process.exit(1);
}
const positions = await posRes.json();
console.log(`Got ${positions.length} positions:`, positions.map((p) => p.slug));
const targetPos = positions.find((p) => p.slug === "vp-internal");
if (!targetPos) {
  console.error("FAIL: vp-internal not in public list");
  process.exit(1);
}

// ──────────────────────────────────────────────
// 4. Get signed upload URL via /api/resume-sign
// ──────────────────────────────────────────────
log("POST /api/resume-sign (mode=upload)");

// Build cookie header from session — @supabase/ssr stores it as
// `sb-{ref}-auth-token` with `base64-` prefixed JSON, chunked across
// `.0`, `.1` cookies if longer than ~3 KB.
const projectRef = SUPA_URL.match(/https:\/\/([^.]+)/)[1];
const sessionJson = JSON.stringify({
  access_token: accessToken,
  refresh_token: refreshToken,
  expires_in: signInData.session.expires_in,
  expires_at: signInData.session.expires_at,
  token_type: "bearer",
  user: signInData.user,
});
const cookieBase = "base64-" + Buffer.from(sessionJson).toString("base64");
const CHUNK = 3180;
const cookieParts = [];
for (let i = 0; i < cookieBase.length; i += CHUNK) {
  cookieParts.push(cookieBase.slice(i, i + CHUNK));
}
const cookieHeader = cookieParts
  .map((part, i) => `sb-${projectRef}-auth-token.${i}=${part}`)
  .join("; ");

const signRes = await fetch(`${APP_URL}/api/resume-sign`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: cookieHeader,
  },
  body: JSON.stringify({
    mode: "upload",
    positionSlug: "vp-internal",
  }),
});
if (!signRes.ok) {
  const txt = await signRes.text();
  console.error("FAIL:", signRes.status, txt);
  await admin.auth.admin.deleteUser(userId);
  process.exit(1);
}
const signed = await signRes.json();
console.log("Got upload URL:", { path: signed.path, hasToken: !!signed.token });

// ──────────────────────────────────────────────
// 5. Upload a fake PDF using the signed URL
// ──────────────────────────────────────────────
log("PUT signed upload URL");
const fakePdf = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<<>>\n%%EOF",
  "binary"
);
const { error: uploadErr } = await userClient.storage
  .from("resumes")
  .uploadToSignedUrl(signed.path, signed.token, fakePdf, {
    contentType: "application/pdf",
  });
if (uploadErr) {
  console.error("FAIL:", uploadErr.message);
  await admin.auth.admin.deleteUser(userId);
  process.exit(1);
}
console.log("Uploaded fake PDF to:", signed.path);

// ──────────────────────────────────────────────
// 6. Submit application via /api/applications
// ──────────────────────────────────────────────
log("POST /api/applications");
const appRes = await fetch(`${APP_URL}/api/applications`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: cookieHeader,
  },
  body: JSON.stringify({
    user_id: userId,
    position_id: targetPos.id,
    full_name: "Test Applicant",
    email: testEmail,
    phone: "555-1234",
    program_major: "Software Engineering",
    year_of_study: 4,
    linkedin_url: null,
    heard_about_us: "Friend / Word of Mouth",
    resume_storage_path: signed.path,
    resume_filename: "test-resume.pdf",
    essay_answers: targetPos.essay_questions.map((q) => ({
      question_id: q.id,
      answer: "Test answer that satisfies the minimum requirements.",
    })),
  }),
});
const appBody = await appRes.json();
console.log("Status:", appRes.status);
console.log("Body:", JSON.stringify(appBody, null, 2).slice(0, 600));

if (!appRes.ok) {
  console.error("FAIL: submission failed");
  await admin.auth.admin.deleteUser(userId);
  process.exit(1);
}

// ──────────────────────────────────────────────
// 7. Verify application row, signed URL works
// ──────────────────────────────────────────────
log("Verify application row");
const { data: row } = await admin
  .from("applications")
  .select("*")
  .eq("id", appBody.id)
  .single();
console.log("resume_drive_url:", row.resume_drive_url?.slice(0, 80) + "…");
console.log("resume_filename:", row.resume_filename);

// Try fetching the signed URL — should return the PDF
log("Verify signed URL is reachable");
const urlRes = await fetch(row.resume_drive_url);
console.log(
  "Signed URL response:",
  urlRes.status,
  urlRes.headers.get("content-type")
);

// ──────────────────────────────────────────────
// 8. Test duplicate submission (should 409)
// ──────────────────────────────────────────────
log("Duplicate POST /api/applications (should 409)");
const dupRes = await fetch(`${APP_URL}/api/applications`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: cookieHeader,
  },
  body: JSON.stringify({
    user_id: userId,
    position_id: targetPos.id,
    full_name: "Test Applicant",
    email: testEmail,
    phone: "555-1234",
    program_major: "SE",
    year_of_study: 4,
    heard_about_us: "Other",
    resume_storage_path: signed.path,
    resume_filename: "test-resume.pdf",
    essay_answers: [],
  }),
});
console.log("Status:", dupRes.status, "(want 409)");

// ──────────────────────────────────────────────
// 9. Test unauthorized access (no cookie)
// ──────────────────────────────────────────────
log("POST /api/resume-sign without auth (should 401)");
const noAuthRes = await fetch(`${APP_URL}/api/resume-sign`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ mode: "upload", positionSlug: "vp-internal" }),
});
console.log("Status:", noAuthRes.status, "(want 401)");

// ──────────────────────────────────────────────
// 10. Test path injection attempt
// ──────────────────────────────────────────────
log("POST /api/resume-sign with crafted path (should 403)");
const evilRes = await fetch(`${APP_URL}/api/resume-sign`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Cookie: cookieHeader,
  },
  body: JSON.stringify({ mode: "view", path: "other-user/secret.pdf" }),
});
console.log("Status:", evilRes.status, "(want 403)");

// ──────────────────────────────────────────────
// Cleanup
// ──────────────────────────────────────────────
log("Cleanup");
await admin.from("applications").delete().eq("id", appBody.id);
await admin.storage.from("resumes").remove([signed.path]);
await admin.auth.admin.deleteUser(userId);
console.log("Cleaned up.");

console.log("\n✓ All e2e checks passed.");
