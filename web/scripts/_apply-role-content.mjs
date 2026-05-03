// Updates DB-stored description (used on the position list cards)
// and essay_questions per the finalized role outline.

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

const DESCRIPTIONS = {
  "vp-external":
    "The face of TSI to the world. Build the partnerships that power our projects and lead GENESIS Project Showcase end-to-end.",
  "vp-internal":
    "The heartbeat of TSI. Keep the community alive, the calendar full, and make sure everyone feels like they belong here.",
  "vp-marketing":
    "Own TSI's creative vision — from posts that stop the scroll to videos that tell our story. Mastery of one craft over jack-of-all-trades.",
};

// Essay questions — kept lightweight. VP Marketing gets an extra
// "share your work" prompt to support the show-don't-tell ask.
const ESSAYS = {
  "vp-external": [
    {
      id: "vp-ext-1",
      question:
        "Walk us through a time you secured a partnership, sponsorship, or a meaningful 'yes' from someone outside your circle. How did you approach it, and what would you do differently?",
      max_words: 400,
    },
    {
      id: "vp-ext-2",
      question:
        "GENESIS is TSI's biggest event of the year. If you ran it, what's one thing you'd change or add — and why?",
      max_words: 300,
    },
  ],
  "vp-internal": [
    {
      id: "vp-int-1",
      question:
        "Tell us about an event, group, or community you've helped build. What did you do, and what made it work?",
      max_words: 400,
    },
    {
      id: "vp-int-2",
      question:
        "It's October and TSI hasn't had a social in three weeks. Your move?",
      max_words: 250,
    },
  ],
  "vp-marketing": [
    {
      id: "vp-mkt-1",
      question:
        "Pick one craft (design, video, photo, content) and tell us what makes you elite at it. Specific examples beat adjectives.",
      max_words: 400,
    },
    {
      id: "vp-mkt-2",
      question:
        "Show us, don't just tell us. Paste a link to one creative piece — in whatever medium is your strength — that makes the case for why you're the one for this role.",
      max_words: 80,
    },
  ],
};

for (const [slug, description] of Object.entries(DESCRIPTIONS)) {
  const { error } = await admin
    .from("positions")
    .update({
      description,
      essay_questions: ESSAYS[slug],
    })
    .eq("slug", slug);
  if (error) {
    console.error(`✗ ${slug}: ${error.message}`);
    process.exit(1);
  }
  console.log(`✓ ${slug}: description + ${ESSAYS[slug].length} essays`);
}

// Verify
console.log("\n=== Verify ===");
const { data: rows } = await admin
  .from("positions")
  .select("slug, description, essay_questions")
  .in("slug", ["vp-external", "vp-internal", "vp-marketing"])
  .order("slug");
for (const r of rows) {
  console.log(`\n${r.slug}`);
  console.log(`  description: ${r.description.slice(0, 100)}…`);
  console.log(`  essays: ${r.essay_questions.length}`);
  for (const e of r.essay_questions) {
    console.log(`    - "${e.question.slice(0, 60)}…" (max ${e.max_words}w)`);
  }
}
