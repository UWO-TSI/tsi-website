// Applies the data half of migration 027 through the service-role API
// (the SQL editor was not an option on 2026-09-05; the DDL in 026/028 still
// needs it). Same end state as 027 and safe to re-run:
//   1. every position inactive
//   2. May's `vp-marketing` row retired as `vp-marketing-may26`
//   3. fresh fall `vp-marketing` row (inactive)
//   4. `pm-general` renamed to `pm` and refreshed (inactive)
// Then: scripts/_fall-2026-test-mode.mjs on   (David tests, internal-only)
//       scripts/_apply-fall-2026-essays.mjs   (questions + public launch)

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

const OPENS = "2026-09-05T04:00:00Z";
const CLOSES = "2026-09-12T04:10:00Z";

const FALL = {
  "vp-marketing": {
    title: "VP Marketing",
    description:
      "Responsible for the video marketing side of TSI: reels, vlogs, and mini-documentaries.",
    essay_questions: [
      {
        id: "vp-mkt-f26-1",
        question:
          "Submit a video that convinces us you're the candidate for this role.",
        max_words: 60,
      },
    ],
  },
  pm: {
    title: "Project Manager",
    description:
      "CEO of your own project. Lead a team of developers building real software for nonprofit clients, from kickoff to delivery at GENESIS.",
    essay_questions: [
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
  },
};

const fail = (step, error) => {
  console.error(`✗ ${step}: ${error.message}`);
  process.exit(1);
};

// 1. Everything goes dark.
{
  const { error } = await admin.from("positions").update({ is_active: false }).neq("slug", "");
  if (error) fail("deactivate", error);
  console.log("✓ all positions inactive");
}

// 2. Retire May's VP Marketing row (guarded: only if not already retired).
{
  const { data: retired } = await admin.from("positions").select("id").eq("slug", "vp-marketing-may26").maybeSingle();
  if (!retired) {
    const { data: may } = await admin.from("positions").select("id, created_at").eq("slug", "vp-marketing").maybeSingle();
    if (may && new Date(may.created_at) < new Date("2026-09-01")) {
      const { error } = await admin
        .from("positions")
        .update({ slug: "vp-marketing-may26", title: "VP Marketing (May 2026)" })
        .eq("id", may.id);
      if (error) fail("retire vp-marketing", error);
      console.log("✓ May vp-marketing → vp-marketing-may26");
    } else {
      console.log("· no May vp-marketing row to retire");
    }
  } else {
    console.log("· vp-marketing-may26 already exists");
  }
}

// 4a. pm-general → pm (only if pm doesn't exist yet).
{
  const { data: pm } = await admin.from("positions").select("id").eq("slug", "pm").maybeSingle();
  if (!pm) {
    const { data, error } = await admin.from("positions").update({ slug: "pm" }).eq("slug", "pm-general").select("id");
    if (error) fail("rename pm-general", error);
    console.log(data?.length ? "✓ pm-general → pm" : "· no pm-general row; pm will be inserted");
  } else {
    console.log("· pm already exists");
  }
}

// 3 + 4b. Upsert both fall rows, inactive.
for (const [slug, row] of Object.entries(FALL)) {
  const { error } = await admin.from("positions").upsert(
    {
      slug,
      ...row,
      phase: 1,
      visibility: "public",
      access_code: null,
      opens_at: OPENS,
      closes_at: CLOSES,
      is_active: false,
    },
    { onConflict: "slug" }
  );
  if (error) fail(`upsert ${slug}`, error);
  console.log(`✓ ${slug} upserted (inactive)`);
}

const { data: rows } = await admin
  .from("positions")
  .select("slug, title, is_active, visibility, opens_at, closes_at")
  .order("slug");
console.table(rows);
