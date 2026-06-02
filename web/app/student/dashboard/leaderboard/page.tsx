"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Trophy } from "lucide-react";
import type { LeaderboardEntry, Tier } from "@/lib/supabase/types";
import { TIER_COLORS } from "@/components/portal/types";
import { useUser } from "@/components/portal/UserContext";

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

// Accent color for own-row highlight (per ux-leaderboard.md §6 + game-tokens.css)
const OWN_ROW_BG = "rgba(0, 47, 167, 0.12)";
const OWN_ROW_BG_STICKY = "rgba(0, 47, 167, 0.18)";
const OWN_ROW_ACCENT = "#002fa7";

// Grid column template — shared between header + every row + sticky row so columns align
const GRID_COLS = "40px 40px 1fr 60px 80px 50px";

interface LeaderboardResponse {
  leaderboard?: LeaderboardEntry[];
  your_rank?: number | null;
  total_returned?: number;
}

export default function LeaderboardPage() {
  const { profile } = useUser();
  const viewerId = profile?.id ?? null;
  const viewerTier = profile?.tier ?? 5;
  const isAdmin = viewerTier === 1;

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [yourRank, setYourRank] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<TimePeriod>("all_time");

  // Sticky logic: detect when viewer's own row scrolls out of view
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const ownRowRef = useRef<HTMLDivElement | null>(null);
  const [ownRowVisible, setOwnRowVisible] = useState(true);

  useEffect(() => {
    let cancelled = false;
    // /api/leaderboard returns full list w/ rank_position + your_rank (covers when viewer not in top N)
    fetch("/api/leaderboard?limit=100")
      .then((r) => (r.ok ? r.json() : { leaderboard: [], your_rank: null }))
      .then((data: LeaderboardResponse) => {
        if (cancelled) return;
        setEntries(data.leaderboard ?? []);
        setYourRank(data.your_rank ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period]);

  // Find viewer's row in the loaded list (may be absent if outside top 100)
  const ownEntry = useMemo(
    () => (viewerId ? entries.find((e) => e.id === viewerId) ?? null : null),
    [entries, viewerId]
  );

  // Top half / bottom half cutoff. Boundary uses ceil so odd counts split the median into the "top".
  const topHalfCutoff = useMemo(() => Math.ceil(entries.length / 2), [entries.length]);

  // Observe own-row visibility within the scroll container. When out of view → show sticky pinned row.
  // IntersectionObserver fires the callback once on observe() with the initial state, so we don't
  // need a synchronous reset on effect entry (which would trip react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!ownEntry || !scrollRef.current || !ownRowRef.current) return;
    const root = scrollRef.current;
    const target = ownRowRef.current;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setOwnRowVisible(entry?.isIntersecting ?? true);
      },
      // threshold 0.5 — consider visible only when at least half the row is in view
      { root, threshold: 0.5 }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [ownEntry, entries.length]);

  // Build a sticky entry. If viewer isn't in top 100, synthesize from useUser() profile + yourRank.
  const stickyEntry: LeaderboardEntry | null = useMemo(() => {
    if (ownEntry) return ownEntry;
    if (!viewerId || !profile || yourRank == null) return null;
    return {
      rank_position: yourRank,
      id: viewerId,
      display_name: profile.display_name ?? "You",
      avatar_url: profile.avatar_url ?? null,
      tier: (profile.tier ?? 5) as Tier,
      position: profile.position ?? null,
      class: profile.class ?? null,
      subclass: profile.subclass ?? null,
      level: profile.level ?? 1,
      xp: profile.xp ?? 0,
      rank: profile.rank ?? "Initiate",
      is_active: profile.is_active ?? true,
    };
  }, [ownEntry, viewerId, profile, yourRank]);

  // Sticky row shows when: viewer has a sticky entry AND either out of top 100 (no ownEntry) OR ownEntry exists but scrolled out of view
  const showStickyOwnRow = stickyEntry !== null && (!ownEntry || !ownRowVisible);

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
        <div className="flex gap-2 mb-2">
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

        {/* Period note — weekly/monthly not yet wired (no xp_log table) */}
        <p
          className="text-xs mb-4"
          style={{
            color: "var(--color-text-muted)",
            minHeight: 18,
            opacity: period === "all_time" ? 0 : 1,
            transition: "opacity 0.15s",
          }}
          aria-live="polite"
        >
          {period === "all_time"
            ? ""
            : "Weekly / Monthly XP windows coming soon — showing All-Time totals."}
        </p>

        {/* Privacy note for non-admin viewers */}
        {!isAdmin && !loading && entries.length > 0 ? (
          <p className="text-xs mb-4" style={{ color: "var(--color-text-subtle)" }}>
            Top half of the leaderboard is public. Bottom half is anonymized — only your own row is shown clearly.
          </p>
        ) : null}

        {/* Table */}
        <div
          className="rounded-2xl overflow-hidden relative"
          style={{ background: "#111827", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Header Row */}
          <div
            className="grid items-center font-mono text-xs uppercase tracking-wider"
            style={{
              gridTemplateColumns: GRID_COLS,
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

          {/* Scrollable rows container — capped height enables sticky-out-of-view behavior */}
          <div
            ref={scrollRef}
            style={{
              maxHeight: "min(60vh, 560px)",
              overflowY: "auto",
              // leave room when sticky row is visible so last entries aren't covered
              paddingBottom: showStickyOwnRow ? 72 : 0,
              transition: "padding-bottom 0.15s",
            }}
          >
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
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Trophy className="w-8 h-8 mb-3" style={{ color: "var(--color-text-subtle)" }} />
                <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>No rankings yet for this period.</p>
              </div>
            ) : (
              entries.map((m, i) => {
                const rank = m.rank_position ?? i + 1;
                const isOwn = viewerId !== null && m.id === viewerId;
                // Anonymize bottom half for non-admin, non-self rows
                const inBottomHalf = rank > topHalfCutoff;
                const shouldAnonymize = !isAdmin && !isOwn && inBottomHalf;
                return (
                  <Row
                    key={m.id}
                    entry={m}
                    rank={rank}
                    isOwn={isOwn}
                    anonymized={shouldAnonymize}
                    rowRef={isOwn ? ownRowRef : undefined}
                  />
                );
              })
            )}
          </div>

          {/* Sticky own-row pinned at bottom of frame when scrolled out of view */}
          {showStickyOwnRow && stickyEntry ? (
            <div
              style={{
                position: "sticky",
                bottom: 0,
                left: 0,
                right: 0,
                background: "#0d1626",
                borderTop: "1px dashed var(--glass-border-soft)",
                boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.35)",
              }}
              aria-label="Your row (pinned)"
            >
              <Row
                entry={stickyEntry}
                rank={stickyEntry.rank_position}
                isOwn
                anonymized={false}
                pinned
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─── Row ────────────────────────────────────────────────────────────────────

interface RowProps {
  entry: LeaderboardEntry;
  rank: number;
  isOwn: boolean;
  anonymized: boolean;
  pinned?: boolean;
  rowRef?: React.RefObject<HTMLDivElement | null>;
}

function Row({ entry, rank, isOwn, anonymized, pinned, rowRef }: RowProps) {
  const tier = (entry.tier ?? 5) as Tier;
  const tierStyle = TIER_COLORS[tier];

  // Anonymization rules:
  // - name → "Member #{rank}"
  // - avatar initial → "?", greyscale color
  // - tier badge greyed
  // - XP / Level hidden (privacy: don't leak progress)
  const displayName = anonymized ? `Member #${rank}` : entry.display_name ?? "Unknown";
  const avatarInitial = anonymized ? "?" : (entry.display_name ?? "?")[0]?.toUpperCase();
  const avatarBg = anonymized ? "rgba(255,255,255,0.04)" : tierStyle.bg;
  const avatarBorder = anonymized ? "#3f3f46" : tierStyle.border;
  const avatarColor = anonymized ? "#6b7280" : tierStyle.color;
  const nameColor = anonymized ? "var(--color-text-muted)" : "var(--color-text-main)";
  const tierLabelColor = anonymized ? "#6b7280" : tierStyle.color;

  // Own-row highlight per ux-leaderboard.md §6
  const ownBg = pinned ? OWN_ROW_BG_STICKY : OWN_ROW_BG;

  return (
    <div
      ref={rowRef}
      className="grid items-center transition-colors hover:bg-white/[0.03]"
      style={{
        gridTemplateColumns: GRID_COLS,
        height: 56,
        padding: "0 16px",
        gap: 12,
        borderBottom: pinned ? "none" : "1px solid rgba(255,255,255,0.04)",
        background: isOwn ? ownBg : "transparent",
        borderLeft: isOwn ? `3px solid ${OWN_ROW_ACCENT}` : "3px solid transparent",
      }}
    >
      <span
        className="text-right pr-2 font-mono font-bold"
        style={{ fontSize: 16, color: RANK_COLORS[rank] ?? "#9ca3af" }}
      >
        {rank}
      </span>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
        style={{
          background: avatarBg,
          color: avatarColor,
          border: `2px solid ${avatarBorder}`,
          filter: anonymized ? "saturate(0)" : undefined,
        }}
      >
        {avatarInitial}
      </div>
      <span
        className="text-sm font-semibold truncate"
        style={{ color: nameColor, fontStyle: anonymized ? "italic" : "normal" }}
      >
        {displayName}
        {isOwn ? (
          <span className="ml-1.5 text-xs font-normal" style={{ color: "var(--color-text-muted)" }}>
            (You)
          </span>
        ) : null}
      </span>
      <span
        className="hidden sm:block font-mono text-sm"
        style={{ color: anonymized ? "transparent" : "var(--color-text-soft)" }}
      >
        {anonymized ? "—" : `Lv.${entry.level ?? 1}`}
      </span>
      <span
        className="text-right font-mono text-sm font-medium"
        style={{ color: anonymized ? "var(--color-text-subtle)" : "var(--color-text-main)" }}
      >
        {anonymized ? "—" : (entry.xp ?? 0).toLocaleString()}
      </span>
      <span
        className="hidden md:block text-right text-xs font-mono font-bold"
        style={{ color: tierLabelColor }}
      >
        {anonymized ? "—" : `T${tier}`}
      </span>
    </div>
  );
}
