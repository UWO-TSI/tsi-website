// Verifies the 3-per-minute rate limit on /api/applications.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

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

const testEmail = `rate-test-${Date.now()}@tethos-test.dev`;
const { data: u, error: createErr } = await admin.auth.admin.createUser({
  email: testEmail,
  password: "TestPassword12345!",
  email_confirm: true,
});
if (createErr) {
  console.error(createErr.message);
  process.exit(1);
}
const userId = u.user.id;

const userClient = createClient(SUPA_URL, ANON_KEY);
const { data: signIn } = await userClient.auth.signInWithPassword({
  email: testEmail,
  password: "TestPassword12345!",
});

const projectRef = SUPA_URL.match(/https:\/\/([^.]+)/)[1];
const sessionJson = JSON.stringify({
  access_token: signIn.session.access_token,
  refresh_token: signIn.session.refresh_token,
  expires_in: signIn.session.expires_in,
  expires_at: signIn.session.expires_at,
  token_type: "bearer",
  user: signIn.user,
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

// Find 3 active positions
const { data: positions } = await admin
  .from("positions")
  .select("id, slug")
  .eq("is_active", true);
console.log("Active positions:", positions.map((p) => p.slug));

if (positions.length < 4) {
  console.log(
    "Note: only 3 positions active. Will hit duplicate (409) before rate limit (429)."
  );
}

const submitted = [];
for (let i = 0; i < 4; i++) {
  const pos = positions[i % positions.length];
  const res = await fetch(`${APP_URL}/api/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookieHeader },
    body: JSON.stringify({
      user_id: userId,
      position_id: pos.id,
      full_name: "Rate Tester",
      email: testEmail,
      phone: "555-1234",
      program_major: "SE",
      year_of_study: 4,
      heard_about_us: "Other",
      essay_answers: [],
    }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(
    `Attempt ${i + 1} → ${pos.slug}: status=${res.status} ${body.error ?? "OK"}`
  );
  if (res.ok) submitted.push(body.id);
}

// Cleanup
if (submitted.length > 0) {
  await admin.from("applications").delete().in("id", submitted);
}
await admin.auth.admin.deleteUser(userId);
console.log("Cleaned up.");
