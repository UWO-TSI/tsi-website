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
} from "lucide-react";
import StatusDropdown from "./StatusDropdown";
import StatusBadge from "@/components/recruit/StatusBadge";
import TagEditor from "./TagEditor";
import type { Application, ApplicationStatus } from "@/lib/recruitment";

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
        ${isSelected ? "border-[#002FA7]/50 bg-[#002FA7]/5" : "border-white/5 bg-white/[0.02]"}
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
          className="w-4 h-4 rounded border-white/20 bg-white/5 text-[#002FA7] focus:ring-[#002FA7] cursor-pointer"
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
                  <h4 className="font-mono text-[10px] tracking-wider uppercase text-[#002FA7] mb-2">
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
                          className="text-[#002FA7] hover:underline flex items-center gap-1"
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#002FA7]/10 border border-[#002FA7]/30 text-xs text-[#F1FFFF] hover:bg-[#002FA7]/20 transition"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      View Resume
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Right: Tags & notes */}
                <div className="space-y-4">
                  <div>
                    <h4 className="font-mono text-[10px] tracking-wider uppercase text-[#002FA7] mb-2">
                      Tags
                    </h4>
                    <TagEditor
                      tags={application.tags}
                      onChange={(tags) => onTagsChange(application.id, tags)}
                    />
                  </div>
                  <div>
                    <h4 className="font-mono text-[10px] tracking-wider uppercase text-[#002FA7] mb-2">
                      Admin Notes
                    </h4>
                    <textarea
                      value={application.admin_notes ?? ""}
                      onChange={(e) =>
                        onNotesChange(application.id, e.target.value)
                      }
                      rows={3}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-xs text-[#F1FFFF] placeholder-[#6B7280] focus:outline-none focus:border-[#002FA7] transition resize-none"
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

              {/* Essays */}
              {application.essay_answers?.length > 0 && (
                <div className="mt-6 pt-4 border-t border-white/5">
                  <h4 className="font-mono text-[10px] tracking-wider uppercase text-[#002FA7] mb-3">
                    Essay Responses
                  </h4>
                  <div className="space-y-4">
                    {application.position?.essay_questions?.map((q) => {
                      const answer = application.essay_answers.find(
                        (a) => a.question_id === q.id
                      );
                      return (
                        <div key={q.id}>
                          <p className="text-[11px] text-[#9CA3AF] mb-1">
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
