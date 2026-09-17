"use client";

import { DEVELOPER_PROJECTS } from "@/lib/recruitment-projects";
import FormField from "./FormField";
import {
  MAX_PROJECT_CHOICES,
  PROJECT_REASON_MAX_WORDS,
  RANK_LABELS,
  toggleProjectChoice,
} from "./project-choices";

interface ProjectChoicesProps {
  choices: string[];
  reason: string;
  onChoicesChange: (choices: string[]) => void;
  onReasonChange: (reason: string) => void;
  reasonError?: string;
  reasonWordCount: number;
}

export default function ProjectChoices({
  choices,
  reason,
  onChoicesChange,
  onReasonChange,
  reasonError,
  reasonWordCount,
}: ProjectChoicesProps) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <p className="text-sm text-[#F1FFFF] mb-1 font-medium">
        Project preferences (optional)
      </p>
      <p className="text-xs text-[#9CA3AF] mb-4 leading-relaxed">
        Rank up to {MAX_PROJECT_CHOICES} projects you&apos;d most want to build
        (details in the project list above). Tap to rank, tap again to remove.
        Skipping this won&apos;t hurt your application; it helps us place you.
      </p>
      <div className="space-y-2" role="group" aria-label="Rank your top 3 projects">
        {DEVELOPER_PROJECTS.map((project) => {
          const rank = choices.indexOf(project.partner);
          const ranked = rank !== -1;
          const full = !ranked && choices.length >= MAX_PROJECT_CHOICES;
          return (
            <button
              key={project.partner}
              type="button"
              aria-pressed={ranked}
              disabled={full}
              onClick={() => onChoicesChange(toggleProjectChoice(choices, project.partner))}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left transition-all border ${
                ranked
                  ? "bg-[#1D9BF0]/10 border-[#1D9BF0]/50"
                  : full
                    ? "bg-white/[0.02] border-white/5 opacity-50 cursor-not-allowed"
                    : "bg-white/[0.03] border-white/10 hover:border-white/20"
              }`}
            >
              <span
                className={`flex-shrink-0 w-9 h-6 rounded-full flex items-center justify-center font-mono text-[10px] ${
                  ranked
                    ? "bg-[#1D9BF0] text-[#F1FFFF]"
                    : "border border-white/15 text-[#6B7280]"
                }`}
              >
                {ranked ? RANK_LABELS[rank] : "—"}
              </span>
              <span className="min-w-0">
                <span className="block text-sm text-[#F1FFFF]">
                  {project.partner}
                </span>
                <span className="block text-xs text-[#9CA3AF]">{project.title}</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="mt-4">
        <FormField
          label="Why these choices? (optional)"
          name="project_choice_reason"
          type="textarea"
          value={reason}
          onChange={onReasonChange}
          placeholder="A line or two on what draws you to your picks"
          rows={2}
          error={reasonError}
          wordCount={reasonWordCount}
          maxWords={PROJECT_REASON_MAX_WORDS}
        />
      </div>
    </div>
  );
}
