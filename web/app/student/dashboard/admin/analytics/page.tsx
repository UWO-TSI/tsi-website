"use client";

import { useState, useEffect, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { Amount } from "@/components/economy/Amount";
import { Card, ErrorNote, Loading, Progress } from "@/components/gui";
import { summarizeAnalytics } from "@/lib/portal/load";

type AnalyticsData = ReturnType<typeof summarizeAnalytics>;

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

/** "3 of 10": the part in ink, the whole in a caption. */
const outOf = (part: number, whole: number) => (
  <>
    {part}
    <span className="ml-1.5 text-sm font-bold text-[var(--gui-muted)]">of {whole}</span>
  </>
);

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const supabase = createClient();
        const [profiles, bounties, questProgress, orders] = await Promise.all([
          supabase.from("profiles").select("tier, is_active, is_alumni, onboarding_completed, xp, tethos_coins"),
          supabase.from("bounties").select("status"),
          supabase.from("quest_progress").select("status"),
          supabase.from("marketplace_orders").select("status, total_tc"),
        ]);
        // A failed read throws: zeros would look like a real, empty club.
        setData(summarizeAnalytics(profiles, bounties, questProgress, orders));
        setFailed(false);
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [reload]);

  if (loading || failed || !data) {
    return (
      <div className={PAGE}>
        {loading ? <Loading label="Adding up the numbers…" />
          : <ErrorNote onRetry={() => { setLoading(true); setReload((n) => n + 1); }}>The numbers didn’t load.</ErrorNote>}
      </div>
    );
  }

  const statCards: { label: string; value: ReactNode }[] = [
    { label: "Members", value: data.totalMembers },
    { label: "Active", value: data.activeMembers },
    { label: "Alumni", value: data.alumni },
    { label: "Still onboarding", value: data.pendingOnboarding },
    { label: "XP earned", value: data.totalXP.toLocaleString() },
    { label: "Gems held by members", value: <Amount n={data.tcInCirculation} currency="gems" size={22} /> },
    { label: "Bounties completed", value: outOf(data.completedBounties, data.totalBounties) },
    { label: "Quests completed", value: outOf(data.completedQuestEntries, data.totalQuests) },
    { label: "Orders picked up", value: outOf(data.fulfilledOrders, data.totalOrders) },
  ];

  const labels: Record<string, string> = {
    "1": "T1 · President",
    "2": "T2 · Executives",
    "3": "T3 · Members",
    "4": "T4 · General",
    "5": "T5 · Public",
  };

  return (
    <div className={PAGE}>
      <div className="mb-8">
        <h1 className="text-2xl font-extrabold text-[var(--gui-ink-strong)]">Analytics</h1>
        <p className="mt-1 text-sm text-[var(--gui-muted)]">The club at a glance.</p>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <p className="text-sm font-bold text-[var(--gui-ink-2)]">{stat.label}</p>
            <p className="mt-1 text-2xl font-extrabold text-[var(--gui-ink-strong)]">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Tier Distribution */}
      <Card>
        <h2 className="mb-4 text-base font-extrabold text-[var(--gui-ink-strong)]">Members by tier</h2>
        <div className="space-y-4">
          {Object.entries(data.tierDistribution).map(([tier, count]) => {
            const pct =
              data.totalMembers > 0
                ? (count / data.totalMembers) * 100
                : 0;

            return (
              <Progress
                key={tier}
                value={count}
                max={data.totalMembers}
                label={labels[tier] ?? `T${tier}`}
                showLabel
                valueText={`${count} (${pct.toFixed(0)}%)`}
              />
            );
          })}
        </div>
      </Card>
    </div>
  );
}
