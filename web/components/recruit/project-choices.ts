import { DEVELOPER_PROJECTS } from "@/lib/recruitment-projects";

// Developer applicants can rank up to 3 of the year's projects. Entirely
// optional (David, 2026-09-17): zero, one, two, or three picks all submit.
export const MAX_PROJECT_CHOICES = 3;
export const PROJECT_REASON_MAX_WORDS = 50;
export const RANK_LABELS = ["1st", "2nd", "3rd"] as const;

// Reserved essay_answers IDs — same convention as the META_*_ID constants in
// ApplicationForm. Mirrored in recruitment-sheet-data.ts and ApplicantCard.
export const META_PROJECT_CHOICE_IDS = [
  "__project_choice_1",
  "__project_choice_2",
  "__project_choice_3",
] as const;
export const META_PROJECT_REASON_ID = "__project_choice_reason";

/** Rank an unranked project (capped at 3) or unrank it, compacting the order. */
export function toggleProjectChoice(choices: string[], partner: string): string[] {
  if (choices.includes(partner)) return choices.filter((p) => p !== partner);
  if (choices.length >= MAX_PROJECT_CHOICES) return choices;
  return [...choices, partner];
}

/** Drafts are untrusted input: keep known partners only, deduped, at most 3. */
export function sanitizeProjectChoices(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const known = new Set(DEVELOPER_PROJECTS.map((p) => p.partner));
  const valid = value.filter((v): v is string => typeof v === "string" && known.has(v));
  return [...new Set(valid)].slice(0, MAX_PROJECT_CHOICES);
}

/** Readable value stored in essay_answers and shown to reviewers. */
export function projectChoiceAnswer(partner: string): string {
  const project = DEVELOPER_PROJECTS.find((p) => p.partner === partner);
  return project ? `${project.partner} (${project.title})` : partner;
}
