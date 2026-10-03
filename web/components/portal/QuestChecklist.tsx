"use client";

/**
 * QuestChecklist (sprint R3-1) — floating onboarding-quest widget.
 *
 * Spec: `specs/ux-onboarding.md` §4-5 + `specs/sprint-2026-06-tier-1-followups.md` R3-1.
 *
 * - Bottom-right floating widget on every dashboard page. Collapsible: a round
 *   paper bubble (56px, 44px on mobile) with a count of the quests left when
 *   closed, a paper card when open (the GUI sheet's IconButton, Counter, Progress).
 * - Opt-in per design principle #7 (T1-T3 senior members can mute). Mute toggle
 *   lives in Settings → World via localStorage key `tsi.quests.muted`. Widget
 *   reads on mount + subscribes to storage events for cross-tab sync.
 * - MVP quests sourced from a hardcoded array below. No migration. Completion
 *   state persisted in localStorage key `tsi.quests.v1.completed` (string array of
 *   quest ids, JSON-encoded).
 * - Rewards: NONE. Per design principle #3, online activity grants no TC/XP.
 *   Quests are signposts only. UI states this explicitly.
 * - Mobile (<640px): tapping the bubble expands a paper bottom sheet
 *   (full-width, handle-tap / backdrop-tap to close).
 */

import { useEffect, useState, useSyncExternalStore } from "react";
import { Circle, CircleCheck, ChevronDown, X, Sparkles } from "lucide-react";
import { useUser } from "./UserContext";
import { Counter, IconButton, Progress } from "@/components/gui";

