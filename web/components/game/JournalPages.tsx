/**
 * A journal page from /api/collections/journal (specs/peaceful-loop.md §1, decisions 203, 66): one page per category.
 * Known entries carry catch details and personal records; unknown ones only clues (never the name).
 */
import type { Category } from "@/lib/collections/roster";
import type { JournalPage } from "@/lib/collections/logic";
import { apiCall } from "@/lib/apiClient";

type Page = JournalPage & { categories: { category: Category; total: number; discovered: number }[] };

export function fetchJournalPage(category: Category): Promise<Page | null> {
  return apiCall<Page>(`/api/collections/journal?category=${category}`, "page").then(p => p ?? null, () => null);
}
