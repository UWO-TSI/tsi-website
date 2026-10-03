"use client";

/**
 * Journal pages inside the Collection book (specs/peaceful-loop.md §1,
 * decisions 203, 66): one page per category from /api/collections/journal.
 * Known entries show catch details and personal records; unknown ones show
 * only a silhouette and habitat/time/weather clues (never the name).
 */
import { useEffect, useState } from "react";
import { Landmark } from "lucide-react";
import type { Category } from "@/lib/collections/roster";
import type { JournalEntryKnown, JournalEntryUnknown, JournalPage } from "@/lib/collections/logic";
import { apiCall } from "@/lib/apiClient";
import { Badge, Tabs, type BadgeTone } from "@/components/gui";

const LABEL: Record<Category, string> = { fish: "Fish", sea: "Sea floor", bug: "Bugs", fruit: "Fruit", nature: "Nature", mineral: "Rocks & ore" };
/** Rarity as the GUI sheet's tags (AA; the old white-on-colour chips weren't) and the tile's edge. */
const RARITY_TONE: Record<string, BadgeTone> = { common: "neutral", uncommon: "success", rare: "info", epic: "sage", legendary: "gold" };
type Page = JournalPage & { categories: { category: Category; total: number; discovered: number }[] };

export function fetchJournalPage(category: Category): Promise<Page | null> {
  return apiCall<Page>(`/api/collections/journal?category=${category}`, "page").then(p => p ?? null, () => null);
}

export default function JournalPages({ initial }: { initial: Page }) {
  const [page, setPage] = useState<Page>(initial);
  const [category, setCategory] = useState<Category>(initial.category);
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => {
    if (category === page.category) return;
    let alive = true;
    void fetchJournalPage(category).then(p => { if (alive && p) { setPage(p); setOpen(null); } });
    return () => { alive = false; };
  }, [category, page.category]);
  const detail = page.entries.find(e => e.slot === open);
  return <div data-testid="journal-pages">
    {/* The menu's [ and ] keys step these (components/gui Tabs, inside the open book). */}
    <Tabs label="Journal pages" value={category} onChange={setCategory} className="mb-3"
      tabs={page.categories.map(c => ({ id: c.category, label: <>{LABEL[c.category]} <span style={{ fontWeight: 700, color: "var(--gui-muted)" }}>{c.discovered}/{c.total}</span></> }))} />
    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
      {page.entries.map(e => <button key={e.slot} onClick={() => setOpen(e.slot === open ? null : e.slot)} aria-label={e.discovered ? (e as JournalEntryKnown).name : `Undiscovered · ${e.clue}`}
        style={{ position: "relative", aspectRatio: "1", borderRadius: 18, border: 0, boxShadow: e.slot === open ? "inset 0 0 0 3px var(--gui-highlight)" : "inset 0 0 0 2px var(--gui-paper-edge)", background: e.slot === open ? "var(--gui-butter)" : e.discovered ? "var(--gui-paper-hi)" : "var(--gui-paper-warm)", cursor: "pointer", padding: 4, display: "grid", placeItems: "center" }}>
        {e.discovered
          ? ((e as JournalEntryKnown).icon
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={(e as JournalEntryKnown).icon!} alt="" style={{ width: "80%", height: "80%", objectFit: "contain" }} />
            : <span style={{ fontSize: "var(--gui-text-xs)", fontWeight: 800 }}>{(e as JournalEntryKnown).name}</span>)
          // eslint-disable-next-line @next/next/no-img-element
          : <img src={(e as JournalEntryUnknown).silhouette} alt="" style={{ width: "80%", height: "80%", objectFit: "contain", filter: "brightness(0) opacity(0.35)" }} onError={ev => { ev.currentTarget.style.display = "none"; }} />}
        {e.available_now && <span title="Out right now" style={{ position: "absolute", top: 4, right: 4, width: 9, height: 9, borderRadius: 99, background: "var(--gui-success)", boxShadow: "0 0 0 2px var(--gui-paper-hi)" }} />}
        {e.discovered && (e as JournalEntryKnown).museum.donated && <span title="On display at the museum" style={{ position: "absolute", bottom: 4, right: 5, display: "flex", color: "var(--gui-bark)" }}><Landmark size={13} aria-label="On display at the museum" /></span>}
      </button>)}
    </div>
    {detail && <section style={{ marginTop: 12, padding: "12px 14px", borderRadius: 18, background: "var(--gui-paper-hi)", boxShadow: "var(--gui-shadow-sm), inset 0 0 0 1.5px var(--gui-paper-edge)", fontSize: "var(--gui-text-sm)", color: "var(--gui-ink)" }} aria-live="polite">
      {detail.discovered ? <>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: "var(--gui-text-md)", color: "var(--gui-ink-strong)" }}>
          {(detail as JournalEntryKnown).name}
          <Badge tone={RARITY_TONE[(detail as JournalEntryKnown).rarity] ?? "neutral"} style={{ textTransform: "capitalize" }}>{(detail as JournalEntryKnown).rarity}</Badge>
        </div>
        {(detail as JournalEntryKnown).one_liner && <p style={{ margin: "6px 0", fontStyle: "italic" }}>“{(detail as JournalEntryKnown).one_liner}”</p>}
        <p style={{ margin: "4px 0", color: "var(--gui-ink-2)" }}>
          Caught {(detail as JournalEntryKnown).total_collected}× · in bag {(detail as JournalEntryKnown).count}
          {(detail as JournalEntryKnown).best_size_cm !== null && <> · record {(detail as JournalEntryKnown).best_size_cm} cm</>}
        </p>
        <p style={{ margin: "4px 0", color: "var(--gui-ink-2)" }}>{detail.clue}</p>
        <p style={{ margin: "4px 0", color: "var(--gui-ink-2)" }}>{(detail as JournalEntryKnown).museum.donated ? `On display, donated by ${(detail as JournalEntryKnown).museum.by_me ? "you" : (detail as JournalEntryKnown).museum.donor_name}` : (detail as JournalEntryKnown).donatable ? "Not in the museum yet." : "The museum doesn't collect this."}</p>
      </> : <>
        <div style={{ fontWeight: 800, fontSize: "var(--gui-text-md)", color: "var(--gui-ink-strong)" }}>Undiscovered</div>
        <p style={{ margin: "6px 0", color: "var(--gui-ink-2)" }}>{detail.clue}</p>
        <p style={{ margin: 0, color: "var(--gui-ink-2)" }}>{detail.available_now ? "Out right now." : detail.later_today ? "Out later today." : "Not out right now."}</p>
      </>}
    </section>}
  </div>;
}
