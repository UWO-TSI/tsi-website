"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface AnalyticsData {
  totalMembers: number;
  activeMembers: number;
  alumni: number;
  pendingOnboarding: number;
  totalXP: number;
  totalTC: number;
  tcInCirculation: number;
  totalBounties: number;
  completedBounties: number;
  totalQuests: number;
  completedQuestEntries: number;
  totalOrders: number;
  fulfilledOrders: number;
  tierDistribution: Record<number, number>;
}

export default function AdminAnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalytics() {
      const supabase = createClient();

      const [profiles, bounties, questProgress, orders] = await Promise.all([
        supabase.from("profiles").select("tier, is_active, is_alumni, onboarding_completed, xp, tethos_coins"),
        supabase.from("bounties").select("status"),
        supabase.from("quest_progress").select("status"),
        supabase.from("marketplace_orders").select("status, total_tc"),
      ]);

      const members = profiles.data ?? [];
      const bountyList = bounties.data ?? [];
      const questList = questProgress.data ?? [];
      const orderList = orders.data ?? [];

      const tierDist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
      let totalXP = 0;
      let totalTC = 0;

      members.forEach((m) => {
        tierDist[m.tier] = (tierDist[m.tier] || 0) + 1;
        totalXP += m.xp || 0;
        totalTC += m.tethos_coins || 0;
      });

      const tcSpent = orderList
        .filter((o) => o.status !== "cancelled")
        .reduce((sum, o) => sum + (o.total_tc || 0), 0);

      setData({
        totalMembers: members.length,
        activeMembers: members.filter((m) => m.is_active).length,
        alumni: members.filter((m) => m.is_alumni).length,
        pendingOnboarding: members.filter((m) => !m.onboarding_completed).length,
        totalXP,
        totalTC,
        tcInCirculation: totalTC,
        totalBounties: bountyList.length,
        completedBounties: bountyList.filter((b) => b.status === "completed").length,
        totalQuests: questList.length,
        completedQuestEntries: questList.filter((q) => q.status === "completed").length,
        totalOrders: orderList.length,
        fulfilledOrders: orderList.filter((o) => o.status === "fulfilled").length,
        tierDistribution: tierDist,
      });
      setLoading(false);
    }

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <p className="text-center py-12 font-mono text-sm text-[var(--color-text-muted)] animate-pulse">
        Loading analytics...
      </p>
    );
  }

  if (!data) return null;

  const statCards = [
    { label: "Total Members", value: data.totalMembers, color: "var(--color-brand-blue)" },
    { label: "Active", value: data.activeMembers, color: "#34d399" },
    { label: "Alumni", value: data.alumni, color: "var(--color-brand-yellow)" },
    { label: "Pending Onboarding", value: data.pendingOnboarding, color: "var(--color-accent-cyan)" },
    { label: "Total XP Earned", value: data.totalXP.toLocaleString(), color: "var(--color-brand-blue)" },
    { label: "₮ In Circulation", value: `₮${data.tcInCirculation.toLocaleString()}`, color: "var(--color-brand-yellow)" },
    { label: "Bounties Completed", value: `${data.completedBounties}/${data.totalBounties}`, color: "#f87171" },
    { label: "Quests Completed", value: `${data.completedQuestEntries}/${data.totalQuests}`, color: "var(--color-accent-cyan)" },
    { label: "Orders Fulfilled", value: `${data.fulfilledOrders}/${data.totalOrders}`, color: "#a78bfa" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          Analytics
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          System overview
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-8">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-4"
          >
            <p className="text-[0.65rem] font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              {stat.label}
            </p>
            <p
              className="text-2xl font-mono font-bold"
              style={{ color: stat.color }}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tier Distribution */}
      <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-5">
        <h3 className="text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider mb-4">
          Tier Distribution
        </h3>
        <div className="space-y-3">
          {Object.entries(data.tierDistribution).map(([tier, count]) => {
            const labels: Record<string, string> = {
              "1": "T1 · President",
              "2": "T2 · Executives",
              "3": "T3 · Members",
              "4": "T4 · General",
            };
            const colors: Record<string, string> = {
              "1": "#f87171",
              "2": "var(--color-brand-yellow)",
              "3": "var(--color-brand-blue)",
              "4": "var(--color-text-muted)",
            };
            const pct =
              data.totalMembers > 0
                ? (count / data.totalMembers) * 100
                : 0;

            return (
              <div key={tier}>
                <div className="flex justify-between text-xs font-mono mb-1">
                  <span style={{ color: colors[tier] }}>
                    {labels[tier]}
                  </span>
                  <span className="text-[var(--color-text-muted)]">
                    {count} ({pct.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: colors[tier],
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
