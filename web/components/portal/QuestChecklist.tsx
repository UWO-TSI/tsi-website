"use client";

/**
 * QuestChecklist (sprint R3-1) — floating onboarding-quest widget.
 *
 * Spec: `specs/ux-onboarding.md` §4-5 + `specs/sprint-2026-06-tier-1-followups.md` R3-1.
 *
 * - Bottom-right floating widget on every dashboard page. Collapsible:
 *   icon-only at 56×56px (48×48 on mobile) when closed, expanded panel when open.
 * - Opt-in per design principle #7 (T1-T3 senior members can mute). Mute toggle
 *   lives in Settings → Appearance via localStorage key `tsi.quests.muted`. Widget
 *   reads on mount + subscribes to storage events for cross-tab sync.
 * - MVP quests sourced from a hardcoded array below. No migration. Completion
 *   state persisted in localStorage key `tsi.quests.v1.completed` (string array of
 *   quest ids, JSON-encoded).
 * - Rewards: NONE. Per design principle #3, online activity grants no TC/XP.
 *   Quests are signposts only. UI states this explicitly.
 * - Mobile (<640px): collapses to a 48×48 icon. Tapping expands as a bottom sheet
 *   (full-width, pull-down / handle-tap / backdrop-tap to close).
 */

import { useState, useSyncExternalStore } from "react";
import { CheckSquare, Square, ChevronDown, X, Sparkles } from "lucide-react";
import { useUser } from "./UserContext";

// ─── Quest data (hardcoded MVP per task spec) ───────────────────────────────
interface Quest {
  id: string;
  title: string;
  hint: string;
}

const QUESTS: readonly Quest[] = [
  {
    id: "visit_oracle",
    title: "Visit the Oracle Temple",
    hint: "Find the temple in the world and take the class quiz.",
  },
  {
    id: "claim_bounty",
    title: "Claim your first bounty",
    hint: "Open the Bounty Board and pick something that fits.",
  },
  {
    id: "add_social_link",
    title: "Add a social link",
    hint: "Settings → Social. GitHub or LinkedIn is plenty.",
  },
  {
    id: "check_leaderboard",
    title: "Check the leaderboard",
    hint: "See where you stand. Bottom half is anonymized.",
  },
  {
    id: "attend_irl_event",
    title: "Attend an IRL event",
    hint: "Scan the QR code at a Tethos event to bank real XP.",
  },
] as const;

// ─── localStorage: completion state ──────────────────────────────────────────
// Uses useSyncExternalStore so hydration + cross-tab sync don't need a setState-
// in-effect (matches the useGhostReplaySetting pattern).
const COMPLETED_KEY = "tsi.quests.v1.completed";
const completedListeners = new Set<Listener>();

function readCompletedRaw(): string {
  if (typeof window === "undefined") return "[]";
  try {
    return window.localStorage.getItem(COMPLETED_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parseCompleted(raw: string): Set<string> {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((s): s is string => typeof s === "string"));
  } catch {
    return new Set();
  }
}

function writeCompleted(next: Set<string>) {
  try {
    window.localStorage.setItem(COMPLETED_KEY, JSON.stringify([...next]));
  } catch {
    /* ignore quota / private-mode failures */
  }
  for (const l of completedListeners) l();
}

function subscribeCompleted(cb: Listener): () => void {
  completedListeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === COMPLETED_KEY) cb();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    completedListeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

const EMPTY_COMPLETED_RAW = "[]";
function getCompletedServerSnapshot(): string {
  return EMPTY_COMPLETED_RAW;
}

function useCompletedQuests(): [Set<string>, (id: string) => void] {
  const raw = useSyncExternalStore(subscribeCompleted, readCompletedRaw, getCompletedServerSnapshot);
  const completed = parseCompleted(raw);
  const toggle = (id: string) => {
    const next = parseCompleted(readCompletedRaw());
    if (next.has(id)) next.delete(id);
    else next.add(id);
    writeCompleted(next);
  };
  return [completed, toggle];
}

// ─── localStorage: mute setting ─────────────────────────────────────────────
// Mirrors the useSyncExternalStore pattern from useGhostReplaySetting.
const MUTED_KEY = "tsi.quests.muted";
type Listener = () => void;
const mutedListeners = new Set<Listener>();

function subscribeMuted(cb: Listener): () => void {
  mutedListeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === MUTED_KEY) cb();
  };
  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }
  return () => {
    mutedListeners.delete(cb);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
}

function getMutedSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTED_KEY) === "true";
  } catch {
    return false;
  }
}

function getMutedServerSnapshot(): boolean {
  return false;
}

