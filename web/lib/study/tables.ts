/**
 * Starter study tables (row 164: window, 2-seat, 4-seat, couch; plus outdoor).
 * Data-driven so David's interior layout can move them without code: the
 * island agent maps `anchor` to seat props. Seeded by 20260926150500_study.sql, then by the generated
 * `study-tables` block (lib/study/seed.ts, lib/seedMigrations.ts).
 */
import type { StudyTable } from "./store";

const T = (n: number, slug: string, label: string, location: string, kind: StudyTable["kind"], seats: number): StudyTable => ({
  id: `00000000-0000-4000-8000-0000000051${String(n).padStart(2, "0")}`, slug, label, location, anchor: `study:${slug}`, kind, seats,
  host_id: null, is_private: false, allowed: [], position: n,
});

export const DEFAULT_TABLES: StudyTable[] = [
  // The premium café (cafe-polish §7, row 270): window stools, tables for two and four, a booth, a communal table.
  T(1, "cafe-window-1", "Window bar 1", "cafe", "window", 2),
  T(2, "cafe-window-2", "Window bar 2", "cafe", "window", 2),
  T(3, "cafe-two-1", "Table for two", "cafe", "two", 2),
  T(4, "cafe-two-2", "Corner table for two", "cafe", "two", 2),
  T(5, "cafe-four-1", "Table for four", "cafe", "four", 4),
  T(6, "cafe-four-2", "Communal table", "cafe", "four", 4),
  T(7, "cafe-couch", "Booth", "cafe", "couch", 4),
  T(8, "plaza-picnic", "Plaza picnic table", "outdoor-plaza", "outdoor", 4),
  T(9, "pier-bench", "Pier table", "outdoor-pier", "outdoor", 2),
];
