// Updated essay questions per David's finalized prompts (May 4 cycle).
// PM and Advisor essays unchanged. Profile fields (other_links,
// commitments_next_year) live in essay_answers under reserved IDs and
// are populated by the form, not by these prompts.

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

const ESSAYS = {
  "vp-external": [
    {
      id: "vp-ext-1",
      question:
        "Walk us through how you'd personally stay on top of everything as VP External. What does your system look like (e.g. tools, habits, routines)?",
      max_words: 400,
    },
    {
      id: "vp-ext-2",
      question:
        "As VP External, you will need to secure nonprofit clients during the summer for the upcoming project cycle. You have no warm leads yet. Walk us through exactly what you do. Where do you start, how do you find organizations, how do you reach out, and how do you close the partnership? Be specific.",
      max_words: 500,
    },
    {
      id: "vp-ext-3",
      question:
        "GENESIS Project Showcase is TSI's biggest event of the year. In your opinion, what didn't land the way it should have, and what would you fix or do completely differently for GENESIS 2027? Walk us through your ideas and how you'd actually make it happen.",
      max_words: 500,
    },
  ],
  "vp-internal": [
    {
      id: "vp-int-1",
      question:
        "Plan the TSI Summer Cottage Trip. We're taking 15–20 people to a cottage near Toronto for 2 nights, 3 days (leave on day 3). Budget is $100–$150 per person. Put together an actual planning doc with Airbnb or cottage links, a full day-by-day itinerary, activities, games, food plan, driving plan, interest form links, budget spreadsheets, and anything else you'd need to make it a trip people actually show up for. The more detailed and ready-to-execute, the better. Treat it like you're actually running it.",
      max_words: 60,
    },
  ],
  "vp-marketing": [
    {
      id: "vp-mkt-1",
      question:
        "Show, don't tell. Submit a creative piece, in whatever medium is your strength (design, video, etc.), that makes the case for why you're the one for this role.",
      max_words: 60,
    },
  ],
};

for (const [slug, essays] of Object.entries(ESSAYS)) {
  const { error } = await admin
    .from("positions")
    .update({ essay_questions: essays })
    .eq("slug", slug);
  if (error) {
    console.error(`✗ ${slug}: ${error.message}`);
    process.exit(1);
  }
  console.log(`✓ ${slug}: ${essays.length} essay${essays.length === 1 ? "" : "s"}`);
}

console.log("\n=== Verify ===");
const { data: rows } = await admin
  .from("positions")
  .select("slug, essay_questions")
  .in("slug", Object.keys(ESSAYS))
  .order("slug");
for (const r of rows ?? []) {
  console.log(`\n${r.slug}`);
  for (const e of r.essay_questions) {
    console.log(`  - ${e.question.slice(0, 80)}…  (max ${e.max_words}w)`);
  }
}
