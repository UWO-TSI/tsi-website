"use client";

/**
 * ApplySheet — the application, as a sheet over the running world.
 * Same chrome as OverlaySheet; the body is the recruiter's greeting and
 * either the existing four-step ApplicationForm, the applicant's status
 * if they already applied at this desk, or a closed/not-yet-open notice.
 * David's Figma restyles this later; the mechanics are what ship first.
 */

import { useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { X } from "lucide-react";
import StatusBadge from "@/components/recruit/StatusBadge";
import StatusPipeline from "@/components/recruit/StatusPipeline";
import { getPositionStatus, type ApplicationStatus } from "@/lib/recruitment";
import type { Desk } from "@/lib/game/miniIsland";
import type { Profile } from "@/lib/supabase/types";

const ApplicationForm = dynamic(() => import("@/components/recruit/ApplicationForm"), { ssr: false });

export interface AppliedInfo {
  status: ApplicationStatus;
  submitted_at: string;
}

export default function ApplySheet({
  desk,
  userId,
  email,
  profile,
  applied,
  onClose,
  onSubmitted,
}: {
  desk: Desk | null;
  userId: string;
  email: string;
  profile: Profile | null;
  applied: AppliedInfo | null;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  useEffect(() => {
    if (!desk) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [desk, onClose]);

  if (!desk) return null;
  const { position, recruiter } = desk;
  const roundStatus = getPositionStatus(position);

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70 }}>
      <div
        onClick={onClose}
        style={{ position: "absolute", inset: 0, background: "rgba(8, 8, 12, 0.45)", animation: "tsi-sheet-dim 0.25s ease-out" }}
      />
      <div
        role="dialog"
        aria-label={position.title}
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: 0,
          top: "5%",
          width: "min(920px, 95vw)",
          background: "var(--color-bg-main, #0f0f10)",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          borderBottom: "none",
          borderRadius: "18px 18px 0 0",
          boxShadow: "0 -12px 48px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "tsi-sheet-up 0.28s cubic-bezier(0.32, 0.9, 0.35, 1)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          title="Close (Esc)"
          style={{
            position: "absolute",
            top: 12,
            right: 14,
            zIndex: 5,
            width: 34,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            borderRadius: 10,
            color: "#f1ffff",
            cursor: "pointer",
          }}
        >
          <X size={16} />
        </button>

        <div style={{ flex: 1, overflowY: "auto" }}>
          <div className="px-6 md:px-10 pt-8 pb-16 max-w-2xl mx-auto">
            {/* recruiter greeting */}
            <div className="flex items-start gap-4 mb-8">
              <span
                aria-hidden
                className="w-11 h-11 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-semibold"
                style={{ background: `${recruiter.colors.apron}33`, border: `1.5px solid ${recruiter.colors.apron}`, color: "#F1FFFF" }}
              >
                {recruiter.name.charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-[#9CA3AF]" style={{ fontFamily: "var(--font-highlight)" }}>
                  {recruiter.name}, {recruiter.title}
                </p>
                <p className="text-base text-[#F1FFFF] leading-relaxed mt-1">&ldquo;{recruiter.greeting}&rdquo;</p>
              </div>
            </div>

            <div className="mb-8">
              <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#1D9BF0] mb-2">Applying for</p>
              <h1 className="text-2xl md:text-3xl font-semibold text-[#F1FFFF]">{position.title}</h1>
              {position.description && (
                <p className="text-sm text-[#9CA3AF] mt-2 leading-relaxed">{position.description}</p>
              )}
            </div>

            {applied ? (
              <AppliedPanel applied={applied} onClose={onClose} />
            ) : roundStatus !== "open" ? (
              <ClosedPanel status={roundStatus} opensAt={position.opens_at} onClose={onClose} />
            ) : (
              <ApplicationForm
                position={position}
                userId={userId}
                defaults={{
                  full_name: profile?.display_name && !profile.display_name.includes("@") ? profile.display_name : undefined,
                  email,
                  program_major: profile?.program ?? undefined,
                  year_of_study: profile?.year ?? undefined,
                }}
                onSubmitted={onSubmitted}
                renderSuccess={() => <SubmittedPanel recruiterName={recruiter.name} onClose={onClose} />}
              />
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes tsi-sheet-up { from { transform: translate(-50%, 6%); opacity: 0.6; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes tsi-sheet-dim { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}

function AppliedPanel({ applied, onClose }: { applied: AppliedInfo; onClose: () => void }) {
  const date = new Date(applied.submitted_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "America/Toronto",
  });
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-[#E5E7EB]">You applied here on {date}.</p>
        <StatusBadge status={applied.status} />
      </div>
      <StatusPipeline currentStatus={applied.status} />
      <p className="text-xs text-[#6B7280] mt-8 leading-relaxed">
        We release status changes the moment they&apos;re final. Your dashboard has the full timeline.
      </p>
      <div className="flex flex-wrap gap-3 mt-6">
        <button onClick={onClose} className="px-6 py-3 rounded-full bg-[#1D9BF0] text-[#F1FFFF] text-sm font-medium hover:bg-[#0e7dbf] transition">
          Back to the office
        </button>
        <Link href="/student/apply/dashboard" className="px-6 py-3 rounded-full border border-white/10 text-sm text-[#9CA3AF] hover:text-[#F1FFFF] hover:border-white/20 transition">
          Open dashboard
        </Link>
      </div>
    </div>
  );
}

function ClosedPanel({ status, opensAt, onClose }: { status: "upcoming" | "closed"; opensAt: string | null; onClose: () => void }) {
  const label = opensAt
    ? new Date(opensAt).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "America/Toronto" })
    : "soon";
  return (
    <div>
      <p className="text-base text-[#F1FFFF] mb-2">
        {status === "upcoming" ? `Applications open ${label}.` : "Applications for this role are closed."}
      </p>
      <p className="text-sm text-[#9CA3AF] mb-6">
        {status === "upcoming" ? "Come back then. Your character will be waiting." : "Thanks for stopping by."}
      </p>
      <button onClick={onClose} className="px-6 py-3 rounded-full bg-[#1D9BF0] text-[#F1FFFF] text-sm font-medium hover:bg-[#0e7dbf] transition">
        Back to the office
      </button>
    </div>
  );
}

function SubmittedPanel({ recruiterName, onClose }: { recruiterName: string; onClose: () => void }) {
  return (
    <div className="py-6">
      <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-[#22C55E] mb-3">Application in</p>
      <h2 className="text-2xl md:text-3xl font-semibold text-[#F1FFFF] mb-3">{recruiterName} has your application.</h2>
      <p className="text-sm text-[#9CA3AF] leading-relaxed mb-8 max-w-[52ch]">
        We review everything after the round closes and release decisions the moment they&apos;re final. This desk
        will show your status whenever you come back, and so will your dashboard.
      </p>
      <button onClick={onClose} className="px-6 py-3 rounded-full bg-[#1D9BF0] text-[#F1FFFF] text-sm font-medium hover:bg-[#0e7dbf] transition">
        Back to the office
      </button>
    </div>
  );
}
