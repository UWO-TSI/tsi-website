"use client";

/**
 * The fish market at its quick-sell barrel (the new world's wharf): today's requests (f-requests), selling, and the
 * records (f-records): the club's catch board this week and your size record per species. The board also shows on the
 * portal leaderboard (RecordsBody).
 */
import { useCallback, useState } from "react";
import { Ruler, Trophy as TrophyIcon } from "lucide-react";
import type { Records } from "@/lib/collections/service";
import { apiCall } from "@/lib/apiClient";
import { Empty, ErrorNote, List, ListRow, Loading, SignInText, Tabs } from "@/components/gui";
import ProgressionPanel from "@/components/progression/ProgressionPanel";
import { RequestsBody, SellBody, useLoad } from "@/components/economy/EconomySheets";
import p from "@/components/progression/progression.module.css";

/** "Monday, Sep 28" from the week's YYYY-MM-DD. */
const weekDay = (ymd: string) => new Date(`${ymd}T12:00:00`).toLocaleDateString("en-CA", { weekday: "long", month: "short", day: "numeric" });

export function RecordsBody({ yours = true }: { yours?: boolean }) {
  const load = useCallback(() => apiCall<Records>("/api/collections/records", "records"), []);
  const { data, error, reload } = useLoad(load);
  if (!data) return error ? <ErrorNote onRetry={() => void reload()}><SignInText text={error} /></ErrorNote> : <Loading label="Reading the board…" />;
  return (
    <div>
      <p className={p.muted} style={{ marginBottom: 10 }}>The biggest of each fish caught since {weekDay(data.week_start)}. A new board every Monday.</p>
      {data.board.length === 0 ? <Empty icon={<TrophyIcon size={32} />} title="Nothing on the board yet">The first catch of the week goes up here.</Empty>
        : <List label="This week's catch board">{data.board.map((t) => <ListRow key={t.key} icon={t.icon ?? <TrophyIcon size={22} />}
          title={<>{t.name} · {t.size_cm} cm</>} detail={`${t.mine ? "You" : t.member_name} · ${t.rarity}`} value={<b aria-label={`Rank ${t.rank}`}>{t.rank}</b>} />)}</List>}
      {yours ? <>
        <h3 className={p.muted} style={{ margin: "16px 0 8px" }}>Your size records</h3>
        {data.mine.length === 0 ? <Empty icon={<Ruler size={32} />} title="No records yet">Your biggest of each fish is kept here.</Empty>
          : <List label="Your size records">{[...data.mine].sort((a, b) => a.name.localeCompare(b.name)).map((r) => <ListRow key={r.key} icon={r.icon ?? <Ruler size={22} />}
            title={r.name} detail={r.rarity} value={`${r.best_size_cm} cm`} />)}</List>}
      </> : null}
    </div>
  );
}

type Tab = "requests" | "sell" | "records";
/** `keys`: the station key, which closes it too. */
export function FishMarketSheet({ open, onClose, keys }: { open: boolean; onClose: () => void; keys?: string }) {
  const [tab, setTab] = useState<Tab>("requests");
  return (
    <ProgressionPanel open={open} onClose={onClose} title="Fish market" keys={keys}>
      <Tabs label="Fish market" value={tab} onChange={setTab} tabs={[{ id: "requests", label: "Requests" }, { id: "sell", label: "Sell" }, { id: "records", label: "Records" }]} />
      {tab === "requests" ? <RequestsBody /> : tab === "sell" ? <SellBody /> : <RecordsBody />}
    </ProgressionPanel>
  );
}
