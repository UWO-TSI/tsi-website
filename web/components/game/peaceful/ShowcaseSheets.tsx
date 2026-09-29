"use client";

/**
 * HQ trophy case (this week's biggest catches, /api/collections/trophies) and
 * the profile showcase picker (three finds, /api/collections/showcase);
 * decision 204.
 */
import { useEffect, useState } from "react";
import type { Trophy, JournalEntryKnown } from "@/lib/collections/logic";
import { CATEGORIES } from "@/lib/collections/roster";
import { ApiError, apiCall } from "@/lib/apiClient";
import { fetchJournalPage } from "../JournalPages";
import IslandSheet from "../IslandSheet";
import styles from "../DefaultIslandWorld.module.css";

export function TrophySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<{ week_start: string; trophies: Trophy[] } | null | "error">(null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    apiCall<{ week_start: string; trophies: Trophy[] }>("/api/collections/trophies", "case").then(c => alive && setData(c), () => alive && setData("error"));
    return () => { alive = false; };
  }, [open]);
  if (!open) return null;
  return <IslandSheet title="Trophy case" onClose={onClose} testId="trophy-sheet">
    {data === null ? <p>Polishing the glass…</p> : data === "error" ? <p>Sign in to see this week&apos;s trophies.</p> : <>
      <p className={styles.hint}>Biggest catches since Monday {data.week_start}. Two per member, so the wall shows the club.</p>
      {data.trophies.length === 0 ? <p>No trophies yet this week. The first big catch goes up here.</p> :
        <ol className={styles.trophyList}>{data.trophies.map(t => <li key={t.key}>
          <span className={styles.trophyRank}>{t.rank}</span>
          {t.icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.icon} alt="" width={30} height={30} />
          )}
          <span><b>{t.name}</b> · {t.size_cm} cm<small>{t.member_name} · {t.rarity}</small></span>
        </li>)}</ol>}
    </>}
  </IslandSheet>;
}

export function ShowcaseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null]);
  const [finds, setFinds] = useState<JournalEntryKnown[]>([]);
  const [active, setActive] = useState(0);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (!open) return;
    let alive = true;
    apiCall<({ key: string } | null)[]>("/api/collections/showcase", "showcase").then(s => alive && setSlots(s.map(x => x?.key ?? null)), () => {});
    void Promise.all(CATEGORIES.map(fetchJournalPage)).then(pages => {
      if (alive) setFinds(pages.flatMap(p => (p?.entries ?? []).filter((e): e is JournalEntryKnown => e.discovered)));
    });
    return () => { alive = false; };
  }, [open]);
  if (!open) return null;
  const byKey = new Map(finds.map(f => [f.key, f]));
  const save = async (next: (string | null)[]) => {
    setSlots(next);
    setNote(await apiCall("/api/collections/showcase", "showcase", { items: next }, "PUT").then(
      () => "Showcase saved to your profile.",
      (err) => (err instanceof ApiError && err.body?.error ? err.message : "Couldn't save the showcase.")));
  };
  return <IslandSheet title="Your profile showcase" onClose={onClose} testId="showcase-sheet">
    <div className={styles.showcaseSlots}>{slots.map((key, i) => {
      const f = key ? byKey.get(key) : null;
      return <button key={i} aria-pressed={active === i} onClick={() => setActive(i)}>
        {f?.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.icon} alt="" width={40} height={40} />
        ) : <span>{f ? f.name : "Empty"}</span>}
        <small>{f ? f.name : `Slot ${i + 1}`}</small>
      </button>;
    })}</div>
    <p className={styles.hint}>Pick a find for slot {active + 1}.</p>
    <ul className={styles.donateList}>{finds.map(f => <li key={f.key}><button onClick={() => void save(slots.map((k, i) => (i === active ? f.key : k === f.key ? null : k)))}>
      {f.icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={f.icon} alt="" width={26} height={26} />
      )}
      <span>{f.name}<small>{f.best_size_cm ? `record ${f.best_size_cm} cm` : `×${f.total_collected}`}</small></span>
    </button></li>)}</ul>
    {note && <p role="status" className={styles.hint}>{note}</p>}
  </IslandSheet>;
}
