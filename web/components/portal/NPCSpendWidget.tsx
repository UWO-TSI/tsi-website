"use client";

// ─── NPC Spend Widget (D8, T1 only) ────────────────────────────────────────
// Compact card for the admin hub showing this month's NPC token totals,
// estimated cost, top 5 chattiest users, top 5 most-talked-to NPCs. SWR
// revalidates every 5 minutes; manual refresh button forces a refetch.

import useSWR from "swr";
import { RefreshCw, Sparkles } from "lucide-react";
import { Card, ErrorNote, IconButton, List, ListRow, Loading } from "@/components/gui";

interface TopUser {
  user_id: string;
  name: string;
  interactions: number;
}
interface TopNPC {
  npc_id: string;
  name: string;
  interactions: number;
}
interface SpendResponse {
  month: string;
  tokens_in: number;
  tokens_out: number;
  estimated_cost_usd: number;
  top_users: TopUser[];
  top_npcs: TopNPC[];
}

const FIVE_MINUTES = 5 * 60 * 1000;

async function fetchSpend(): Promise<SpendResponse> {
  const res = await fetch("/api/npc/spend");
  if (!res.ok) throw new Error("Failed to load spend");
  return (await res.json()) as SpendResponse;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

/** The API's "2026-10" (a UTC calendar month) as "October 2026". */
function formatMonth(month: string): string {
  const d = new Date(`${month}-01T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? month : d.toLocaleDateString("en-CA", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** Someone and how many chats, with a dotted leader between. */
function TopList({ title, rows, empty }: { title: string; rows: { id: string; name: string; interactions: number }[]; empty: string }) {
  return (
    <div>
      <p className="text-[13px] font-extrabold text-[var(--gui-ink-2)] mb-1">{title}</p>
      {rows.length === 0 ? (
        <p className="text-[13px] text-[var(--gui-muted)]">{empty}</p>
      ) : (
        <List label={title}>
          {rows.map((r) => <ListRow key={r.id} title={r.name} value={r.interactions} leader />)}
        </List>
      )}
    </div>
  );
}

export default function NPCSpendWidget() {
  const { data, error, isLoading, mutate } = useSWR<SpendResponse>(
    "npc-spend",
    fetchSpend,
    {
      refreshInterval: FIVE_MINUTES,
      revalidateOnFocus: false,
    },
  );

  return (
    <Card style={{ padding: 20 }}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 shrink-0 rounded-[46%_50%_44%_48%/54%_50%_46%_52%] flex items-center justify-center bg-[var(--gui-butter)] text-[var(--gui-ink-strong)]">
            <Sparkles size={20} aria-hidden />
          </div>
          <div>
            <h3 className="text-[15px] font-extrabold text-[var(--gui-ink-strong)]">
              NPC spend
            </h3>
            <p className="text-[13px] text-[var(--gui-muted)]">
              {data?.month ? formatMonth(data.month) : "This month"} · T1 and T2
            </p>
          </div>
        </div>
        <IconButton label="Refresh" size="sm" onClick={() => mutate()}>
          <RefreshCw size={16} aria-hidden className={isLoading ? "animate-spin" : ""} />
        </IconButton>
      </div>

      {error ? (
        <ErrorNote onRetry={() => mutate()}>
          This month’s NPC spend didn’t load.
        </ErrorNote>
      ) : !data ? (
        <Loading label="Adding up this month’s NPC chats…" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-2xl bg-[var(--gui-paper-warm)] px-4 py-3">
              <p className="text-[13px] font-extrabold text-[var(--gui-ink-2)] mb-1">
                Tokens in / out
              </p>
              <p className="text-xl font-extrabold text-[var(--gui-ink-strong)]">
                {formatTokens(data.tokens_in)}
                <span className="text-sm font-semibold text-[var(--gui-muted)]">
                  {" "}
                  / {formatTokens(data.tokens_out)}
                </span>
              </p>
            </div>
            <div className="rounded-2xl bg-[var(--gui-paper-warm)] px-4 py-3">
              <p className="text-[13px] font-extrabold text-[var(--gui-ink-2)] mb-1">
                Estimated cost (USD)
              </p>
              <p className="text-xl font-extrabold text-[var(--gui-ink-strong)]">
                ${data.estimated_cost_usd.toFixed(4)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <TopList
              title="Chattiest members"
              rows={data.top_users.map((u) => ({ id: u.user_id, name: u.name, interactions: u.interactions }))}
              empty="No one has chatted with a resident yet this month."
            />
            <TopList
              title="Most talked-to NPCs"
              rows={data.top_npcs.map((n) => ({ id: n.npc_id, name: n.name, interactions: n.interactions }))}
              empty="No NPC chats yet this month."
            />
          </div>
        </>
      )}
    </Card>
  );
}
