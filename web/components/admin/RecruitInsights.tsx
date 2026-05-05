"use client";

// Per-position funnel + volume views computed entirely client-side from
// the applications array already loaded by /admin/recruit. Keeps the
// admin dashboard as a single page without extra fetches.

import { useState, useMemo } from "react";
import {
  STATUS_LABELS,
  STATUS_COLORS,
  type Application,
  type ApplicationStatus,
  type Position,
} from "@/lib/recruitment";

const PIPELINE_STAGES: ApplicationStatus[] = [
  "submitted",
  "screening",
  "interview_invite",
  "interview",
  "final_review",
  "offer",
];

const TERMINAL_STAGES: ApplicationStatus[] = [
  "offer",
  "waitlist",
  "declined",
];

interface RecruitInsightsProps {
  applications: Application[];
  positions: Position[];
}

type View = "funnel" | "volume";

export default function RecruitInsights({
  applications,
  positions,
}: RecruitInsightsProps) {
  const [view, setView] = useState<View>("funnel");

  return (
    <div>
      {/* Sub-nav */}
      <div className="flex items-center gap-1 mb-8">
        <SubTab label="Funnel" active={view === "funnel"} onClick={() => setView("funnel")} />
        <SubTab label="Volume" active={view === "volume"} onClick={() => setView("volume")} />
      </div>

      {view === "funnel" ? (
        <FunnelView applications={applications} positions={positions} />
      ) : (
        <VolumeView applications={applications} positions={positions} />
      )}
    </div>
  );
}

function SubTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 rounded-full text-xs transition-colors"
      style={{
        background: active ? "rgba(29,155,240,0.12)" : "transparent",
        border: `1px solid ${active ? "rgba(29,155,240,0.4)" : "rgba(255,255,255,0.08)"}`,
        color: active ? "#1D9BF0" : "rgba(255,255,255,0.5)",
        fontFamily: "var(--font-highlight)",
      }}
    >
      {label}
    </button>
  );
}

// ─────────────────────────────────────────────────────────
// Funnel
// ─────────────────────────────────────────────────────────

