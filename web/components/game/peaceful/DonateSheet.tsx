"use client";

/**
 * Curator's donation sheet (decisions 67, 202): pick something you've found;
 * the museum takes the first of each species with your name on the plaque
 * and refuses duplicates with the curator's line. She says it herself, and a
 * yes steps the sheet aside so you see the specimen settle into its case
 * (MuseumInterior; lib/game/museumMoment.ts).
 */
import { useEffect, useState } from "react";
import { CATEGORIES, type Category } from "@/lib/collections/roster";
import type { JournalEntryKnown } from "@/lib/collections/logic";
import { fetchJournalPage } from "../JournalPages";
import { curatorLine } from "@/lib/game/peaceful";
import { newKey } from "@/lib/apiClient";
import { markDonated } from "@/lib/game/museumMoment";
import IslandSheet from "../IslandSheet";
import { Landmark } from "lucide-react";
import { Badge, Empty, List, ListRow, Loading, NameTag } from "@/components/gui";
import styles from "../DefaultIslandWorld.module.css";

const DONATABLE: Category[] = CATEGORIES.filter(c => c === "fish" || c === "sea" || c === "bug" || c === "nature");

/** The donation and the curator's line about it (and whether it went on display). */
export async function donation(key: string, name: string): Promise<{ ok: boolean; line: string }> {
  try {
    const res = await fetch("/api/collections/museum/donate", { method: "POST", headers: { "Content-Type": "application/json" },
      // One donation per species ever, so the species is the key: a retry replays.
      body: JSON.stringify({ species_key: key, idempotency_key: `donate:${key}` }) });
    const body = await res.json().catch(() => null);
    const ok = res.ok && !!body?.ok;
    return { ok, line: curatorLine(ok ? { ok: true, name } : { ok: false, code: body?.code, error: body?.error }) };
  } catch {
    return { ok: false, line: curatorLine({ ok: false, error: "The museum couldn't take that just now. Try again in a moment." }) };
  }
}
export const postDonation = async (key: string, name: string): Promise<string> => (await donation(key, name)).line;

/**
 * A hand-in to the museum's drive (m5): one more of a kind it already shows, counted for the club and for you
 * (David 2026-10-28: "this might get impossible if people donate all the stuff"). Each one is its own (a fresh key).
 */
export async function handIn(key: string, name: string): Promise<{ ok: boolean; line: string }> {
  try {
    const res = await fetch("/api/collections/museum/hand-in", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ species_key: key, idempotency_key: `hand-in:${newKey()}` }) });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.ok) return { ok: true, line: `Another ${name}! In the drive it goes, with your name on the tally.` };
    return { ok: false, line: curatorLine({ ok: false, code: body?.code, error: body?.error }) };
  } catch {
    return { ok: false, line: curatorLine({ ok: false, error: "The museum couldn't take that just now. Try again in a moment." }) };
  }
}

/** `drive`: the new world's museum drive (m5): a kind already on display can still be handed in, and counts. */
export default function DonateSheet({ open, onClose, onDonated, drive = false }: { open: boolean; onClose: () => void; onDonated: () => void; drive?: boolean }) {
  const [items, setItems] = useState<JournalEntryKnown[] | null>(null);
  const [line, setLine] = useState(drive ? "For the museum's drive: any fish, bug or buried find, even a kind we have already. It all counts."
    : "Hoo, welcome! Bring me something you've found and I'll give it a proper home.");
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void Promise.all(DONATABLE.map(fetchJournalPage)).then(pages => {
      if (!alive) return;
      setItems(pages.flatMap(p => (p?.entries ?? []).filter((e): e is JournalEntryKnown => e.discovered && e.donatable && (!drive || e.count > 0))));
    });
    return () => { alive = false; };
  }, [open, drive]);
  // E at the curator opens it, and E (or Escape) closes it (it never closed on Escape before).
  return <IslandSheet open={open} title="Museum curator" onClose={onClose} testId="donate-sheet" keys="e">
    <p className={styles.curatorLine} role="status"><NameTag tone="sage">Curator</NameTag> {line}</p>
    {items === null ? <Loading label="Looking through your pockets…" /> : items.length === 0 ? <Empty icon={<Landmark size={32} />} title="Nothing for the museum yet">Catch a fish or a bug, or find a fossil, and bring it here.</Empty> :
      <List label="Things you can donate">{items.map(item => <ListRow key={item.key} data-key={item.key} icon={item.icon ?? undefined} title={item.name}
        detail={item.museum.donated ? `On display · ${item.museum.by_me ? "you" : item.museum.donor_name}${drive ? ` · in bag ×${item.count}` : ""}` : `In bag ×${item.count}`}
        value={item.museum.donated ? (drive ? <Badge tone="gold">Hand in</Badge> : <Badge tone="sage">Donated</Badge>) : <Badge tone="gold">Donate</Badge>}
        onClick={async () => {
          if (drive && item.museum.donated) {
            const r = await handIn(item.key, item.name);
            setLine(r.line);
            window.dispatchEvent(new CustomEvent("tsi:curator-say", { detail: { line: r.line, clip: r.ok ? "Cheer" : "Chat" } }));
            if (r.ok) setItems(list => (list ?? []).flatMap(e => (e.key !== item.key ? [e] : e.count > 1 ? [{ ...e, count: e.count - 1 }] : [])));
            onDonated();
            return;
          }
          const r = await donation(item.key, item.name);
          setLine(r.line);
          // She says it herself; a yes she's delighted with, and the sheet steps aside so you see it reach its case.
          window.dispatchEvent(new CustomEvent("tsi:curator-say", { detail: { line: r.line, clip: r.ok ? "Cheer" : "Chat" } }));
          if (r.ok) { markDonated(item.key, performance.now()); window.setTimeout(onClose, 450); }
          onDonated();
        }} />)}</List>}
  </IslandSheet>;
}