// ─── Quest data (hardcoded MVP per task spec) ───────────────────────────────
interface Quest {
  id: string;
  title: string;
  hint: string;
  /** Optional window event that auto-completes this quest when it fires. */
  signal?: string;
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
    hint: "Open the bounty board and pick something that fits.",
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
  {
    id: "shake_a_tree",
    title: "Shake a tree",
    hint: "Walk up to a tree in the world and press E.",
    signal: "tsi:tree-shake",
  },
  {
    id: "pick_a_flower",
    title: "Pick a flower",
    hint: "Find a flower patch and press E to pick one.",
    signal: "tsi:flower-pick",
  },
  {
    id: "catch_a_fish",
    title: "Catch a fish",
    hint: "Cast a line at the riverbank and reel one in.",
    signal: "tsi:fish-caught",
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

// Idempotent add — used by the interaction-signal auto-complete.
function markComplete(id: string) {
  const cur = parseCompleted(readCompletedRaw());
  if (cur.has(id)) return;
  cur.add(id);
  writeCompleted(cur);
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
/** `hidden`: on the member island, where the chapter objective is the guide; the signals still tick quests off. */
export default function QuestChecklist({ hidden = false }: { hidden?: boolean }) {
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

  // Auto-complete cozy quests when their interaction signal fires. Runs while
  // the widget is mounted (always, in the dashboard layout) even when muted or
  // collapsed — doing the thing counts, whether or not you're watching the
  // list. Signals grant nothing but the checkmark (principle #3).
  useEffect(() => {
    const wired = QUESTS.filter((q) => q.signal);
    const handlers = wired.map((q) => {
      const h = () => markComplete(q.id);
      window.addEventListener(q.signal as string, h);
      return [q.signal as string, h] as const;
    });
    return () => {
      for (const [sig, h] of handlers) window.removeEventListener(sig, h);
    };
  }, []);

  // Hide entirely when:
  //   - User context still loading (avoid pop-in before tier known).
  //   - User has muted via Settings → World.
  //   - Tier 1-3 default to muted-by-explicit-opt-out (they can re-enable via Settings).
  //     Per design principle #7: "Senior members can mute the game-feel."
  //     The mute toggle is the single source of truth; tier doesn't auto-mute.
  if (hidden || loading) return null;
  if (muted) return null;

  // Don't render until profile resolved — avoids flashing on logged-out pages.
  if (!profile) return null;

  const completedCount = [...completed].filter((id) => QUESTS.some((q) => q.id === id)).length;
  const totalCount = QUESTS.length;
  const allDone = completedCount === totalCount;

  // ─── Collapsed bubble (closed state) ──────────────────────────────────────
  if (!open) {
    const iconSize = isMobile ? 20 : 24;
    return (
      <IconButton
        label={`Open onboarding quests (${completedCount} of ${totalCount} complete)`}
        title="Onboarding quests"
        size={isMobile ? "md" : "lg"}
        onClick={() => setOpen(true)}
        style={{ position: "fixed", bottom: 16, right: 16, zIndex: 30 }}
      >
        <Sparkles
          aria-hidden="true"
          style={{ width: iconSize, height: iconSize, color: allDone ? "var(--gui-success)" : "var(--gui-sage)" }}
        />
        <Counter n={totalCount - completedCount} className="absolute -top-1 -right-1" />
      </IconButton>
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
            background: "var(--gui-scrim)",
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
            background: "var(--gui-grain) var(--gui-paper)",
            color: "var(--gui-ink)",
            fontFamily: "var(--gui-font)",
            borderRadius: "28px 32px 0 0 / 26px 30px 0 0",
            boxShadow: "var(--gui-shadow-lg)",
            padding: "6px 18px 18px",
            paddingBottom: "calc(18px + env(safe-area-inset-bottom, 0px))",
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
              display: "grid",
              placeItems: "center",
              width: 64,
              height: 24,
              background: "transparent",
              border: "none",
              padding: 0,
              cursor: "pointer",
              marginBottom: 6,
              flexShrink: 0,
            }}
          >
            <span aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: "var(--gui-paper-line)" }} />
          </button>
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
        width: 330,
        maxHeight: "min(70vh, 560px)",
        zIndex: 30,
        background: "var(--gui-grain) var(--gui-paper)",
        color: "var(--gui-ink)",
        fontFamily: "var(--gui-font)",
        borderRadius: "var(--gui-r-paper)",
        boxShadow: "var(--gui-shadow-lg)",
        padding: "14px 14px 16px 18px",
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
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              display: "grid",
              placeItems: "center",
              width: 34,
              height: 34,
              flexShrink: 0,
              borderRadius: "var(--gui-r-blob)",
              background: allDone ? "var(--gui-success-soft)" : "var(--gui-sage-soft)",
              color: allDone ? "var(--gui-success)" : "var(--gui-sage)",
            }}
          >
            <Sparkles style={{ width: 18, height: 18 }} />
          </span>
          <h2
            style={{
              fontSize: 17,
              fontWeight: 800,
              color: "var(--gui-ink-strong)",
              margin: 0,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Onboarding quests
          </h2>
        </div>
        <IconButton label={showCloseButton ? "Collapse quests" : "Close quests"} size="sm" onClick={onClose}>
          {showCloseButton ? (
            <ChevronDown aria-hidden="true" style={{ width: 18, height: 18 }} />
          ) : (
            <X aria-hidden="true" style={{ width: 18, height: 18 }} />
          )}
        </IconButton>
      </div>

      {/* Progress */}
      <Progress
        value={completedCount}
        max={totalCount}
        kind={allDone ? "xp" : "plain"}
        label="Quests checked off"
        showLabel
        valueText={`${completedCount} of ${totalCount}`}
        size={10}
        className="shrink-0"
      />

      {/* Reward disclaimer (design principle #3) */}
      <p
        style={{
          fontSize: 13,
          color: "var(--gui-muted)",
          margin: "10px 0 10px",
          lineHeight: 1.4,
          flexShrink: 0,
        }}
      >
        These are just for you to keep track. Rewards come from real-world action.
      </p>

      {/* Quest list */}
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 2,
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
                className="bg-transparent hover:bg-[var(--gui-paper-warm)]"
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  padding: "8px 10px",
                  border: "none",
                  borderRadius: 14,
                  textAlign: "left",
                  cursor: "pointer",
                  color: "inherit",
                  font: "inherit",
                  transition: "background 0.15s ease",
                }}
              >
                {isDone ? (
                  <CircleCheck
                    aria-hidden="true"
                    style={{
                      width: 20,
                      height: 20,
                      color: "var(--gui-teal-ink)",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  />
                ) : (
                  <Circle
                    aria-hidden="true"
                    style={{
                      width: 20,
                      height: 20,
                      color: "var(--gui-muted)",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: isDone ? "var(--gui-muted)" : "var(--gui-ink)",
                      margin: 0,
                      textDecoration: isDone ? "line-through" : "none",
                      lineHeight: 1.35,
                    }}
                  >
                    {quest.title}
                  </p>
                  <p
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--gui-muted)",
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
            fontSize: 14,
            color: "var(--gui-success)",
            margin: "12px 0 0",
            textAlign: "center",
            fontWeight: 800,
            flexShrink: 0,
          }}
        >
          All quests checked off. Welcome to Tech for Social Impact.
        </p>
      )}
    </>
  );
}
