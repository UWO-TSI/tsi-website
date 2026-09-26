// Real-DB end-to-end for the fall 2026 round. Run against a server started
// with sheet sync + email disabled:
//   GOOGLE_DRIVE_CREDENTIALS= GOOGLE_SHEETS_SPREADSHEET_ID= RESEND_API_KEY= npx next start -p 3100
//   APP_URL=http://localhost:3100 node scripts/_e2e-fall-2026.mjs
// Creates two throwaway applicants (pm, vp-marketing), submits through
// /api/resume-sign + /api/applications, checks the admin API with a real
// admin session (magic link for ADMIN_EMAIL), screenshots admin + dashboard,
// then deletes everything it created and revokes the admin session.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { chromium } from "/opt/homebrew/lib/node_modules/playwright/index.mjs";

const env = readFileSync(".env.local", "utf8").split("\n").reduce((a, l) => { const m = l.match(/^([^=]+)=(.*)$/); if (m) a[m[1].trim()] = m[2].trim(); return a; }, {});
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.APP_URL || "http://localhost:3100";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "davidliu8473@gmail.com";
const OUT = process.env.OUT || "/tmp";
const REF = SUPA_URL.match(/https:\/\/([^.]+)/)[1];
const admin = createClient(SUPA_URL, SVC, { auth: { persistSession: false } });
const results = [];
const ok = (name, pass, detail = "") => { results.push({ name, pass, detail }); console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? "  · " + detail : ""}`); };
const cookieFor = (session) => {
  const json = JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token, expires_in: session.expires_in, expires_at: session.expires_at, token_type: "bearer", user: session.user });
  const b = "base64-" + Buffer.from(json).toString("base64");
  const parts = []; for (let i = 0; i < b.length; i += 3180) parts.push(b.slice(i, i + 3180));
  return parts.map((p, i) => ({ name: `sb-${REF}-auth-token.${i}`, value: p }));
};
const cookieHeader = (cs) => cs.map((c) => `${c.name}=${c.value}`).join("; ");
const created = { users: [], apps: [], paths: [] };
let adminToken = null;

try {
  const positions = await (await fetch(`${APP_URL}/api/positions`)).json();
  ok("public positions = pm + vp-marketing", Array.isArray(positions) && positions.map((p) => p.slug).sort().join(",") === "pm,vp-marketing", JSON.stringify(positions.map((p) => [p.slug, p.title])));

  const applicants = {};
  for (const slug of ["pm", "vp-marketing"]) {
    const pos = positions.find((p) => p.slug === slug);
    const email = `e2e-${slug}-${Date.now()}@tethos-test.dev`, password = "E2e-Password-12345!";
    const { data: cu, error: ce } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `E2E ${slug}` } });
    if (ce) throw new Error("createUser: " + ce.message);
    created.users.push(cu.user.id);
    const uc = createClient(SUPA_URL, ANON, { auth: { persistSession: false } });
    const { data: si, error: se } = await uc.auth.signInWithPassword({ email, password });
    if (se) throw new Error("signIn: " + se.message);
    const cookies = cookieFor(si.session);
    const sign = await fetch(`${APP_URL}/api/resume-sign`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookieHeader(cookies) }, body: JSON.stringify({ mode: "upload", positionSlug: slug }) });
    ok(`${slug}: resume-sign`, sign.ok, String(sign.status));
    const signed = await sign.json();
    const pdf = Buffer.from("%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<<>>\n%%EOF");
    const { error: ue } = await uc.storage.from("resumes").uploadToSignedUrl(signed.path, signed.token, pdf, { contentType: "application/pdf" });
    ok(`${slug}: resume upload`, !ue, ue?.message ?? signed.path);
    created.paths.push(signed.path);
    const essays = pos.essay_questions.map((q) => ({ question_id: q.id, answer: slug === "vp-marketing" ? "https://youtu.be/e2e-test" : `E2E answer for ${q.id}. `.repeat(5) }));
    if (slug === "vp-marketing") essays.push({ question_id: "__creative_piece_files", answer: JSON.stringify([{ path: `${cu.user.id}/vp-marketing-creative/e2e.mp4`, filename: "e2e.mp4" }]) });
    const res = await fetch(`${APP_URL}/api/applications`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookieHeader(cookies) }, body: JSON.stringify({ user_id: cu.user.id, position_id: pos.id, full_name: `E2E ${slug}`, email, phone: "555-0100", program_major: "Software Engineering", year_of_study: 3, linkedin_url: null, heard_about_us: "Instagram", resume_storage_path: signed.path, resume_filename: "resume.pdf", essay_answers: essays }) });
    const body = await res.json().catch(() => ({}));
    ok(`${slug}: POST /api/applications`, res.status === 201, `${res.status} ${body.error ?? body.id ?? ""}`);
    if (body.id) created.apps.push(body.id);
    const dup = await fetch(`${APP_URL}/api/applications`, { method: "POST", headers: { "Content-Type": "application/json", Cookie: cookieHeader(cookies) }, body: JSON.stringify({ user_id: cu.user.id, position_id: pos.id, full_name: "x", email, phone: "", program_major: "x", year_of_study: 3, heard_about_us: "Other", essay_answers: [] }) });
    ok(`${slug}: duplicate submit rejected`, dup.status === 409, String(dup.status));
    const { data: row } = await admin.from("applications").select("id, status, resume_drive_url, position:positions(slug, title)").eq("id", body.id).maybeSingle();
    ok(`${slug}: row in DB with position join`, !!row && row.position?.slug === slug && row.status === "screening", JSON.stringify(row && { status: row.status, slug: row.position?.slug }));
    applicants[slug] = { cookies, userId: cu.user.id, appId: body.id };
  }

  // Admin session via magic link (no password involved).
  const { data: link, error: le } = await admin.auth.admin.generateLink({ type: "magiclink", email: ADMIN_EMAIL });
  if (le) throw new Error("generateLink: " + le.message);
  const ac = createClient(SUPA_URL, ANON, { auth: { persistSession: false } });
  const { data: ver, error: ve } = await ac.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (ve) throw new Error("verifyOtp: " + ve.message);
  adminToken = ver.session.access_token;
  const adminCookies = cookieFor(ver.session);
  const list = await fetch(`${APP_URL}/api/applications`, { headers: { Cookie: cookieHeader(adminCookies) } });
  const apps = await list.json();
  ok("admin GET /api/applications", list.ok && Array.isArray(apps), `${list.status}, ${Array.isArray(apps) ? apps.length : "?"} rows`);
  const hasArchivedCol = Array.isArray(apps) && apps.some((a) => a.position && "archived_at" in a.position);
  const archived = Array.isArray(apps) ? apps.filter((a) => a.position?.archived_at).length : 0;
  const live = Array.isArray(apps) ? apps.length - archived : 0;
  ok("migration 028 applied (positions.archived_at present)", hasArchivedCol, hasArchivedCol ? `${archived} archived · ${live} live` : "column missing: May rows will show as live until 028 runs");
  ok("both test apps visible to admin", Array.isArray(apps) && created.apps.every((id) => apps.some((a) => a.id === id)));
  const patch = await fetch(`${APP_URL}/api/applications/${applicants.pm.appId}`, { method: "PATCH", headers: { "Content-Type": "application/json", Cookie: cookieHeader(adminCookies) }, body: JSON.stringify({ draft_status: "interview_invite" }) });
  const { data: after } = await admin.from("applications").select("status, draft_status").eq("id", applicants.pm.appId).maybeSingle();
  ok("admin PATCH draft verdict (not released)", patch.ok && after?.draft_status === "interview_invite" && after?.status === "screening", `${patch.status} ${JSON.stringify(after)}`);
  const anon = await fetch(`${APP_URL}/api/applications`);
  ok("anonymous GET /api/applications forbidden", anon.status === 401 || anon.status === 403, String(anon.status));

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  await ctx.addCookies(adminCookies.map((c) => ({ ...c, domain: "localhost", path: "/" })));
  const page = await ctx.newPage();
  await page.goto(`${APP_URL}/admin/recruit`, { waitUntil: "domcontentloaded" });
  const gotList = await page.getByText("E2E pm").first().waitFor({ timeout: 45000 }).then(() => true).catch(() => false);
  ok("admin page renders live list with test applicants", gotList);
  const header = await page.locator("h1").first().locator("..").innerText().catch(() => "");
  console.log("      header:", header.replace(/\s+/g, " ").slice(0, 120));
  const archivePanel = await page.getByText("Archived rounds").isVisible().catch(() => false);
  ok("archive panel present", archivePanel, archivePanel ? "" : "expected only after 028");
  if (archivePanel) { await page.getByRole("button", { name: /Archived rounds/ }).click(); await page.waitForTimeout(600); }
  await page.screenshot({ path: `${OUT}/e2e-admin.png`, fullPage: true });
  await ctx.close();
  const uctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await uctx.addCookies(applicants.pm.cookies.map((c) => ({ ...c, domain: "localhost", path: "/" })));
  const dash = await uctx.newPage();
  await dash.goto(`${APP_URL}/student/apply/dashboard`, { waitUntil: "domcontentloaded" });
  const dashOk = await dash.getByText("Project Manager").first().waitFor({ timeout: 45000 }).then(() => true).catch(() => false);
  const dashText = dashOk ? (await dash.locator("body").innerText()).toLowerCase() : "";
  ok("applicant dashboard shows the application with role title", dashOk);
  ok("applicant sees released status only (screening, no 'invite')", dashOk && dashText.includes("screening") && !dashText.includes("invite"));
  await dash.screenshot({ path: `${OUT}/e2e-dashboard.png`, fullPage: true });
  await browser.close();
} catch (e) {
  ok("run completed", false, e.message);
} finally {
  console.log("\n— cleanup");
  if (created.apps.length) { const { error } = await admin.from("applications").delete().in("id", created.apps); console.log("  applications deleted:", error ? error.message : created.apps.length); }
  if (created.paths.length) { const { error } = await admin.storage.from("resumes").remove(created.paths); console.log("  resumes removed:", error ? error.message : created.paths.length); }
  for (const id of created.users) { const { error } = await admin.auth.admin.deleteUser(id); console.log("  user deleted:", error ? error.message : id); }
  if (adminToken) { const { error } = await admin.auth.admin.signOut(adminToken); console.log("  admin session revoked:", error ? error.message : "yes"); }
  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}
