"use client";

/**
 * HQ trophy case (this week's biggest catches, /api/collections/trophies) and
 * the profile showcase picker (three finds, /api/collections/showcase);
 * decision 204. Both open with E at their station, and E closes them.
 */
import { useEffect, useState } from "react";
import { Trophy as TrophyIcon, Sparkles } from "lucide-react";
import type { Trophy, JournalEntryKnown } from "@/lib/collections/logic";
import { CATEGORIES } from "@/lib/collections/roster";
import { ApiError, apiCall } from "@/lib/apiClient";
import { Button, Empty, ErrorNote, ItemTile, List, ListRow, Loading, SignInLink } from "@/components/gui";
import { fetchJournalPage } from "../JournalPages";
import IslandSheet from "../IslandSheet";
import styles from "../DefaultIslandWorld.module.css";

/** "Monday, Sep 28" from the week's YYYY-MM-DD (it printed the raw date). */
const weekDay = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("en-CA", { weekday: "long", month: "short", day: "numeric" });

export function TrophySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [data, setData] = useState<{ week_start: string; trophies: Trophy[] } | null | "signed-out" | "error">(null);
  const [tries, setTries] = useState(0);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    apiCall<{ week_start: string; trophies: Trophy[] }>("/api/collections/trophies", "case").then(c => alive && setData(c),
      // A failure is said as one; only a signed-out visit is asked to sign in (it used to say "Sign in" for everything).
      (err: unknown) => alive && setData(err instanceof ApiError && err.status === 401 ? "signed-out" : "error"));
    return () => { alive = false; };
  }, [open, tries]);
  return <IslandSheet open={open} title="Trophy case" onClose={onClose} testId="trophy-sheet" keys="e">
    {data === null ? <Loading label="Polishing the glass…" />
      : data === "signed-out" ? <Empty icon={<TrophyIcon size={32} />} title="Sign in to see the case" action={<SignInLink button />}>This week’s biggest catches go up here.</Empty>
      : data === "error" ? <ErrorNote onRetry={() => { setData(null); setTries(n => n + 1); }}>The trophy case didn’t load. The connection may have dropped.</ErrorNote>
      : <>
        <p className={styles.hint}>Biggest catches since {weekDay(data.week_start)}. Two per member, so the wall shows the club.</p>
        {data.trophies.length === 0 ? <Empty icon={<TrophyIcon size={32} />} title="No trophies yet this week">The first big catch goes up here.</Empty>
          : <List label="This week's trophies">{data.trophies.map(t => <ListRow key={t.key} icon={t.icon ?? <TrophyIcon size={22} />}
            title={<>{t.name} · {t.size_cm} cm</>} detail={`${t.member_name} · ${t.rarity}`} value={<span className={styles.trophyRank} aria-label={`Rank ${t.rank}`}>{t.rank}</span>} />)}</List>}
      </>}
  </IslandSheet>;
}

export function ShowcaseSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null]);
  const [finds, setFinds] = useState<JournalEntryKnown[] | null>(null);
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
  const byKey = new Map((finds ?? []).map(f => [f.key, f]));
  const save = async (next: (string | null)[]) => {
    setSlots(next);
    setNote(await apiCall("/api/collections/showcase", "showcase", { items: next }, "PUT").then(
      () => "Showcase saved to your profile.",
      (err) => (err instanceof ApiError && err.body?.error ? err.message : "Couldn't save the showcase.")));
  };
  const chosen = slots[active];
  return <IslandSheet open={open} title="Your profile showcase" onClose={onClose} testId="showcase-sheet" keys="e">
    <div className={styles.showcaseSlots} role="group" aria-label="Showcase slots">{slots.map((key, i) => {
      const f = key ? byKey.get(key) : null;
      return <ItemTile key={i} icon={f?.icon ?? null} name={f ? f.name : `Slot ${i + 1}`} empty={!f} selected={active === i} onClick={() => setActive(i)} size={84}
        caption={f ? f.name : `Slot ${i + 1}, empty`} aria-label={`Slot ${i + 1}: ${f ? f.name : "empty"}`} />;
    })}</div>
    <div className={styles.showcaseBar}>
      <p className={styles.hint} style={{ margin: 0 }}>{chosen ? `Slot ${active + 1}: pick another find, or clear it.` : `Pick a find for slot ${active + 1}.`}</p>
      {chosen && <Button size="sm" variant="quiet" onClick={() => void save(slots.map((k, i) => (i === active ? null : k)))}>Clear slot {active + 1}</Button>}
    </div>
    {finds === null ? <Loading label="Looking through your finds…" />
      : finds.length === 0 ? <Empty icon={<Sparkles size={32} />} title="Nothing to show yet">Catch, net or gather something and it can go on your profile.</Empty>
      : <List label="Your finds">{finds.map(f => <ListRow key={f.key} icon={f.icon ?? undefined} title={f.name} detail={f.best_size_cm ? `Record ${f.best_size_cm} cm` : `×${f.total_collected}`}
          selected={slots.includes(f.key)} onClick={() => void save(slots.map((k, i) => (i === active ? f.key : k === f.key ? null : k)))} />)}</List>}
    {note && <p role="status" className={styles.hint}>{note}</p>}
  </IslandSheet>;
}
