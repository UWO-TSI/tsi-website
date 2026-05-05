// PM + Advisor essay rewrite per David's finalized prompts.
// PM gets one reflection prompt with two lenses (developer-last-year
// vs returning-PM); applicants answer the one that fits.
// Advisor gets the open-ended idea prompt with the example list.

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
  "pm-internal": [
    {
      id: "pm-int-1",
      question:
        "You spent this past year as a developer on a TSI project. Looking back, what are the things your PM could have done better, and how would you do it differently when it's your turn? If you are a returning PM, what are the things you could have done better as a PM last year, and how would you do it differently this year?",
      max_words: 500,
    },
  ],
  advisor: [
    {
      id: "adv-1",
      question:
        "What are the idea(s), program(s), or initiative(s) you want to build and implement as an Advisor next year that would make TSI better? You can either bring your own idea or choose from the list below. Ideas can be small or big in scale; what matters is that it creates change and impact.\n\nExamples of ideas:\n- Build out TSI's internal systems\n- Develop a TSI Alumni Network on the website\n- Create a training program for new PMs and developers\n- Running a bi-weekly or monthly workshop series (technical, career, leadership, you pick)\n- Develop hardware project training (train incoming hardware devs and PMs)\n- Automate TSI's grants application process\n- Make a TSI rap song/album/beat\n- Or something else entirely, bring your own idea",
      max_words: 500,
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
  console.log(`✓ ${slug}: ${essays.length} essay`);
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
    const oneLine = e.question.replace(/\n/g, " | ");
    console.log(`  - ${oneLine.slice(0, 120)}…  (max ${e.max_words}w)`);
  }
}
