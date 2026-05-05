"use client";

import { useState } from "react";
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
} from "lucide-react";
import StatusDropdown from "./StatusDropdown";
import StatusBadge from "@/components/recruit/StatusBadge";
import TagEditor from "./TagEditor";
import type { Application, ApplicationStatus } from "@/lib/recruitment";

// Reserved IDs the form stuffs into essay_answers because applications
// has no dedicated columns for them.
const META_OTHER_LINKS_ID = "__profile_other_links";
const META_COMMITMENTS_ID = "__profile_commitments_next_year";
const META_PORTFOLIO_FILES_ID = "__portfolio_files";
const META_PORTFOLIO_LINK_ID = "__portfolio_link";
const META_CREATIVE_PIECE_FILES_ID = "__creative_piece_files";
const META_IDS = new Set([
  META_OTHER_LINKS_ID,
  META_COMMITMENTS_ID,
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
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: ApplicationStatus) => void;
  onTagsChange: (id: string, tags: string[]) => void;
  onNotesChange: (id: string, notes: string) => void;
  onRelease: (id: string) => void;
}

export default function ApplicantCard({
  application,
  isSelected,
  onSelect,
  onStatusChange,
  onTagsChange,
  onNotesChange,
  onRelease,
}: ApplicantCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasUnreleased =
    application.draft_status && application.draft_status !== application.status;

  return (
    <div
      className={`
        rounded-xl border transition-all duration-200
        ${isSelected ? "border-[#1D9BF0]/50 bg-[#1D9BF0]/5" : "border-white/5 bg-white/[0.02]"}
        ${hasUnreleased ? "ring-1 ring-[#FFD166]/30" : ""}
      `}
    >
      {/* Summary row */}
      <div className="flex items-center gap-3 p-4">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(application.id)}
          className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#1D9BF0] focus:ring-[#1D9BF0] cursor-pointer"
        />

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

        {/* Status */}
        <StatusDropdown
          currentStatus={application.status}
          draftStatus={application.draft_status}
          onChange={(s) => onStatusChange(application.id, s)}
        />

        {/* Released status indicator */}
        <StatusBadge
          status={application.status}
        />

        {/* Date */}
        <span className="hidden lg:inline-block text-[10px] font-mono text-[#6B7280]">
          {new Date(application.submitted_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          })}
        </span>

        {/* Expand */}
        <button
          onClick={() => setExpanded(!expanded)}
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
                  {application.resume_drive_url && (
                    <a
                      href={application.resume_drive_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1D9BF0]/10 border border-[#1D9BF0]/30 text-xs text-[#F1FFFF] hover:bg-[#1D9BF0]/20 transition"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View Resume
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}

                  {/* Meta fields stashed in essay_answers */}
                  {(() => {
                    const answers = application.essay_answers ?? [];
                    const otherLinks = findMeta(answers, META_OTHER_LINKS_ID);
                    const commitments = findMeta(answers, META_COMMITMENTS_ID);
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
                    <textarea
                      value={application.admin_notes ?? ""}
                      onChange={(e) =>
                        onNotesChange(application.id, e.target.value)
                      }
                      rows={3}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-[#F1FFFF] placeholder-[#6B7280] focus:outline-none focus:border-[#1D9BF0] transition resize-none"
                      placeholder="Internal notes..."
                    />
                  </div>

                  {/* Individual release */}
                  {hasUnreleased && (
                    <button
                      onClick={() => onRelease(application.id)}
                      className="w-full rounded-lg bg-[#FFD166]/10 border border-[#FFD166]/30 px-3 py-2 text-xs text-[#FFD166] font-mono hover:bg-[#FFD166]/20 transition"
                    >
                      Release: {application.status} → {application.draft_status}
                    </button>
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
