"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Trophy } from "lucide-react";
import type { LeaderboardEntry, Tier } from "@/lib/supabase/types";
import { useUser } from "@/components/portal/UserContext";
import { Badge, Banner, Empty, Loading } from "@/components/gui";
import { TIER_LOOK } from "@/components/portal/classIdentity";

// The top three wear a coin: gold, silver (a pale well with a rim) and bronze (the kit's coral). Ink on each (AA).
const RANK_COINS: Record<number, { bg: string; ring?: string }> = {
  1: { bg: "var(--gui-gold)" },
  2: { bg: "var(--gui-paper-deep)", ring: "var(--gui-paper-line)" },
  3: { bg: "var(--gui-coral)" },
};

// Own-row highlight (per ux-leaderboard.md §6, in the cream kit): the butter selection with a sage edge.
const OWN_ROW_BG = "color-mix(in srgb, var(--gui-butter) 60%, var(--gui-paper-hi))";
const OWN_ROW_BG_STICKY = "var(--gui-butter)";
const OWN_ROW_ACCENT = "var(--gui-sage)";

// Grid columns, shared between header + every row + sticky row so columns align. Level shows from sm, Tier from md
// (ux-leaderboard.md §8), so the template drops those tracks below them instead of leaving empty columns.
const GRID_COLS =
  "grid-cols-[40px_40px_minmax(0,1fr)_80px] sm:grid-cols-[40px_40px_minmax(0,1fr)_60px_80px] md:grid-cols-[40px_40px_minmax(0,1fr)_60px_80px_50px]";

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
  }, []);

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
    <div className="flex-1 overflow-y-auto" style={{ padding: "24px 20px 48px" }}>
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Banner title="Leaderboard" icon={<Trophy size={26} />} tone="sage">
          Members ranked by the XP they’ve earned with the club.
        </Banner>

        {/* Privacy note for non-admin viewers */}
        {!isAdmin && !loading && entries.length > 0 ? (
          <p className="text-xs mb-4" style={{ color: "var(--gui-muted)" }}>
            Names show for the top half of the board. The bottom half stays anonymous, apart from your own row.
          </p>
        ) : null}

        {/* Table */}
        <div
          className="overflow-hidden relative"
          style={{
            background: "var(--gui-paper-hi)",
            border: "1.5px solid var(--gui-paper-edge)",
            borderRadius: "var(--gui-r-card)",
            boxShadow: "var(--gui-shadow-sm)",
          }}
        >
          {/* Header Row */}
          <div
            className={`grid ${GRID_COLS} items-center text-xs`}
            style={{
              height: 36,
              padding: "0 16px",
              gap: 12,
              color: "var(--gui-muted)",
              fontWeight: 800,
              background: "var(--gui-paper-warm)",
              borderLeft: "3px solid transparent",
              borderBottom: "1px solid var(--gui-paper-edge)",
            }}
          >
            <span className="text-center">#</span>
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
              <Loading label="Loading the leaderboard…" />
            ) : entries.length === 0 ? (
              <Empty icon={<Trophy size={32} />} title="No rankings yet">
                Check in at a club event to start earning XP.
              </Empty>
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
                background: OWN_ROW_BG_STICKY,
                borderTop: "2px dashed var(--gui-paper-line)",
                boxShadow: "0 -6px 14px rgb(79 63 49 / 0.12)",
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
  const tierLook = TIER_LOOK[tier];

  // Anonymization rules:
  // - name → "Member #{rank}"
  // - avatar initial → "?", greyscale color
  // - tier badge greyed
  // - XP / Level hidden (privacy: don't leak progress)
  const displayName = anonymized ? `Member #${rank}` : entry.display_name ?? "Unknown";
  const avatarInitial = anonymized ? "?" : (entry.display_name ?? "?")[0]?.toUpperCase();
  const avatarBg = anonymized ? "var(--gui-paper-deep)" : "var(--gui-paper-hi)";
  const avatarBorder = anonymized ? "var(--gui-paper-line)" : tierLook.ring;
  const avatarColor = anonymized ? "var(--gui-muted)" : "var(--gui-ink-strong)";
  const nameColor = anonymized ? "var(--gui-muted)" : "var(--gui-ink-strong)";

  // Own-row highlight per ux-leaderboard.md §6
  const ownBg = pinned ? OWN_ROW_BG_STICKY : OWN_ROW_BG;
  const coin = RANK_COINS[rank];

  return (
    <div
      ref={rowRef}
      className={`grid ${GRID_COLS} items-center transition-colors hover:bg-[var(--gui-paper-warm)]`}
      style={{
        height: 56,
        padding: "0 16px",
        gap: 12,
        borderBottom: pinned ? "none" : "1px solid var(--gui-paper-edge)",
        // Inline only for your own row, so the hover wash still shows on everyone else's.
        background: isOwn ? ownBg : undefined,
        borderLeft: isOwn ? `3px solid ${OWN_ROW_ACCENT}` : "3px solid transparent",
      }}
    >
      <span className="flex justify-center">
        {coin ? (
          <span
            className="inline-grid place-items-center w-7 h-7 rounded-full text-sm"
            style={{
              background: coin.bg,
              color: "var(--gui-ink-strong)",
              fontWeight: 800,
              boxShadow: coin.ring ? `inset 0 0 0 2px ${coin.ring}` : "var(--gui-shadow-sm)",
            }}
          >
            {rank}
          </span>
        ) : (
          <span style={{ fontSize: 16, fontWeight: 800, color: "var(--gui-ink-2)", fontVariantNumeric: "tabular-nums" }}>
            {rank}
          </span>
        )}
      </span>
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs shrink-0"
        style={{
          background: avatarBg,
          color: avatarColor,
          fontWeight: 800,
          border: `2px solid ${avatarBorder}`,
          filter: anonymized ? "saturate(0)" : undefined,
        }}
      >
        {avatarInitial}
      </div>
      <span
        className="text-sm truncate"
        style={{ color: nameColor, fontWeight: 700, fontStyle: anonymized ? "italic" : "normal" }}
      >
        {displayName}
        {isOwn ? (
          <span className="ml-1.5 text-xs" style={{ color: "var(--gui-ink-2)", fontWeight: 600 }}>
            (you)
          </span>
        ) : null}
      </span>
      <span
        className="hidden sm:block text-sm"
        style={{ color: anonymized ? "transparent" : "var(--gui-ink-2)" }}
      >
        {anonymized ? "—" : `Lv.${entry.level ?? 1}`}
      </span>
      <span
        className="text-right text-sm"
        style={{
          color: anonymized ? "var(--gui-muted)" : "var(--gui-ink-strong)",
          fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {anonymized ? "—" : (entry.xp ?? 0).toLocaleString()}
      </span>
      <span className="hidden md:block text-right text-xs">
        {anonymized ? (
          <span style={{ color: "var(--gui-muted)", fontWeight: 800 }}>—</span>
        ) : (
          <Badge tone={tierLook.tone}>T{tier}</Badge>
        )}
      </span>
    </div>
  );
}
