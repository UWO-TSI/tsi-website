// Activate the two invite-only positions for the 2026-27 cycle
// (pm-internal + advisor) and set a shared access code.

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

const ACCESS_CODE = "tsi-alumni-2026";

const UPDATES = {
  "pm-internal": {
    description:
      "CEO of your own project. Lead a team of developers building real software for nonprofit clients, from kickoff to delivery at GENESIS.",
    essay_questions: [
      {
        id: "pm-int-1",
        question:
          "Tell us about a time you led a team through a hard project. What did you own, what did you delegate, and what would you do differently?",
        max_words: 400,
      },
      {
        id: "pm-int-2",
        question:
          "Walk us through your most impressive technical project. What did you build, what was your role, and what did you learn?",
        max_words: 400,
      },
    ],
  },
  advisor: {
    description:
      "Active board-of-advisors role for past members. Bring an idea, build it, shape where TSI goes next.",
    essay_questions: [
      {
        id: "adv-1",
        question:
          "What's the one concrete idea you want to bring to TSI as an Advisor — and how would you actually build it?",
        max_words: 400,
      },
      {
        id: "adv-2",
        question:
          "What was your most impactful contribution during your time at TSI, and what would you do differently if you started over?",
        max_words: 300,
      },
    ],
  },
};

for (const [slug, payload] of Object.entries(UPDATES)) {
  const { error } = await admin
    .from("positions")
    .update({
      ...payload,
      is_active: true,
      visibility: "internal",
      access_code: ACCESS_CODE,
      opens_at: "2026-05-04T00:00:00Z",
      closes_at: "2026-05-31T23:59:59Z",
    })
    .eq("slug", slug);
  if (error) {
    console.error(`✗ ${slug}: ${error.message}`);
    process.exit(1);
  }
  console.log(`✓ ${slug}: active, internal, code=${ACCESS_CODE}`);
}

// Verify
console.log("\n=== Verify ===");
const { data: rows } = await admin
  .from("positions")
  .select("slug, is_active, visibility, access_code, opens_at, closes_at")
  .in("slug", ["pm-internal", "advisor"])
  .order("slug");
console.table(rows);

// And confirm public list still has only the 3 VPs
console.log("\n=== Public-only positions ===");
const { data: pubRows } = await admin
  .from("positions")
  .select("slug, visibility, is_active")
  .eq("visibility", "public")
  .eq("is_active", true)
  .order("slug");
console.table(pubRows);

console.log(`\nAccess code: ${ACCESS_CODE}`);
console.log("Share this with past TSI members — entry path: /student/apply/internal");
