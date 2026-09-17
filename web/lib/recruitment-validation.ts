import { z } from "zod";
import { isApplicationLink, type Position } from "./recruitment";

const text = (max: number) => z.string().trim().max(max);
export const applicationInput = z.object({
  position_id: z.string().uuid(),
  full_name: text(200).min(1),
  email: z.string().trim().email().max(254),
  phone: text(80).default(""),
  program_major: text(200).min(1),
  year_of_study: z.number().int().min(1).max(5),
  linkedin_url: text(2000).nullish(),
  heard_about_us: text(500).min(1),
  resume_storage_path: text(1024).min(1),
  resume_filename: text(255).min(1),
  essay_answers: z.array(z.object({ question_id: text(100).min(1), answer: z.string().max(12000) })).max(26),
});
export type ApplicationInput = z.infer<typeof applicationInput>;
const META_IDS = new Set(["__profile_other_links", "__profile_commitments_next_year", "__past_projects", "__portfolio_link", "__portfolio_files", "__creative_piece_files", "__project_choice_1", "__project_choice_2", "__project_choice_3", "__project_choice_reason"]);

export function validatePositionAnswers(input: ApplicationInput, position: Position, userId: string): string | null {
  if (!input.resume_storage_path.startsWith(`${userId}/`) || input.resume_storage_path.includes("..")) return "Invalid resume path";
  const answers = new Map<string, string>();
  for (const answer of input.essay_answers) {
    if (answers.has(answer.question_id)) return "Duplicate answer";
    if (!META_IDS.has(answer.question_id) && !position.essay_questions.some(q => q.id === answer.question_id)) return "Unknown application question";
    answers.set(answer.question_id, answer.answer);
    if (["__portfolio_files", "__creative_piece_files"].includes(answer.question_id)) {
      try {
        const files: unknown = JSON.parse(answer.answer);
        if (!Array.isArray(files) || files.length > 10 || files.some(f => !f || typeof f.path !== "string" || !f.path.startsWith(`${userId}/`) || f.path.includes(".."))) return "Invalid attachment path";
      } catch { return "Invalid attachments"; }
    }
  }
  const attachmentRole = ["vp-marketing", "vp-internal"].includes(position.slug);
  for (const question of position.essay_questions) {
    const answer = (answers.get(question.id) ?? "").trim();
    if (!attachmentRole && question.required !== false && !answer) return `Please answer: ${question.question}`;
    if (answer && question.response_type === "url" && !isApplicationLink(answer)) return `Please enter a valid http or https link: ${question.question}`;
    if (answer && question.response_type !== "url" && answer.split(/\s+/u).length > question.max_words) return `Answer exceeds ${question.max_words} words: ${question.question}`;
  }
  return null;
}
