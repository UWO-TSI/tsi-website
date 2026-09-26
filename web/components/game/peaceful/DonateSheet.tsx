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
import styles from "../DefaultIslandWorld.module.css";

const DONATABLE: Category[] = CATEGORIES.filter(c => c === "fish" || c === "sea" || c === "bug" || c === "nature");

export async function postDonation(key: string, name: string): Promise<string> {
  try {
    const res = await fetch("/api/collections/museum/donate", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ species_key: key, idempotency_key: `donate:${key}:${Date.now().toString(36)}` }) });
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
  if (!open) return null;
  return <section className={styles.sheet} role="dialog" aria-modal="false" aria-labelledby="donate-title" data-testid="donate-sheet">
    <header><h2 id="donate-title">Museum curator</h2><button onClick={onClose} aria-label="Close">×</button></header>
    <p className={styles.curatorLine} role="status">{line}</p>
    {items === null ? <p>Looking through your pockets…</p> : items.length === 0 ? <p>You haven&apos;t found anything the museum collects yet.</p> :
      <ul className={styles.donateList}>{items.map(item => <li key={item.key}>
        <button data-key={item.key} onClick={async () => { setLine(await postDonation(item.key, item.name)); onDonated(); }}>
          {item.icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.icon} alt="" width={28} height={28} />
          )}
          <span>{item.name}<small>{item.museum.donated ? `On display · ${item.museum.by_me ? "you" : item.museum.donor_name}` : `In bag ×${item.count}`}</small></span>
        </button>
      </li>)}</ul>}
  </section>;
}
