"use client";

import FormField from "./FormField";
import ProjectCards from "./ProjectCards";
import cardStyles from "./project-cards.module.css";
import { MAX_PROJECT_CHOICES, PROJECT_REASON_MAX_WORDS } from "./project-choices";

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
        This year&apos;s projects · rank your top 3 (optional)
      </p>
      <p className="text-xs text-[#9CA3AF] mb-4 leading-relaxed">
        Open a card to read the brief. Use the pill to rank it; tap again to
        remove. Skipping this won&apos;t hurt your application; it helps us
        place you.
      </p>
      <ProjectCards choices={choices} onChoicesChange={onChoicesChange} />
      <p className={cardStyles.hint} aria-live="polite">
        {choices.length === 0
          ? "Nothing picked yet."
          : `${choices.length} of ${MAX_PROJECT_CHOICES} picked${choices.length >= MAX_PROJECT_CHOICES ? ". Remove one to change your picks." : "."}`}
      </p>
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
