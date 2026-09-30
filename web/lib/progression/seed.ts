/** SQL seed for the seasonal goals (kept verbatim in 20260929120000_seasonal_events.sql by scripts/gen-seeds.mjs). */
import { SEASONAL_GOALS } from "./defaults";
import { arr, q } from "@/lib/collections/seed";

export const SEED_BEGIN = "-- BEGIN GENERATED SEASONAL GOALS (web/scripts/gen-seeds.mjs)";
export const SEED_END = "-- END GENERATED SEASONAL GOALS";

export function seasonalGoalsSql(): string {
  const rows = SEASONAL_GOALS.map((g) =>
    `  (${[q(g.slug), q(g.title), q(g.summary), q(g.goal_type), g.target_points, arr(g.accepts), q(g.window_start), q(g.window_end), arr(g.unlocks), q(g.monument_key),
      q(g.completion_letter_subject), q(g.completion_letter_body), g.position, `${q(JSON.stringify(g.event))}::jsonb`].join(", ")})`);
  return [
    SEED_BEGIN,
    "INSERT INTO club_goals (slug, title, summary, goal_type, target_points, accepts, window_start, window_end, unlocks, monument_key,",
    "  completion_letter_subject, completion_letter_body, position, event) VALUES",
    rows.join(",\n"),
    "ON CONFLICT (slug) DO NOTHING;",
    SEED_END,
  ].join("\n");
}
