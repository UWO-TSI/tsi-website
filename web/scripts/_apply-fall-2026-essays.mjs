// Fall 2026 round: write the essay questions for VP Marketing + PM and open
// the round. Migration 027 lands both rows inactive on purpose (David,
// 2026-09-05: hold until the real questions are in). Run once with David's
// questions filled in below:
//   node scripts/_apply-fall-2026-essays.mjs
// Re-runnable: same UPDATE every time. To close/reopen later use
// scripts/_toggle-apps-open.mjs.

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

// PM questions are placeholders until David's fall questions replace them.
const ESSAYS = {
  // Video & Content posting ("Hiring Descriptions" → Polished). The answer
  // is the creative-piece upload; the text box is for a link or a line.
  "vp-marketing": [
    {
      id: "vp-mkt-f26-1",
      question:
        "Show don't tell. Submit a video or reel that makes the case for why you're the one for this role.",
      max_words: 60,
    },
  ],
  pm: [
    {
      id: "pm-f26-1",
      question:
        "Tell us about a time you led a team through a hard project. What did you own, what did you delegate, and what would you do differently?",
      max_words: 400,
    },
    {
      id: "pm-f26-2",
      question:
        "Walk us through your most impressive technical project. What did you build, what was your role, and what did you learn?",
      max_words: 400,
    },
  ],
};

for (const [slug, essays] of Object.entries(ESSAYS)) {
  const { data, error } = await admin
    .from("positions")
    .update({ essay_questions: essays, is_active: true })
    .eq("slug", slug)
    .select("slug");
  if (error) {
    console.error(`✗ ${slug}: ${error.message}`);
    process.exit(1);
  }
  if (!data?.length) {
    console.error(`✗ ${slug}: no row. Apply migration 027 first.`);
    process.exit(1);
  }
  console.log(`✓ ${slug}: ${essays.length} essay${essays.length === 1 ? "" : "s"}, active`);
}

console.log("\n=== Verify ===");
const { data: rows } = await admin
  .from("positions")
  .select("slug, is_active, opens_at, closes_at, essay_questions")
  .in("slug", Object.keys(ESSAYS))
  .order("slug");
for (const r of rows ?? []) {
  console.log(`\n${r.slug}  active=${r.is_active}  ${r.opens_at} → ${r.closes_at}`);
  for (const e of r.essay_questions) {
    console.log(`  - ${e.question.slice(0, 80)}…  (max ${e.max_words}w)`);
  }
}
