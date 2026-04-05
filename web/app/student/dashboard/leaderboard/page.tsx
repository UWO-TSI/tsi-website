"use client";

import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import type { DirectoryMember, Tier } from "@/lib/supabase/types";
import { TIER_COLORS } from "@/components/portal/types";

type TimePeriod = "weekly" | "monthly" | "all_time";

const TIME_TABS: { key: TimePeriod; label: string }[] = [
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
  { key: "all_time", label: "All-Time" },
];

const RANK_COLORS: Record<number, string> = {
  1: "#ffd166",
  2: "#d4d4d8",
  3: "#cd7f32",
};

export default function LeaderboardPage() {
  const [members, setMembers] = useState<DirectoryMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimePeriod>("all_time");

  useEffect(() => {
    setLoading(true);
    fetch("/api/directory")
      .then((r) => r.ok ? r.json() : { members: [] })
      .then((data) => {
        const list: DirectoryMember[] = data.members ?? data ?? [];
        list.sort((a, b) => (b.xp ?? 0) - (a.xp ?? 0));
        setMembers(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [period]);

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: 24 }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255, 209, 102, 0.1)" }}>
            <Trophy className="w-5 h-5" style={{ color: "#ffd166" }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-main)" }}>Leaderboard</h1>
        </div>

        {/* Time Period Tabs */}
        <div className="flex gap-2 mb-4">
          {TIME_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setPeriod(t.key)}
              className="shrink-0 text-sm font-medium rounded-full transition-colors"
              style={{
                height: 36,
                padding: "0 16px",
                background: period === t.key ? "rgba(0, 47, 167, 0.15)" : "transparent",
                color: period === t.key ? "var(--color-text-main)" : "var(--color-text-muted)",
                border: period === t.key ? "1px solid #002fa7" : "1px solid var(--glass-border-soft)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-2xl overflow-hidden" style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.06)" }}>
          {/* Header Row */}
          <div
            className="grid items-center font-mono text-xs uppercase tracking-wider"
            style={{
              gridTemplateColumns: "40px 40px 1fr 60px 80px 50px",
              height: 36,
              padding: "0 16px",
              color: "#6b7280",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <span className="text-right pr-2">#</span>
            <span />
            <span>Name</span>
            <span className="hidden sm:block">Level</span>
            <span className="text-right">XP</span>
            <span className="text-right hidden md:block">Tier</span>
          </div>

          {/* Rows */}
          {loading ? (
            Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="animate-pulse" style={{ height: 56, borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div className="h-full flex items-center px-4 gap-3">
                  <div className="w-6 h-3 rounded" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <div className="w-9 h-9 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
                  <div className="flex-1 h-3 rounded" style={{ background: "rgba(255,255,255,0.06)", maxWidth: 120 }} />
                </div>
              </div>
            ))
          ) : members.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Trophy className="w-8 h-8 mb-3" style={{ color: "var(--color-text-subtle)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No rankings yet for this period.</p>
            </div>
          ) : (
            members.map((m, i) => {
              const rank = i + 1;
              const tier = (m.tier ?? 5) as Tier;
              const tierStyle = TIER_COLORS[tier];
              return (
                <div
                  key={m.id}
                  className="grid items-center transition-colors hover:bg-white/[0.03]"
                  style={{
                    gridTemplateColumns: "40px 40px 1fr 60px 80px 50px",
                    height: 56,
                    padding: "0 16px",
                    gap: 12,
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <span className="text-right pr-2 font-mono font-bold" style={{ fontSize: 16, color: RANK_COLORS[rank] ?? "#9ca3af" }}>
                    {rank}
                  </span>
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: tierStyle.bg, color: tierStyle.color, border: `2px solid ${tierStyle.border}` }}
                  >
                    {(m.display_name ?? "?")[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text-main)" }}>
                    {m.display_name ?? "Unknown"}
                  </span>
                  <span className="hidden sm:block font-mono text-sm" style={{ color: "var(--color-text-soft)" }}>
                    Lv.{m.level ?? 1}
                  </span>
                  <span className="text-right font-mono text-sm font-medium" style={{ color: "var(--color-text-main)" }}>
                    {(m.xp ?? 0).toLocaleString()}
                  </span>
                  <span className="hidden md:block text-right text-xs font-mono font-bold" style={{ color: tierStyle.color }}>
                    T{tier}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
