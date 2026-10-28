"use client";

/**
 * The museum's drive (m5; David 2026-10-28: "this might get impossible if people donate all the stuff"), in the flat
 * kit: Odile's talk by the closed museum opens it (lib/game/mainQuest.ts MUSEUM_DRIVE). Every fish, bug and buried find
 * in your bag is a card: one the museum hasn't got yet is donated (it goes on display with your name), one it has is
 * handed in. Both count for the club's drive and for your part, so the drive can always be finished.
 */
import { useEffect, useState } from "react";
import { CardGrid, FlatPanel, ItemCard, StatusLine } from "@/components/gui/flat";
import { CATEGORIES, type Category } from "@/lib/collections/roster";
import type { JournalEntryKnown } from "@/lib/collections/logic";
import { newKey } from "@/lib/apiClient";
import { curatorLine } from "@/lib/game/peaceful";
import { fetchJournalPage } from "./JournalPages";
import { donation } from "./peaceful/DonateSheet";

const KINDS: Category[] = CATEGORIES.filter(c => c === "fish" || c === "sea" || c === "bug" || c === "nature");
const HELLO = "Any fish, bug or buried find counts for the drive, even a kind we have already.";

/** One more of a kind the museum shows, into the drive (each a fresh key: every one counts). */
async function handIn(key: string, name: string): Promise<{ ok: boolean; line: string }> {
  try {
    const res = await fetch("/api/collections/museum/hand-in", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ species_key: key, idempotency_key: `hand-in:${newKey()}` }) });
    const body = await res.json().catch(() => null);
    if (res.ok && body?.ok) return { ok: true, line: `Another ${name}! Into the drive it goes, with your name on the tally.` };
    return { ok: false, line: curatorLine({ ok: false, code: body?.code, error: body?.error }) };
  } catch {
    return { ok: false, line: curatorLine({ ok: false, error: "The museum couldn't take that just now. Try again in a moment." }) };
  }
}

export default function MuseumDrive({ open, onClose, onGiven }: { open: boolean; onClose: () => void; onGiven: () => void }) {
  const [items, setItems] = useState<JournalEntryKnown[] | null>(null);
  const [line, setLine] = useState<{ text: string; error?: boolean }>({ text: HELLO });
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void Promise.all(KINDS.map(fetchJournalPage)).then(pages => {
      if (alive) setItems(pages.flatMap(p => (p?.entries ?? []).filter((e): e is JournalEntryKnown => e.discovered && e.donatable && e.count > 0)));
    });
    return () => { alive = false; };
  }, [open]);
  const give = async (item: JournalEntryKnown) => {
    if (busy) return;
    setBusy(item.key);
    const r = item.museum.donated ? await handIn(item.key, item.name) : await donation(item.key, item.name);
    setBusy(null);
    setLine({ text: r.line, error: !r.ok });
    window.dispatchEvent(new CustomEvent("tsi:curator-say", { detail: { line: r.line, clip: r.ok ? "Cheer" : "Chat" } }));
    if (!r.ok) return;
    setItems(list => (list ?? []).flatMap(e => (e.key !== item.key ? [e] : e.count > 1 ? [{ ...e, count: e.count - 1, museum: { ...e.museum, donated: true } }] : [])));
    onGiven();
  };
  return <FlatPanel open={open} onClose={onClose} title="The museum's drive" testId="museum-drive" keys="e">
    <StatusLine error={line.error}>{line.text}</StatusLine>
    {items === null ? <StatusLine>Looking through your bag…</StatusLine>
      : items.length === 0 ? <StatusLine>Nothing for the drive yet: catch a fish or a bug, or dig something up.</StatusLine>
      : <CardGrid label="What you can give" min={170}>{items.map(item => <ItemCard key={item.key} data-key={item.key} size="md" picture={item.icon ?? ""} name={item.name}
        line={item.museum.donated ? "On display: hand it in" : "New for the museum"} pill={`×${item.count}`} arrow={false} disabled={busy !== null}
        label={`${item.museum.donated ? "Hand in" : "Donate"} ${item.name}`} onClick={() => void give(item)} />)}</CardGrid>}
  </FlatPanel>;
}
