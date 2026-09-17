import type { Position } from "./recruitment";
import drafts from "./recruitment-round-drafts.json";

// Final director/developer copy supplied September 16; Internal/External essays retain confirmed 250-word limits.
// See specs/director-developer-round.md for question provenance.
export const NEXT_ROUND_ROLES = drafts;

export function previewRecruitmentPositions(): Position[] {
  return NEXT_ROUND_ROLES.map((role, i) => ({
    ...role,
    essay_questions: role.essay_questions.map(q => ({
      ...q,
      response_type: q.response_type === "url" ? "url" as const : undefined,
      required: "required" in q && q.required === false ? false as const : undefined,
    })),
    id: `00000000-0000-4000-8000-00000000000${i + 1}`,
    phase: 3, visibility: "public", access_code: null,
    is_active: true,
    created_at: "2026-09-16T00:00:00Z", archived_at: null,
  }));
}
