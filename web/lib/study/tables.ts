/**
 * Starter study tables (row 164: window, 2-seat, 4-seat, couch; plus outdoor).
 * Data-driven so David's interior layout can move them without code: the
 * island agent maps `anchor` to seat props. Mirrored in 032_study.sql's seed.
 */
import type { StudyTable } from "./store";

const T = (n: number, slug: string, label: string, location: string, kind: StudyTable["kind"], seats: number): StudyTable => ({
  id: `00000000-0000-4000-8000-0000000051${String(n).padStart(2, "0")}`, slug, label, location, anchor: `study:${slug}`, kind, seats,
  host_id: null, is_private: false, allowed: [], position: n,
});

export const DEFAULT_TABLES: StudyTable[] = [
  T(1, "cafe-window-1", "Window seat 1", "cafe", "window", 2),
  T(2, "cafe-window-2", "Window seat 2", "cafe", "window", 2),
  T(3, "cafe-two-1", "Table for two", "cafe", "two", 2),
  T(4, "cafe-two-2", "Corner table for two", "cafe", "two", 2),
  T(5, "cafe-four-1", "Big table", "cafe", "four", 4),
  T(6, "cafe-four-2", "Bookshelf table", "cafe", "four", 4),
  T(7, "cafe-couch", "Couch corner", "cafe", "couch", 3),
  T(8, "plaza-picnic", "Plaza picnic table", "outdoor-plaza", "outdoor", 4),
  T(9, "pier-bench", "Pier table", "outdoor-pier", "outdoor", 2),
];
