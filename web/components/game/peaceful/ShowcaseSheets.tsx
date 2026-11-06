"use client";

/**
 * HQ trophy case (this week's biggest catches, /api/collections/trophies);
 * decision 204. It opens with E at its station, and E closes it. (The three-find
 * showcase picker is gone: one show-off now sits on your ID, hq/IdCard.tsx.)
 */
import { useEffect, useState } from "react";
import { Trophy as TrophyIcon } from "lucide-react";
import type { Trophy } from "@/lib/collections/logic";
import { ApiError, apiCall } from "@/lib/apiClient";
import { Empty, ErrorNote, List, ListRow, Loading, SignInLink } from "@/components/gui";
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
