"use client";

// ─── NPC Spend Widget (D8, T1 only) ────────────────────────────────────────
// Compact card for the admin hub showing this month's NPC token totals,
// estimated cost, top 5 chattiest users, top 5 most-talked-to NPCs. SWR
// revalidates every 5 minutes; manual refresh button forces a refetch.

import useSWR from "swr";
import { RefreshCw, Sparkles } from "lucide-react";

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
    <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center"
            style={{
              backgroundColor: "color-mix(in srgb, #f59e0b 15%, transparent)",
              color: "#f59e0b",
            }}
          >
            <Sparkles size={16} />
          </div>
          <div>
            <h3 className="text-sm font-heading font-bold text-[var(--color-text-primary)]">
              NPC Spend
            </h3>
            <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)]">
              {data?.month ?? "this month"} · T1 only
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => mutate()}
          className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--glass-border)]/40 transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
        </button>
      </div>

      {error ? (
        <p className="text-xs font-mono text-red-400">
          Failed to load spend data.
        </p>
      ) : !data ? (
        <p className="text-xs font-mono text-[var(--color-text-muted)] animate-pulse">
          Loading spend...
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <p className="text-[0.6rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                Tokens (in / out)
              </p>
              <p className="text-xl font-mono font-bold text-[var(--color-text-primary)]">
                {formatTokens(data.tokens_in)}
                <span className="text-sm text-[var(--color-text-muted)] font-normal">
                  {" "}
                  / {formatTokens(data.tokens_out)}
                </span>
              </p>
            </div>
            <div>
              <p className="text-[0.6rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
                Estimated cost
              </p>
              <p className="text-xl font-mono font-bold text-[var(--color-text-primary)]">
                ${data.estimated_cost_usd.toFixed(4)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-[0.6rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
                Top chattiest users
              </p>
              {data.top_users.length === 0 ? (
                <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)]">
                  —
                </p>
              ) : (
                <ul className="space-y-1">
                  {data.top_users.map((u) => (
                    <li
                      key={u.user_id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-[var(--color-text-soft)] truncate">
                        {u.name}
                      </span>
                      <span className="font-mono text-[0.65rem] text-[var(--color-text-muted)]">
                        {u.interactions}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="text-[0.6rem] font-mono uppercase tracking-wider text-[var(--color-text-muted)] mb-1.5">
                Top NPCs
              </p>
              {data.top_npcs.length === 0 ? (
                <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)]">
                  —
                </p>
              ) : (
                <ul className="space-y-1">
                  {data.top_npcs.map((n) => (
                    <li
                      key={n.npc_id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="text-[var(--color-text-soft)] truncate">
                        {n.name}
                      </span>
                      <span className="font-mono text-[0.65rem] text-[var(--color-text-muted)]">
                        {n.interactions}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
