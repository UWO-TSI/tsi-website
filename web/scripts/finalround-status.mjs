// Who has opened, started and finished the final round, grouped by project.
//
// Usage: node scripts/finalround-status.mjs

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8")
  .split("\n")
  .reduce((acc, line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) acc[m[1].trim()] = m[2].trim();
    return acc;
  }, {});

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await db
  .from("finalround_progress")
  .select("name, project, open_count, opened_at, started_at, revealed_at, followup_sent_at")
  .neq("name", "QA Tester")
  .order("project")
  .order("name");
if (error) throw error;

const when = (t) =>
  t ? new Date(t).toLocaleString("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
const status = (r) => (r.revealed_at ? "done" : r.started_at ? "started" : r.opened_at ? "opened" : "not opened");

let project = "";
for (const r of data) {
  if (r.project !== project) {
    project = r.project;
    console.log(`\n${project}`);
  }
  const s = status(r);
  console.log(
    `  ${r.name.padEnd(26)} ${s.padEnd(11)} ${when(r.revealed_at || r.started_at || r.opened_at).padEnd(18)} ${r.followup_sent_at ? "emailed" : ""}`
  );
}
const count = (s) => data.filter((r) => status(r) === s).length;
console.log(`\n${count("done")} done, ${count("started")} started, ${count("opened")} opened, ${count("not opened")} not opened (of ${data.length})`);
