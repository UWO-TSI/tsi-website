"use client";

// Collapsed archive of finished rounds on the admin list. Rounds are
// derived from positions.archived_at (migration 028): every application
// whose position is archived lands here, grouped round → role, and stays
// out of the live list, board, insights, filters and release controls.
// The cards are the same ApplicantCard so notes and data read as they
// were submitted.

import { useMemo, useState } from "react";
import { Archive, ChevronRight } from "lucide-react";
import ApplicantCard from "@/components/admin/ApplicantCard";
import {
  roundLabel,
  type Application,
  type ApplicationStatus,
  type Position,
} from "@/lib/recruitment";

interface ArchivePanelProps {
  /** Archived applications only. */
  applications: Application[];
  /** Archived positions only. */
  positions: Position[];
  currentUserEmail: string;
  onStatusChange: (id: string, status: ApplicationStatus | null) => void;
  onTagsChange: (id: string, tags: string[]) => void;
  onNoteTextChange: (id: string, text: string) => void;
  onRelease: (id: string) => void;
  onDelete: (id: string) => void;
}

interface RoundGroup {
  label: string;
  sortKey: number;
  roles: { position: Position; apps: Application[] }[];
}

const noop = () => {};

export default function ArchivePanel({
  applications,
  positions,
  currentUserEmail,
  onStatusChange,
  onTagsChange,
  onNoteTextChange,
  onRelease,
  onDelete,
}: ArchivePanelProps) {
  const [open, setOpen] = useState(false);
  const [openRoles, setOpenRoles] = useState<Set<string>>(() => new Set());

  const rounds = useMemo<RoundGroup[]>(() => {
    const byPosition = new Map<string, Application[]>();
    for (const a of applications) {
      const arr = byPosition.get(a.position_id) ?? [];
      arr.push(a);
      byPosition.set(a.position_id, arr);
    }
    const byRound = new Map<string, RoundGroup>();
    for (const p of positions) {
      const label = roundLabel(p);
      const stamp = p.closes_at ?? p.archived_at;
      const group = byRound.get(label) ?? {
        label,
        sortKey: stamp ? new Date(stamp).getTime() : 0,
        roles: [],
      };
      group.roles.push({ position: p, apps: byPosition.get(p.id) ?? [] });
      byRound.set(label, group);
    }
    return Array.from(byRound.values())
      .map((g) => ({
        ...g,
        roles: g.roles
          .filter((r) => r.apps.length > 0)
          .sort((a, b) => a.position.title.localeCompare(b.position.title)),
      }))
      .filter((g) => g.roles.length > 0)
      .sort((a, b) => b.sortKey - a.sortKey);
  }, [applications, positions]);

  if (applications.length === 0) return null;

  const toggleRole = (id: string) => {
    setOpenRoles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section
      className="rounded-2xl overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.015)",
        border: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/[0.02] transition"
      >
        <ChevronRight
          className="w-3.5 h-3.5 text-[#6B7280] transition-transform"
          style={{ transform: open ? "rotate(90deg)" : "none" }}
        />
        <Archive className="w-3.5 h-3.5 text-[#6B7280]" />
        <span
          className="text-[12px] font-medium tracking-wide text-[#9CA3AF]"
          style={{ fontFamily: "var(--font-highlight)" }}
        >
          Archived rounds
        </span>
        <span className="ml-auto text-[10px] font-mono text-[#6B7280] tabular-nums whitespace-nowrap">
          {applications.length} applications
          <span className="opacity-50 mx-2">·</span>
          {rounds.length} {rounds.length === 1 ? "round" : "rounds"}
        </span>
      </button>

      {open && (
        <div className="border-t border-white/[0.05] px-3 pb-3">
          <p className="px-1 pt-3 pb-2 text-[11px] text-[#6B7280]">
            Read as submitted. Archived rows stay out of the live list, board,
            insights, filters and release.
          </p>

          {rounds.map((round) => (
            <div key={round.label} className="mt-2">
              <p className="px-1 py-2 font-mono text-[10px] tracking-[0.22em] uppercase text-[#6B7280]">
                {round.label} round
              </p>

              {round.roles.map(({ position, apps }) => {
                const isOpen = openRoles.has(position.id);
                return (
                  <div key={position.id} className="mb-1">
                    <button
                      type="button"
                      onClick={() => toggleRole(position.id)}
                      aria-expanded={isOpen}
                      className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left hover:bg-white/[0.03] transition"
                    >
                      <ChevronRight
                        className="w-3 h-3 text-[#6B7280] transition-transform"
                        style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
                      />
                      <span className="text-[13px] text-[#E5E7EB]">
                        {position.title}
                      </span>
                      <span className="text-[10px] font-mono text-[#6B7280]">
                        {position.slug}
                      </span>
                      <span className="ml-auto text-[10px] font-mono text-[#9CA3AF] tabular-nums px-2 py-0.5 rounded bg-white/5">
                        {apps.length}
                      </span>
                    </button>

                    {isOpen && (
                      <div className="pl-5 pt-1 pb-2 space-y-1.5">
                        {apps.map((app) => (
                          <ApplicantCard
                            key={app.id}
                            application={app}
                            isSelected={false}
                            currentUserEmail={currentUserEmail}
                            onSelect={noop}
                            onStatusChange={onStatusChange}
                            onTagsChange={onTagsChange}
                            onNoteTextChange={onNoteTextChange}
                            onRelease={onRelease}
                            onDelete={onDelete}
                            archived
                          />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
