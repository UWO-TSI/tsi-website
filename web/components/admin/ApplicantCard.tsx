"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  ExternalLink,
  Calendar,
  Mail,
  Phone,
  Linkedin,
  Link as LinkIcon,
  Briefcase,
  Trash2,
  Check,
  Clock,
  X,
  RotateCcw,
} from "lucide-react";
import StatusBadge from "@/components/recruit/StatusBadge";
import TagEditor from "./TagEditor";
import type { Application, ApplicationStatus } from "@/lib/recruitment";
import {
  STATUS_COLORS,
  STATUS_LABELS,
  isTerminalStatus,
  nextPipelineStatus,
} from "@/lib/recruitment";
import { parseAdminNotes } from "@/lib/admin-notes";

// Reserved IDs the form stuffs into essay_answers because applications
// has no dedicated columns for them.
const META_OTHER_LINKS_ID = "__profile_other_links";
const META_COMMITMENTS_ID = "__profile_commitments_next_year";
const META_PAST_PROJECTS_ID = "__past_projects";
const META_PORTFOLIO_FILES_ID = "__portfolio_files";
const META_PORTFOLIO_LINK_ID = "__portfolio_link";
const META_CREATIVE_PIECE_FILES_ID = "__creative_piece_files";
const META_IDS = new Set([
  META_OTHER_LINKS_ID,
  META_COMMITMENTS_ID,
  META_PAST_PROJECTS_ID,
  META_PORTFOLIO_FILES_ID,
  META_PORTFOLIO_LINK_ID,
  META_CREATIVE_PIECE_FILES_ID,
]);

interface MetaFile {
  path: string;
  filename: string;
  size: number;
}

function findMeta(
  answers: { question_id: string; answer: string }[],
  id: string
): string | null {
  return answers.find((a) => a.question_id === id)?.answer ?? null;
}

