"use client";

/**
 * Journal pages inside the Collection book (specs/peaceful-loop.md §1,
 * decisions 203, 66): one page per category from /api/collections/journal.
 * Known entries show catch details and personal records; unknown ones show
 * only a silhouette and habitat/time/weather clues (never the name).
 */
import { useEffect, useState } from "react";
import type { Category } from "@/lib/collections/roster";
import type { JournalEntryKnown, JournalEntryUnknown, JournalPage } from "@/lib/collections/logic";
import { useMenuTab } from "@/lib/game/useMenuTab";
import { apiCall } from "@/lib/apiClient";

const LABEL: Record<Category, string> = { fish: "Fish", sea: "Sea floor", bug: "Bugs", fruit: "Fruit", nature: "Nature", mineral: "Rocks & ore" };
const RARITY_COLOR: Record<string, string> = { common: "#8A9A7B", uncommon: "#3D8F52", rare: "#2F6FB5", epic: "#8A4FC2", legendary: "#D08A1E" };
type Page = JournalPage & { categories: { category: Category; total: number; discovered: number }[] };

export function fetchJournalPage(category: Category): Promise<Page | null> {
  return apiCall<Page>(`/api/collections/journal?category=${category}`, "page").then(p => p ?? null, () => null);
}

export default function JournalPages({ initial }: { initial: Page }) {
  const [page, setPage] = useState<Page>(initial);
  const [category, setCategory] = useState<Category>(initial.category);
  const [open, setOpen] = useState<number | null>(null);
  useMenuTab(true, page.categories.map(c => c.category), category, setCategory);
  useEffect(() => {
    if (category === page.category) return;
    let alive = true;
    void fetchJournalPage(category).then(p => { if (alive && p) { setPage(p); setOpen(null); } });
    return () => { alive = false; };
  }, [category, page.category]);
  const detail = page.entries.find(e => e.slot === open);
  return <div data-testid="journal-pages">
    <div role="tablist" aria-label="Journal pages" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
      {page.categories.map(c => <button key={c.category} role="tab" aria-selected={c.category === category} onClick={() => setCategory(c.category)}
        style={{ padding: "5px 10px", borderRadius: 999, border: "1px solid #D8CBAA", background: c.category === category ? "#4A6B52" : "#FFF8E7", color: c.category === category ? "#FFFDF5" : "#4A4034", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
        {LABEL[c.category]} <span style={{ opacity: 0.75 }}>{c.discovered}/{c.total}</span>
      </button>)}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
      {page.entries.map(e => <button key={e.slot} onClick={() => setOpen(e.slot === open ? null : e.slot)} aria-label={e.discovered ? (e as JournalEntryKnown).name : `Undiscovered · ${e.clue}`}
        style={{ position: "relative", aspectRatio: "1", borderRadius: 10, border: `2px solid ${e.slot === open ? "#79601F" : "#EFE4C8"}`, background: e.discovered ? "#FFF8E7" : "#F1EBDD", cursor: "pointer", padding: 4, display: "grid", placeItems: "center" }}>
        {e.discovered
          ? ((e as JournalEntryKnown).icon
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={(e as JournalEntryKnown).icon!} alt="" style={{ width: "80%", height: "80%", objectFit: "contain" }} />
            : <span style={{ fontSize: 10, fontWeight: 700 }}>{(e as JournalEntryKnown).name}</span>)
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={(e as JournalEntryUnknown).silhouette} alt="" style={{ width: "80%", height: "80%", objectFit: "contain", filter: "brightness(0) opacity(0.35)" }} onError={ev => { ev.currentTarget.style.display = "none"; }} />}
        {e.available_now && <span title="Out right now" style={{ position: "absolute", top: 3, right: 3, width: 7, height: 7, borderRadius: 99, background: "#3D8F52" }} />}
        {e.discovered && (e as JournalEntryKnown).museum.donated && <span title="On display at the museum" style={{ position: "absolute", bottom: 2, right: 4, fontSize: 9 }}>🏛</span>}
      </button>)}
    </div>
    {detail && <section style={{ marginTop: 12, padding: 12, borderRadius: 12, background: "#FFF8E7", border: "1px solid #E8DCBC", fontSize: 12 }} aria-live="polite">
      {detail.discovered ? <>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14 }}>
          {(detail as JournalEntryKnown).name}
          <span style={{ fontSize: 9, textTransform: "uppercase", padding: "1px 7px", borderRadius: 999, color: "#FFFDF5", background: RARITY_COLOR[(detail as JournalEntryKnown).rarity] }}>{(detail as JournalEntryKnown).rarity}</span>
        </div>
        {(detail as JournalEntryKnown).one_liner && <p style={{ margin: "6px 0", fontStyle: "italic" }}>“{(detail as JournalEntryKnown).one_liner}”</p>}
        <p style={{ margin: "4px 0", color: "#6F624A" }}>
          Caught {(detail as JournalEntryKnown).total_collected}× · in bag {(detail as JournalEntryKnown).count}
          {(detail as JournalEntryKnown).best_size_cm !== null && <> · record {(detail as JournalEntryKnown).best_size_cm} cm</>}
        </p>
        <p style={{ margin: "4px 0", color: "#6F624A" }}>{detail.clue}</p>
        <p style={{ margin: "4px 0", color: "#6F624A" }}>{(detail as JournalEntryKnown).museum.donated ? `On display, donated by ${(detail as JournalEntryKnown).museum.by_me ? "you" : (detail as JournalEntryKnown).museum.donor_name}` : (detail as JournalEntryKnown).donatable ? "Not in the museum yet." : "The museum doesn't collect this."}</p>
      </> : <>
        <div style={{ fontWeight: 700, fontSize: 14 }}>Undiscovered</div>
        <p style={{ margin: "6px 0", color: "#6F624A" }}>{detail.clue}</p>
        <p style={{ margin: 0, color: "#6F624A" }}>{detail.available_now ? "Out right now." : detail.later_today ? "Out later today." : "Not out right now."}</p>
      </>}
    </section>}
  </div>;
}