function FunnelView({
  applications,
  positions,
}: {
  applications: Application[];
  positions: Position[];
}) {
  // Group applications by position id; compute funnel counts per position.
  const groups = useMemo(() => {
    const byPos = new Map<string, Application[]>();
    for (const a of applications) {
      const key = a.position_id;
      const arr = byPos.get(key) ?? [];
      arr.push(a);
      byPos.set(key, arr);
    }
    return positions
      .map((p) => ({ position: p, apps: byPos.get(p.id) ?? [] }))
      .sort((a, b) => b.apps.length - a.apps.length);
  }, [applications, positions]);

  if (groups.length === 0) {
    return (
      <p className="text-sm text-[#6B7280] text-center py-12">
        No applications yet.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {groups.map(({ position, apps }) => (
        <PositionFunnel
          key={position.id}
          position={position}
          apps={apps}
        />
      ))}
    </div>
  );
}

function PositionFunnel({
  position,
  apps,
}: {
  position: Position;
  apps: Application[];
}) {
  const total = apps.length;
  const declinedCount = apps.filter((a) => a.status === "declined").length;
  const waitlistCount = apps.filter((a) => a.status === "waitlist").length;

  // For each stage, count how many applicants ever reached or passed it.
  // An applicant has "reached" stage X if their status index >= X, OR
  // their status is a terminal status that comes after (offer = past final_review).
  const stageCounts = PIPELINE_STAGES.map((stage, i) => {
    const count = apps.filter((a) =>
      hasReachedStage(a, i)
    ).length;
    return { stage, count };
  });

  const maxCount = Math.max(total, 1);

  // Per-stage drill: who's currently at this status (snapshot, not cumulative)
  const [expanded, setExpanded] = useState<ApplicationStatus | null>(null);

  return (
    <section
      className="rounded-2xl px-6 py-6"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <header className="flex items-baseline justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-[#F1FFFF]">
            {position.title}
          </h2>
          <p className="text-xs text-[#6B7280] font-mono mt-0.5">
            {total} applicant{total === 1 ? "" : "s"} · {declinedCount} declined
            {waitlistCount > 0 ? ` · ${waitlistCount} waitlisted` : ""}
          </p>
        </div>
      </header>

      <div className="space-y-2">
        {stageCounts.map(({ stage, count }, i) => {
          const pct = (count / maxCount) * 100;
          const dropoff = i === 0 ? 0 : stageCounts[i - 1].count - count;
          const color = STATUS_COLORS[stage];
          const currentAtStage = apps.filter((a) => a.status === stage);
          const isExpanded = expanded === stage;

          return (
            <div key={stage}>
              <button
                onClick={() =>
                  setExpanded(isExpanded ? null : stage)
                }
                className="w-full text-left group"
                disabled={currentAtStage.length === 0}
              >
                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-[#9CA3AF] w-32 flex-shrink-0">
                    {STATUS_LABELS[stage]}
                  </span>
                  <div className="flex-1 relative h-7 rounded-md overflow-hidden bg-white/[0.03]">
                    <div
                      className="absolute inset-y-0 left-0 transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: `${color}26`,
                        borderRight: `2px solid ${color}`,
                      }}
                    />
                    <div className="relative h-full flex items-center justify-between px-3">
                      <span
                        className="text-xs font-mono tabular-nums"
                        style={{ color: "#F1FFFF" }}
                      >
                        {count}
                      </span>
                      {currentAtStage.length > 0 && (
                        <span className="text-[10px] text-[#6B7280] font-mono group-hover:text-[#9CA3AF] transition">
                          {currentAtStage.length} here · {isExpanded ? "hide" : "view"}
                        </span>
                      )}
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-mono w-20 text-right flex-shrink-0"
                    style={{
                      color: dropoff > 0 ? "#EF4444" : "#3f3f46",
                    }}
                  >
                    {dropoff > 0 ? `−${dropoff} lost` : ""}
                  </span>
                </div>
              </button>
              {isExpanded && (
                <ul className="mt-2 ml-32 mb-3 space-y-1">
                  {currentAtStage.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center gap-3 text-xs text-[#9CA3AF]"
                    >
                      <span className="w-1 h-1 rounded-full bg-[#1D9BF0]" />
                      <span className="text-[#F1FFFF]">{a.full_name}</span>
                      <span className="text-[#6B7280]">{a.email}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}

        {/* Terminal outcomes */}
        <div className="pt-4 mt-4 border-t border-white/[0.05] grid grid-cols-3 gap-3">
          {TERMINAL_STAGES.map((s) => {
            const count = apps.filter((a) => a.status === s).length;
            const color = STATUS_COLORS[s];
            return (
              <div
                key={s}
                className="rounded-lg px-3 py-2"
                style={{
                  background: `${color}0d`,
                  border: `1px solid ${color}33`,
                }}
              >
                <p
                  className="text-[10px] font-mono uppercase tracking-wider"
                  style={{ color }}
                >
                  {STATUS_LABELS[s]}
                </p>
                <p
                  className="text-lg font-mono tabular-nums mt-0.5"
                  style={{ color: "#F1FFFF" }}
                >
                  {count}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// "Reached or passed" stage at index i. Reached means the applicant either:
// - is currently at stage i or beyond in the linear pipeline, or
// - has a terminal status and the prior advance brought them past i.
// We approximate using status_releases: if any release.new_status maps to
// an index >= i, they reached it. Falls back to current status index.
function hasReachedStage(app: Application, stageIndex: number): boolean {
  const idx = (s: ApplicationStatus): number => {
    const i = PIPELINE_STAGES.indexOf(s);
    if (i >= 0) return i;
    // Terminal statuses: they came from somewhere. Map "offer" to past
    // final_review; declined/waitlist count for whatever stage they
    // were at before the rejection (use releases).
    if (s === "offer") return PIPELINE_STAGES.length;
    return -1;
  };
  if (idx(app.status) >= stageIndex) return true;
  // Look at releases to see if they ever hit this stage
  for (const r of app.releases ?? []) {
    if (idx(r.new_status as ApplicationStatus) >= stageIndex) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────
// Volume
// ─────────────────────────────────────────────────────────

function VolumeView({
  applications,
  positions,
}: {
  applications: Application[];
  positions: Position[];
}) {
  const total = applications.length;

  // Per-position counts
  const perPosition = useMemo(() => {
    const map = new Map<string, number>();
    for (const a of applications) {
      map.set(a.position_id, (map.get(a.position_id) ?? 0) + 1);
    }
    return positions
      .map((p) => ({ position: p, count: map.get(p.id) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [applications, positions]);

  // Per-day counts over the last 14 days
  const perDay = useMemo(() => {
    const days: { date: Date; iso: string; count: number }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push({
        date: d,
        iso: d.toISOString().slice(0, 10),
        count: 0,
      });
    }
    for (const a of applications) {
      const iso = new Date(a.submitted_at).toISOString().slice(0, 10);
      const day = days.find((d) => d.iso === iso);
      if (day) day.count++;
    }
    return days;
  }, [applications]);

  const maxPerDay = Math.max(1, ...perDay.map((d) => d.count));
  const maxPerPos = Math.max(1, ...perPosition.map((p) => p.count));

  return (
    <div className="space-y-8">
      {/* Total */}
      <div
        className="rounded-2xl px-6 py-5 flex items-baseline gap-4"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <span className="text-3xl md:text-4xl font-semibold text-[#F1FFFF] tabular-nums">
          {total}
        </span>
        <span className="text-sm text-[#6B7280] font-mono">
          total applications
        </span>
      </div>

      {/* Per-day timeline */}
      <div
        className="rounded-2xl px-6 py-5"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <p className="text-xs font-mono tracking-[0.2em] uppercase text-[#6B7280] mb-4">
          Last 14 days
        </p>
        <div className="flex items-end gap-1.5 h-28">
          {perDay.map((d) => {
            const h = (d.count / maxPerDay) * 100;
            const isToday = d.iso === new Date().toISOString().slice(0, 10);
            return (
              <div
                key={d.iso}
                className="flex-1 flex flex-col items-center gap-1.5 group"
              >
                <span className="text-[10px] font-mono text-[#6B7280] opacity-0 group-hover:opacity-100 transition">
                  {d.count}
                </span>
                <div
                  className="w-full rounded-sm transition-all"
                  style={{
                    height: `${Math.max(h, d.count > 0 ? 8 : 2)}%`,
                    minHeight: "2px",
                    background:
                      d.count > 0
                        ? isToday
                          ? "#1D9BF0"
                          : "rgba(29,155,240,0.5)"
                        : "rgba(255,255,255,0.06)",
                  }}
                />
                <span className="text-[9px] font-mono text-[#6B7280] tabular-nums">
                  {d.date.getDate()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-position bars */}
      <div
        className="rounded-2xl px-6 py-5"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <p className="text-xs font-mono tracking-[0.2em] uppercase text-[#6B7280] mb-4">
          By position
        </p>
        <div className="space-y-3">
          {perPosition.length === 0 ? (
            <p className="text-sm text-[#6B7280]">No active positions.</p>
          ) : (
            perPosition.map(({ position, count }) => {
              const pct = (count / maxPerPos) * 100;
              return (
                <div
                  key={position.id}
                  className="flex items-center gap-3"
                >
                  <span className="text-sm text-[#E5E7EB] w-40 flex-shrink-0 truncate">
                    {position.title}
                  </span>
                  <div className="flex-1 relative h-6 rounded-md overflow-hidden bg-white/[0.03]">
                    <div
                      className="absolute inset-y-0 left-0 transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: "rgba(29,155,240,0.18)",
                        borderRight:
                          count > 0 ? "2px solid #1D9BF0" : "none",
                      }}
                    />
                  </div>
                  <span className="text-sm font-mono tabular-nums text-[#F1FFFF] w-10 text-right">
                    {count}
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
