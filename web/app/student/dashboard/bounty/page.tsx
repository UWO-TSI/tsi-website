"use client";

import { useEffect, useState, useCallback } from "react";
import { Scroll, Clock, Coins, ChevronLeft, X, AlertCircle, SearchX } from "lucide-react";
import type { Bounty } from "@/lib/supabase/types";

type Tab = "all" | "available" | "my_claims" | "completed";

const DIFFICULTY_COLORS: Record<string, { color: string; label: string }> = {
  easy: { color: "#22c55e", label: "!" },
  medium: { color: "#facc15", label: "!!" },
  hard: { color: "#ef4444", label: "!!!" },
};

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "available", label: "Available" },
  { key: "my_claims", label: "My Claims" },
  { key: "completed", label: "Completed" },
];

export default function BountyPage() {
  const [bounties, setBounties] = useState<Bounty[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("all");
  const [selected, setSelected] = useState<Bounty | null>(null);
  const [claiming, setClaiming] = useState(false);

  const fetchBounties = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tab === "available") params.set("status", "open");
      if (tab === "completed") params.set("status", "completed");
      const res = await fetch(`/api/bounties?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBounties(data.bounties ?? data ?? []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchBounties(); }, [fetchBounties]);

  const handleClaim = async (id: string) => {
    setClaiming(true);
    try {
      const res = await fetch(`/api/bounties/${id}/claim`, { method: "POST" });
      if (res.ok) {
        await fetchBounties();
        setSelected(null);
      }
    } catch { /* ignore */ }
    setClaiming(false);
  };

  const filtered = bounties.filter((b) => {
    if (tab === "available") return b.status === "open";
    if (tab === "completed") return b.status === "completed";
    if (tab === "my_claims") return b.status === "claimed" || b.status === "in_progress" || b.status === "review";
    return true;
  });

  return (
    <div className="flex-1 overflow-y-auto" style={{ padding: 24 }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255, 209, 102, 0.1)" }}>
            <Scroll className="w-5 h-5" style={{ color: "#ffd166" }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-main)" }}>Bounty Board</h1>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="shrink-0 text-sm font-medium rounded-full transition-colors"
              style={{
                height: 36,
                padding: "0 16px",
                background: tab === t.key ? "rgba(0, 47, 167, 0.15)" : "transparent",
                color: tab === t.key ? "var(--color-text-main)" : "var(--color-text-muted)",
                border: tab === t.key ? "1px solid #002fa7" : "1px solid var(--glass-border-soft)",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl animate-pulse" style={{ background: "#111827", height: 200 }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <SearchX className="w-8 h-8 mb-3" style={{ color: "var(--color-text-subtle)" }} />
            <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
              {tab === "my_claims" ? "You haven't claimed any bounties yet." : tab === "completed" ? "No completed bounties yet." : "No bounties available right now. Check back soon!"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map((b) => (
              <BountyCard key={b.id} bounty={b} onClick={() => setSelected(b)} />
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.6)" }} onClick={() => setSelected(null)}>
          <div
            className="w-full rounded-2xl overflow-y-auto"
            style={{ maxWidth: 560, maxHeight: "80vh", background: "#0d1b2a", border: "1px solid rgba(0, 47, 167, 0.3)", padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
              <button onClick={() => setSelected(null)} style={{ color: "var(--color-text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-text-main)" }}>{selected.title}</h2>

            <div className="flex flex-wrap gap-2 mb-4">
              {selected.difficulty && (
                <span className="text-xs font-mono px-2 py-1 rounded" style={{ color: DIFFICULTY_COLORS[selected.difficulty]?.color ?? "#9ca3af", background: "rgba(255,255,255,0.06)" }}>
                  {DIFFICULTY_COLORS[selected.difficulty]?.label ?? "?"} {selected.difficulty}
                </span>
              )}
              {selected.tech_stack?.map((t) => (
                <span key={t} className="text-xs px-2 py-1 rounded" style={{ color: "var(--color-text-muted)", background: "rgba(0, 47, 167, 0.1)" }}>{t}</span>
              ))}
            </div>

            <div className="space-y-3 mb-6 text-sm" style={{ color: "var(--color-text-soft)" }}>
              <div className="flex items-center gap-2">
                <Coins className="w-4 h-4" style={{ color: "#ffd166" }} />
                <span className="font-mono" style={{ color: "#ffd166" }}>{selected.pay_tc ?? 0} TSI coins</span>
                {selected.xp_reward ? <span className="ml-2 font-mono" style={{ color: "#22c55e" }}>+{selected.xp_reward} XP</span> : null}
              </div>
              {selected.deadline && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>Deadline: {new Date(selected.deadline).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <div className="mb-6">
              <h3 className="text-xs font-mono uppercase tracking-wider mb-2" style={{ color: "var(--color-text-subtle)" }}>Description</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-soft)" }}>{selected.description}</p>
            </div>

            {selected.status === "open" && (
              <button
                onClick={() => handleClaim(selected.id)}
                disabled={claiming}
                className="w-full rounded-xl text-sm font-semibold transition-all"
                style={{ height: 44, background: "#002fa7", color: "#f1ffff", opacity: claiming ? 0.6 : 1 }}
              >
                {claiming ? "Claiming..." : "Claim This Bounty"}
              </button>
            )}
            {selected.status === "claimed" && (
              <div className="text-center text-sm font-medium py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", color: "var(--color-text-muted)" }}>
                Already claimed
              </div>
            )}
            {selected.status === "completed" && (
              <div className="text-center text-sm font-medium py-3 rounded-xl" style={{ background: "rgba(34, 197, 94, 0.1)", color: "#22c55e" }}>
                Completed
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function BountyCard({ bounty, onClick }: { bounty: Bounty; onClick: () => void }) {
  const diff = DIFFICULTY_COLORS[bounty.difficulty ?? ""] ?? null;
  const isPastDeadline = bounty.deadline && new Date(bounty.deadline) < new Date();

  return (
    <button
      onClick={onClick}
      className="text-left rounded-2xl transition-all hover:border-[rgba(0,47,167,0.3)]"
      style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.06)", padding: 16 }}
    >
      {/* Title + difficulty */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-base font-semibold line-clamp-2" style={{ color: "var(--color-text-main)" }}>{bounty.title}</h3>
        {diff && (
          <span className="shrink-0 font-mono text-xs font-bold" style={{ color: diff.color }}>{diff.label}</span>
        )}
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {bounty.tech_stack?.slice(0, 3).map((t) => (
          <span key={t} className="text-xs px-2 py-0.5 rounded-full" style={{ color: "var(--color-text-muted)", background: "rgba(0, 47, 167, 0.1)" }}>{t}</span>
        ))}
      </div>

      {/* Reward */}
      <div className="flex items-center gap-1.5 mb-2">
        <Coins className="w-3.5 h-3.5" style={{ color: "#ffd166" }} />
        <span className="font-mono text-sm" style={{ color: "#ffd166" }}>{bounty.pay_tc ?? 0} TSI coins</span>
      </div>

      {/* Deadline */}
      {bounty.deadline && (
        <p className="text-sm" style={{ color: isPastDeadline ? "#ef4444" : "var(--color-text-muted)" }}>
          {isPastDeadline ? "Overdue" : `Due ${new Date(bounty.deadline).toLocaleDateString()}`}
        </p>
      )}

      {/* Status button */}
      <div
        className="mt-3 w-full text-center text-sm font-medium py-2 rounded-lg"
        style={{
          background: bounty.status === "open" ? "#002fa7" : bounty.status === "completed" ? "rgba(34, 197, 94, 0.1)" : "rgba(255,255,255,0.04)",
          color: bounty.status === "open" ? "#f1ffff" : bounty.status === "completed" ? "#22c55e" : "var(--color-text-muted)",
        }}
      >
        {bounty.status === "open" ? "Claim Bounty" : bounty.status === "claimed" ? "Claimed" : bounty.status === "completed" ? "Completed" : bounty.status === "review" ? "Under Review" : bounty.status}
      </div>
    </button>
  );
}