export function useQuestsMuted(): [boolean, (next: boolean) => void] {
  const muted = useSyncExternalStore(subscribeMuted, getMutedSnapshot, getMutedServerSnapshot);
  const set = (next: boolean) => {
    try {
      window.localStorage.setItem(MUTED_KEY, String(next));
    } catch {
      /* ignore */
    }
    for (const l of mutedListeners) l();
  };
  return [muted, set];
}

// ─── Mobile viewport detection ──────────────────────────────────────────────
function subscribeMobile(cb: Listener): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(max-width: 639px)");
  if (mq.addEventListener) mq.addEventListener("change", cb);
  else mq.addListener(cb);
  return () => {
    if (mq.removeEventListener) mq.removeEventListener("change", cb);
    else mq.removeListener(cb);
  };
}

function getMobileSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 639px)").matches;
}

function getMobileServerSnapshot(): boolean {
  return false;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function QuestChecklist() {
  const { profile, loading } = useUser();
  const [muted] = useQuestsMuted();
  const [completed, toggle] = useCompletedQuests();

  // Open/closed widget state. Default: closed (icon-only). Persists in session only.
  const [open, setOpen] = useState(false);

  // Mobile detection — used to render the bottom-sheet variant.
  const isMobile = useSyncExternalStore(
    subscribeMobile,
    getMobileSnapshot,
    getMobileServerSnapshot,
  );

  // Hide entirely when:
  //   - User context still loading (avoid pop-in before tier known).
  //   - User has muted via Settings → Appearance.
  //   - Tier 1-3 default to muted-by-explicit-opt-out (they can re-enable via Settings).
  //     Per design principle #7: "Senior members can mute the game-feel."
  //     The mute toggle is the single source of truth; tier doesn't auto-mute.
  if (loading) return null;
  if (muted) return null;

  // Don't render until profile resolved — avoids flashing on logged-out pages.
  if (!profile) return null;

  const completedCount = [...completed].filter((id) => QUESTS.some((q) => q.id === id)).length;
  const totalCount = QUESTS.length;
  const allDone = completedCount === totalCount;

  // ─── Collapsed icon (closed state) ────────────────────────────────────────
  if (!open) {
    const size = isMobile ? 48 : 56;
    return (
      <button
        type="button"
        aria-label={`Open onboarding quests (${completedCount} of ${totalCount} complete)`}
        title="Onboarding quests"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          bottom: 16,
          right: 16,
          width: size,
          height: size,
          borderRadius: "50%",
          background: "var(--color-bg-navy, #0d1b2a)",
          border: "1px solid rgba(0, 47, 167, 0.4)",
          color: "var(--color-text-main, #f1ffff)",
          cursor: "pointer",
          zIndex: 30,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--shadow-soft, 0 4px 16px rgba(0,0,0,0.25))",
          transition: "transform 0.15s ease, background 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "scale(1.05)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "scale(1)";
        }}
      >
        <Sparkles
          aria-hidden="true"
          style={{ width: 20, height: 20, color: allDone ? "#22c55e" : "var(--color-brand-blue, #1D9BF0)" }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 20,
            height: 20,
            padding: "0 6px",
            borderRadius: 10,
            background: allDone ? "#22c55e" : "var(--color-brand-blue, #1D9BF0)",
            color: "#f1ffff",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "1px solid var(--color-bg-navy, #0d1b2a)",
          }}
        >
          {completedCount}/{totalCount}
        </span>
      </button>
    );
  }

  // ─── Expanded panel (mobile = bottom sheet, desktop = floating card) ──────
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        <div
          aria-hidden="true"
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 29,
            animation: "questFade 0.2s ease-out",
          }}
        />
        {/* Bottom sheet */}
        <div
          role="dialog"
          aria-label="Onboarding quests"
          style={{
            position: "fixed",
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 30,
            background: "var(--color-bg-navy, #0d1b2a)",
            borderTop: "1px solid rgba(0, 47, 167, 0.3)",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            boxShadow: "0 -8px 24px rgba(0,0,0,0.4)",
            padding: 16,
            paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))",
            animation: "questSlideUp 0.25s ease-out",
            maxHeight: "80vh",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Pull-handle (tap to close) */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close quests"
            style={{
              alignSelf: "center",
              width: 40,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.2)",
              border: "none",
              padding: 0,
              cursor: "pointer",
              marginBottom: 12,
              flexShrink: 0,
            }}
          />
          <QuestPanelContent
            completed={completed}
            completedCount={completedCount}
            totalCount={totalCount}
            allDone={allDone}
            onToggle={toggle}
            onClose={() => setOpen(false)}
            showCloseButton={false}
          />
        </div>
        <style jsx>{`
          @keyframes questSlideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          @keyframes questFade {
            from { opacity: 0; }
            to { opacity: 1; }
          }
        `}</style>
      </>
    );
  }

  // Desktop expanded panel.
  return (
    <div
      role="dialog"
      aria-label="Onboarding quests"
      style={{
        position: "fixed",
        bottom: 16,
        right: 16,
        width: 320,
        maxHeight: "min(70vh, 560px)",
        zIndex: 30,
        background: "var(--color-bg-navy, #0d1b2a)",
        border: "1px solid rgba(0, 47, 167, 0.3)",
        borderRadius: 16,
        boxShadow: "var(--shadow-soft, 0 8px 24px rgba(0,0,0,0.35))",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        animation: "questFadeIn 0.18s ease-out",
      }}
    >
      <QuestPanelContent
        completed={completed}
        completedCount={completedCount}
        totalCount={totalCount}
        allDone={allDone}
        onToggle={toggle}
        onClose={() => setOpen(false)}
        showCloseButton={true}
      />
      <style jsx>{`
        @keyframes questFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ─── Panel body (shared between desktop card and mobile sheet) ──────────────
function QuestPanelContent({
  completed,
  completedCount,
  totalCount,
  allDone,
  onToggle,
  onClose,
  showCloseButton,
}: {
  completed: Set<string>;
  completedCount: number;
  totalCount: number;
  allDone: boolean;
  onToggle: (id: string) => void;
  onClose: () => void;
  showCloseButton: boolean;
}) {
  const percent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 12,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Sparkles
            aria-hidden="true"
            style={{
              width: 16,
              height: 16,
              color: allDone ? "#22c55e" : "var(--color-brand-blue, #1D9BF0)",
              flexShrink: 0,
            }}
          />
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--color-text-main, #f1ffff)",
              margin: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Onboarding Quests
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Collapse quests"
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "transparent",
            border: "none",
            color: "var(--color-text-muted, #98a2b3)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.06)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          {showCloseButton ? (
            <ChevronDown aria-hidden="true" style={{ width: 16, height: 16 }} />
          ) : (
            <X aria-hidden="true" style={{ width: 16, height: 16 }} />
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 4,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            color: "var(--color-text-subtle, #6b7280)",
          }}
        >
          {`${completedCount} / ${totalCount}`}
        </span>
        <div
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: "rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${percent}%`,
              height: "100%",
              background: allDone ? "#22c55e" : "var(--color-brand-blue, #1D9BF0)",
              transition: "width 0.3s ease, background 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Reward disclaimer (design principle #3) */}
      <p
        style={{
          fontSize: 11,
          color: "var(--color-text-subtle, #6b7280)",
          fontStyle: "italic",
          margin: "8px 0 12px",
          lineHeight: 1.4,
          flexShrink: 0,
        }}
      >
        Quest completion is for personal tracking — rewards come from real-world action.
      </p>

      {/* Quest list */}
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
        }}
      >
        {QUESTS.map((quest) => {
          const isDone = completed.has(quest.id);
          return (
            <li key={quest.id}>
              <button
                type="button"
                onClick={() => onToggle(quest.id)}
                aria-pressed={isDone}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "8px 8px",
                  background: "transparent",
                  border: "1px solid transparent",
                  borderRadius: 8,
                  textAlign: "left",
                  cursor: "pointer",
                  color: "inherit",
                  transition: "background 0.15s ease, border-color 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.03)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                {isDone ? (
                  <CheckSquare
                    aria-hidden="true"
                    style={{
                      width: 16,
                      height: 16,
                      color: "#22c55e",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                ) : (
                  <Square
                    aria-hidden="true"
                    style={{
                      width: 16,
                      height: 16,
                      color: "var(--color-text-subtle, #6b7280)",
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: isDone
                        ? "var(--color-text-subtle, #6b7280)"
                        : "var(--color-text-soft, #d1d5db)",
                      margin: 0,
                      textDecoration: isDone ? "line-through" : "none",
                      lineHeight: 1.4,
                    }}
                  >
                    {quest.title}
                  </p>
                  <p
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-subtle, #6b7280)",
                      margin: "2px 0 0",
                      lineHeight: 1.4,
                    }}
                  >
                    {quest.hint}
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {allDone && (
        <p
          style={{
            fontSize: 12,
            color: "#22c55e",
            margin: "12px 0 0",
            textAlign: "center",
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          All quests checked off. Welcome to Tethos.
        </p>
      )}
    </>
  );
}
