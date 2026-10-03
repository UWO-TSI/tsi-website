"use client";

/**
 * Curator's donation sheet (decisions 67, 202): pick something you've found;
 * the museum takes the first of each species with your name on the plaque
 * and refuses duplicates with the curator's line.
 */
import { useEffect, useState } from "react";
import { CATEGORIES, type Category } from "@/lib/collections/roster";
import type { JournalEntryKnown } from "@/lib/collections/logic";
import { fetchJournalPage } from "../JournalPages";
import { curatorLine } from "@/lib/game/peaceful";
import IslandSheet from "../IslandSheet";
import { Landmark } from "lucide-react";
import { Badge, Empty, List, ListRow, Loading, NameTag } from "@/components/gui";
import styles from "../DefaultIslandWorld.module.css";

const DONATABLE: Category[] = CATEGORIES.filter(c => c === "fish" || c === "sea" || c === "bug" || c === "nature");

export async function postDonation(key: string, name: string): Promise<string> {
  try {
    const res = await fetch("/api/collections/museum/donate", { method: "POST", headers: { "Content-Type": "application/json" },
      // One donation per species ever, so the species is the key: a retry replays.
      body: JSON.stringify({ species_key: key, idempotency_key: `donate:${key}` }) });
    const body = await res.json().catch(() => null);
    return curatorLine(res.ok && body?.ok ? { ok: true, name } : { ok: false, code: body?.code, error: body?.error });
  } catch {
    return curatorLine({ ok: false, error: "The museum couldn't take that just now. Try again in a moment." });
  }
}

export default function DonateSheet({ open, onClose, onDonated }: { open: boolean; onClose: () => void; onDonated: () => void }) {
  const [items, setItems] = useState<JournalEntryKnown[] | null>(null);
  const [line, setLine] = useState("Hoo, welcome! Bring me something you've found and I'll give it a proper home.");
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void Promise.all(DONATABLE.map(fetchJournalPage)).then(pages => {
      if (!alive) return;
      setItems(pages.flatMap(p => (p?.entries ?? []).filter((e): e is JournalEntryKnown => e.discovered && e.donatable)));
    });
    return () => { alive = false; };
  }, [open]);
  // E at the curator opens it, and E (or Escape) closes it (it never closed on Escape before).
  return <IslandSheet open={open} title="Museum curator" onClose={onClose} testId="donate-sheet" keys="e">
    <p className={styles.curatorLine} role="status"><NameTag tone="sage">Curator</NameTag> {line}</p>
    {items === null ? <Loading label="Looking through your pockets…" /> : items.length === 0 ? <Empty icon={<Landmark size={32} />} title="Nothing for the museum yet">Catch a fish or a bug, or find a fossil, and bring it here.</Empty> :
      <List label="Things you can donate">{items.map(item => <ListRow key={item.key} data-key={item.key} icon={item.icon ?? undefined} title={item.name}
        detail={item.museum.donated ? `On display · ${item.museum.by_me ? "you" : item.museum.donor_name}` : `In bag ×${item.count}`}
        value={item.museum.donated ? <Badge tone="sage">Donated</Badge> : <Badge tone="gold">Donate</Badge>}
        onClick={async () => { setLine(await postDonation(item.key, item.name)); onDonated(); }} />)}</List>}
  </IslandSheet>;
}