function parseFiles(json: string | null): MetaFile[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Pull the storage path out of a Supabase signed URL so we can re-sign
// once the original 7-day token expires. Returns null for legacy non-
// Supabase URLs (e.g. old Drive links).
function extractResumePath(url: string): string | null {
  const m = url.match(/\/storage\/v1\/object\/sign\/resumes\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function openSigned(path: string, bucket: "portfolios" | "resumes") {
  try {
    const res = await fetch("/api/resume-sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "view", bucket, path }),
    });
    if (!res.ok) return;
    const body = await res.json();
    if (body?.signedUrl) window.open(body.signedUrl, "_blank", "noopener");
  } catch {
    // ignore
  }
}

interface ApplicantCardProps {
  application: Application;
  isSelected: boolean;
  currentUserEmail: string;
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: ApplicationStatus | null) => void;
  onTagsChange: (id: string, tags: string[]) => void;
  onNoteTextChange: (id: string, text: string) => void;
  onRelease: (id: string) => void;
  onDelete: (id: string) => void;
  /** Archived rounds: notes and tags stay editable, verdicts, release and delete are hidden. */
  archived?: boolean;
}

export default function ApplicantCard({
  application,
  isSelected,
  currentUserEmail,
  onSelect,
  onStatusChange,
  onTagsChange,
  onNoteTextChange,
  onRelease,
  onDelete,
  archived = false,
}: ApplicantCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const hasUnreleased =
    application.draft_status && application.draft_status !== application.status;

  const allNotes = parseAdminNotes(application.admin_notes);
  const meEmail = currentUserEmail.toLowerCase();
  const myNote = allNotes.find((n) => n.author_email === meEmail);
  const otherNotes = allNotes.filter((n) => n.author_email !== meEmail);
  const [draftNote, setDraftNote] = useState(myNote?.text ?? "");

  // Hydrate draft when a different applicant's data loads (id changes).
  // Doesn't fire on every parent re-render — only when the underlying
  // row swaps — so it can't clobber an in-progress edit.
  useEffect(() => {
    setDraftNote(myNote?.text ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [application.id]);

  // Tint the card by the effective verdict — draft if pending, else released.
  // Pending decisions get a "unreleased" yellow ring so they're obvious in a
  // sea of cards.
  const effectiveStatus = application.draft_status ?? application.status;
  const tintColor = STATUS_COLORS[effectiveStatus];

  return (
    <div
      className={`
        rounded-xl border transition-all duration-200
        ${isSelected ? "border-[#1D9BF0]/50 bg-[#1D9BF0]/5" : ""}
        ${hasUnreleased ? "ring-1 ring-[#FFD166]/40" : ""}
      `}
      style={
        isSelected
          ? undefined
          : {
              borderColor: `${tintColor}55`,
              background: `linear-gradient(90deg, ${tintColor}14 0%, ${tintColor}06 35%, rgba(255,255,255,0.02) 100%)`,
            }
      }
    >
      {/* Summary row — click anywhere except interactive controls to expand. */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Selection — radio-style filled dot when selected */}
        <button
          type="button"
          role="checkbox"
          aria-checked={isSelected}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(application.id);
          }}
          className="flex items-center justify-center w-4 h-4 rounded-full transition-all"
          style={{
            border: isSelected
              ? "1px solid #1D9BF0"
              : "1px solid rgba(255,255,255,0.25)",
            background: isSelected ? "rgba(29,155,240,0.12)" : "transparent",
          }}
        >
          {isSelected && (
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: "#1D9BF0" }}
            />
          )}
        </button>

        {/* Name & email */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-[#F1FFFF] truncate">
            {application.full_name}
          </p>
          <p className="text-[11px] text-[#6B7280] truncate">
            {application.email}
          </p>
        </div>

        {/* Position */}
        <span className="hidden md:inline-block text-xs font-mono text-[#9CA3AF] px-2 py-0.5 rounded bg-white/5">
          {application.position?.title}
        </span>

        {/* Verdict buttons — internal, become the next student-facing
            status once released. */}
        {!archived && (
          <VerdictButtons
            releasedStatus={application.status}
            draftStatus={application.draft_status}
            onChange={(s) => onStatusChange(application.id, s)}
          />
        )}

        {/* Status badge — shows the effective verdict (draft if pending,
            else released). The "(draft)" tag makes it obvious the student
            hasn't seen this change yet. */}
        <StatusBadge
          status={effectiveStatus}
          isDraft={!!hasUnreleased}
        />

        {/* Date */}
        <span className="hidden lg:inline-block text-[10px] font-mono text-[#6B7280]">
          {new Date(application.submitted_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>

        {/* Expand — row-click already toggles, this is visual affordance. */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setExpanded(!expanded);
          }}
          className="text-[#6B7280] hover:text-[#F1FFFF] transition"
        >
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-white/5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {/* Left: Contact & details */}
                <div className="space-y-3">
                  <h4 className="font-mono text-[10px] tracking-wider uppercase text-[#1D9BF0] mb-2">
                    Applicant Info
                  </h4>
                  <InfoRow icon={<Mail className="w-3.5 h-3.5" />} value={application.email} />
                  <InfoRow icon={<Phone className="w-3.5 h-3.5" />} value={application.phone} />
                  {application.linkedin_url && (
                    <InfoRow
                      icon={<Linkedin className="w-3.5 h-3.5" />}
                      value={
                        <a
                          href={application.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#1D9BF0] hover:underline flex items-center gap-1"
                        >
                          LinkedIn <ExternalLink className="w-3 h-3" />
                        </a>
                      }
                    />
                  )}
                  <InfoRow
                    icon={<Calendar className="w-3.5 h-3.5" />}
                    value={`${application.program_major}, Year ${application.year_of_study}`}
                  />
                  <p className="text-[11px] text-[#6B7280]">
                    Heard via: {application.heard_about_us}
                  </p>
                  {application.resume_drive_url && (() => {
                    // The stored resume_drive_url is a 7-day signed URL from
                    // submission time. For older applications the JWT is
                    // expired ("exp claim failed"). Always re-sign on click
                    // via /api/resume-sign instead of using the stored URL.
                    const path = extractResumePath(application.resume_drive_url);
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          if (path) {
                            openSigned(path, "resumes");
                          } else {
                            // Non-Supabase URL (e.g. legacy Drive link) —
                            // fall back to opening directly.
                            window.open(
                              application.resume_drive_url!,
                              "_blank",
                              "noopener"
                            );
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D9BF0]/10 border border-[#1D9BF0]/30 text-xs text-[#F1FFFF] hover:bg-[#1D9BF0]/20 transition"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        View Resume
                        <ExternalLink className="w-3 h-3" />
                      </button>
                    );
                  })()}

                  {/* Meta fields stashed in essay_answers */}
                  {(() => {
                    const answers = application.essay_answers ?? [];
                    const otherLinks = findMeta(answers, META_OTHER_LINKS_ID);
                    const commitments = findMeta(answers, META_COMMITMENTS_ID);
                    const pastProjects = findMeta(answers, META_PAST_PROJECTS_ID);
                    const portfolioLink = findMeta(
                      answers,
                      META_PORTFOLIO_LINK_ID
                    );
                    const portfolioFiles = parseFiles(
                      findMeta(answers, META_PORTFOLIO_FILES_ID)
                    );
                    const creativeFiles = parseFiles(
                      findMeta(answers, META_CREATIVE_PIECE_FILES_ID)
                    );
                    return (
                      <>
                        {otherLinks && (
                          <div className="text-xs">
                            <p className="text-[10px] uppercase tracking-wider text-[#6B7280] mb-1 font-mono">
                              Other links
                            </p>
                            <p className="text-[#E5E7EB] whitespace-pre-wrap leading-relaxed">
                              {otherLinks}
                            </p>
                          </div>
                        )}
                        {commitments && (
                          <div className="text-xs">
                            <p className="text-[10px] uppercase tracking-wider text-[#6B7280] mb-1 font-mono">
                              Commitments next year
                            </p>
                            <p className="text-[#E5E7EB] whitespace-pre-wrap leading-relaxed">
                              {commitments}
                            </p>
                          </div>
                        )}
                        {pastProjects && (
                          <div className="text-xs">
                            <p className="text-[10px] uppercase tracking-wider text-[#6B7280] mb-1 font-mono">
                              Past projects
                            </p>
                            <p className="text-[#E5E7EB] whitespace-pre-wrap leading-relaxed">
                              {pastProjects}
                            </p>
                          </div>
                        )}
                        {portfolioLink && (
                          <div className="text-xs">
                            <p className="text-[10px] uppercase tracking-wider text-[#6B7280] mb-1 font-mono">
                              Portfolio link
                            </p>
                            <a
                              href={portfolioLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[#1D9BF0] hover:underline inline-flex items-center gap-1 break-all"
                            >
                              {portfolioLink}
                              <ExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                          </div>
                        )}
                        {portfolioFiles.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-[#6B7280] mb-1.5 font-mono">
                              Portfolio files
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {portfolioFiles.map((f) => (
                                <button
                                  key={f.path}
                                  onClick={() =>
                                    openSigned(f.path, "portfolios")
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-[#F1FFFF] hover:bg-white/10 hover:border-white/20 transition"
                                >
                                  <Briefcase className="w-3.5 h-3.5" />
                                  {f.filename}
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        {creativeFiles.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-wider text-[#6B7280] mb-1.5 font-mono">
                              Creative piece / attachment
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {creativeFiles.map((f) => (
                                <button
                                  key={f.path}
                                  onClick={() =>
                                    openSigned(f.path, "portfolios")
                                  }
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D9BF0]/10 border border-[#1D9BF0]/30 text-xs text-[#F1FFFF] hover:bg-[#1D9BF0]/20 transition"
                                >
                                  <LinkIcon className="w-3.5 h-3.5" />
                                  {f.filename}
                                  <ExternalLink className="w-3 h-3" />
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Right: Tags & notes */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-mono text-[10px] tracking-wider uppercase text-[#1D9BF0] mb-2">
                      Tags
                    </h4>
                    <TagEditor
                      tags={application.tags}
                      onChange={(tags) => onTagsChange(application.id, tags)}
                    />
                  </div>
                  <div>
                    <h4 className="font-mono text-[10px] tracking-wider uppercase text-[#1D9BF0] mb-2">
                      Admin Notes
                    </h4>

                    {/* Other admins' notes (read-only) */}
                    {otherNotes.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {otherNotes.map((n) => (
                          <div
                            key={n.author_email}
                            className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2"
                          >
                            <div className="flex items-baseline justify-between mb-1">
                              <span className="text-[10px] font-mono text-[#9CA3AF]">
                                {n.author_name ?? n.author_email}
                              </span>
                              {n.updated_at && (
                                <span className="text-[9px] font-mono text-[#6B7280]">
                                  {new Date(n.updated_at).toLocaleDateString(
                                    "en-US",
                                    { month: "short", day: "numeric" }
                                  )}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[#E5E7EB] whitespace-pre-wrap leading-relaxed">
                              {n.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Your own note (editable) */}
                    <label className="block text-[10px] font-mono text-[#6B7280] mb-1">
                      Your note
                    </label>
                    <textarea
                      value={draftNote}
                      onChange={(e) => {
                        setDraftNote(e.target.value);
                        onNoteTextChange(application.id, e.target.value);
                      }}
                      rows={3}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-[#F1FFFF] placeholder-[#6B7280] focus:outline-none focus:border-[#1D9BF0] transition resize-none"
                      placeholder="Your internal notes (only your own are editable)..."
                    />
                  </div>

                  {/* Individual release */}
                  {hasUnreleased && !archived && (
                    <button
                      onClick={() => onRelease(application.id)}
                      className="w-full rounded-lg bg-[#FFD166]/10 border border-[#FFD166]/30 px-3 py-2 text-xs text-[#FFD166] font-mono hover:bg-[#FFD166]/20 transition"
                    >
                      Release: {application.status} → {application.draft_status}
                    </button>
                  )}

                  {/* Delete with two-step confirm */}
                  {!archived && (
                  <div className="pt-3 mt-3 border-t border-white/5">
                    {!confirmingDelete ? (
                      <button
                        onClick={() => setConfirmingDelete(true)}
                        className="inline-flex items-center gap-1.5 text-[11px] text-[#6B7280] hover:text-[#EF4444] transition font-mono"
                      >
                        <Trash2 className="w-3 h-3" />
                        Delete applicant
                      </button>
                    ) : (
                      <div className="rounded-lg bg-[#EF4444]/5 border border-[#EF4444]/30 p-3">
                        <p className="text-xs text-[#F1FFFF] mb-2">
                          Permanently delete{" "}
                          <span className="font-medium">{application.full_name}</span>
                          's application? This removes the resume file and all
                          status history. Cannot be undone.
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              onDelete(application.id);
                              setConfirmingDelete(false);
                            }}
                            className="rounded-md bg-[#EF4444] hover:bg-[#dc2626] text-white px-3 py-1.5 text-xs font-medium transition"
                          >
                            Delete permanently
                          </button>
                          <button
                            onClick={() => setConfirmingDelete(false)}
                            className="rounded-md bg-white/5 border border-white/10 text-[#9CA3AF] hover:text-[#F1FFFF] px-3 py-1.5 text-xs transition"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>

              {/* Essays — meta IDs already rendered above */}
              {application.essay_answers?.some(
                (a) => !META_IDS.has(a.question_id) && a.answer?.trim()
              ) && (
                <div className="mt-6 pt-4 border-t border-white/5">
                  <h4 className="font-mono text-[10px] tracking-wider uppercase text-[#1D9BF0] mb-3">
                    Essay Responses
                  </h4>
                  <div className="space-y-4">
                    {application.position?.essay_questions?.map((q) => {
                      const answer = application.essay_answers.find(
                        (a) => a.question_id === q.id
                      );
                      return (
                        <div key={q.id}>
                          <p className="text-[11px] text-[#9CA3AF] mb-1 whitespace-pre-line">
                            {q.question}
                          </p>
                          <p className="text-sm text-[#E5E7EB] whitespace-pre-wrap">
                            {answer?.answer || "No response"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function InfoRow({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 text-xs text-[#9CA3AF]">
      {icon}
      <span>{value}</span>
    </div>
  );
}

// Three context-aware verdict buttons. Click sets draft_status so the
// student doesn't see it until "Release" is clicked. The advance button
// resolves to the next pipeline stage (final_review → accepted).
//
// Visual rule: button is filled when its action matches the current draft
// (or released status, if no draft). Outline otherwise.
// Toggleable verdict buttons. Clicking the active verdict reverts:
//   - if there's a pending draft, clears it (so nothing publishes)
//   - if the verdict is already released, queues a 'screening' draft so
//     releasing it reopens the applicant for review
// Advance is never disabled — from a terminal state it also reopens.
function VerdictButtons({
  releasedStatus,
  draftStatus,
  onChange,
}: {
  releasedStatus: ApplicationStatus;
  draftStatus: ApplicationStatus | null;
  onChange: (status: ApplicationStatus | null) => void;
}) {
  const effective = draftStatus ?? releasedStatus;
  const terminal = isTerminalStatus(effective);
  const advanceTarget = nextPipelineStatus(effective);
  const accepted = effective === "accepted";

  // The "active" state for each button is whether `effective` matches.
  // Clicking active = revert. Clicking inactive = set draft to that verdict.
  const revert = () => {
    if (draftStatus) onChange(null);
    else onChange("screening");
  };
  const setOrRevert = (target: ApplicationStatus, isActive: boolean) => {
    if (isActive) revert();
    else onChange(target);
  };

  const advanceActive =
    accepted ||
    (advanceTarget !== null && effective === advanceTarget && !terminal);

  return (
    <div
      className="hidden sm:inline-flex items-center gap-1 rounded-full p-0.5"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
      title="Admin verdict (not visible to applicant until released)"
    >
      <VerdictButton
        label={
          terminal
            ? "Reopen"
            : effective === "final_review"
              ? "Accept"
              : "Advance"
        }
        // Show the target stage inline so the verdict is unambiguous.
        sublabel={
          terminal
            ? "→ Screening"
            : advanceTarget
              ? `→ ${STATUS_LABELS[advanceTarget]}`
              : null
        }
        icon={<Check className="w-3 h-3" />}
        color="#22C55E"
        active={advanceActive}
        onClick={() => {
          if (terminal) {
            onChange("screening");
            return;
          }
          if (advanceActive) {
            revert();
            return;
          }
          if (advanceTarget) onChange(advanceTarget);
        }}
      />
      <VerdictButton
        label="Waitlist"
        icon={<Clock className="w-3 h-3" />}
        color="#F97316"
        active={effective === "waitlist"}
        onClick={() => setOrRevert("waitlist", effective === "waitlist")}
      />
      <VerdictButton
        label="Reject"
        icon={<X className="w-3 h-3" />}
        color="#EF4444"
        active={effective === "rejected"}
        onClick={() => setOrRevert("rejected", effective === "rejected")}
      />
      {/* Explicit undo arrow: only when a pending draft differs from the
          released status. Same as clicking the active verdict, kept for
          discoverability. */}
      {draftStatus && draftStatus !== releasedStatus && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onChange(null);
          }}
          className="ml-0.5 p-1 rounded-full text-[#9CA3AF] hover:text-[#F1FFFF] hover:bg-white/10 transition"
          title="Discard pending verdict"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function VerdictButton({
  label,
  sublabel,
  icon,
  color,
  active,
  disabled = false,
  onClick,
}: {
  label: string;
  sublabel?: string | null;
  icon: React.ReactNode;
  color: string;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full transition disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
      style={{
        color: active ? "#0B0B0E" : color,
        background: active ? color : "transparent",
      }}
      title={sublabel ? `${label} ${sublabel}` : label}
    >
      {icon}
      {label}
      {sublabel && (
        <span
          className="hidden lg:inline opacity-60 normal-case tracking-normal ml-0.5"
          style={{ fontSize: "9px" }}
        >
          {sublabel}
        </span>
      )}
    </button>
  );
}
