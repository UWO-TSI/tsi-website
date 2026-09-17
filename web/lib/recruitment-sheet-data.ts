import type { Application } from "./recruitment";
import { parseAdminNotes } from "./admin-notes";

export const SHEET_TAB = "Recruitment records";
export const SHEET_QUESTION_LIMIT = 20;
const META = [
  ["Other links", "__profile_other_links"],
  ["Other commitments", "__profile_commitments_next_year"],
  ["Past projects", "__past_projects"],
  ["Portfolio link", "__portfolio_link"],
  ["Portfolio files", "__portfolio_files"],
  ["Creative files", "__creative_piece_files"],
] as const;
export const SHEET_HEADERS = [
  "Application ID", "Submitted at", "Role", "Role ID", "Archived", "Full name",
  "Email", "Phone", "Program", "Year", "LinkedIn", "Heard about us",
  "Resume filename", "Application and resume (admin sign-in)", "Status", "Pending status",
  "Tags", "Reviewer notes", "Released at", "Updated at", ...META.map(([label]) => label),
  ...Array.from({ length: SHEET_QUESTION_LIMIT }, (_, i) => [`Question ${i + 1}`, `Answer ${i + 1}`]).flat(),
];

export function sheetRow(app: Application, origin: string): (string | number)[] {
  const answers = app.essay_answers ?? [];
  const meta = new Map(answers.map(a => [a.question_id, a.answer]));
  const questions = answers.filter(a => !META.some(([, id]) => id === a.question_id));
  if (questions.length > SHEET_QUESTION_LIMIT) throw new Error("Too many questions for spreadsheet export");
  const row: (string | number)[] = [
    app.id, app.submitted_at, app.position?.title ?? "", app.position_id,
    app.position?.archived_at ? "Yes" : "No", app.full_name, app.email, app.phone ?? "",
    app.program_major, app.year_of_study, app.linkedin_url ?? "", app.heard_about_us,
    app.resume_filename ?? "", `${origin}/admin/preview/${app.id}`, app.status,
    app.draft_status ?? "", (app.tags ?? []).join(", "),
    parseAdminNotes(app.admin_notes).map(n => `${n.author_name || n.author_email}: ${n.text}`).join("\n\n"),
    app.released_at ?? "", app.updated_at ?? "", ...META.map(([, id]) => meta.get(id) ?? ""),
  ];
  for (let i = 0; i < SHEET_QUESTION_LIMIT; i++) {
    const answer = questions[i];
    row.push(answer ? app.position?.essay_questions?.find(q => q.id === answer.question_id)?.question ?? answer.question_id : "", answer?.answer ?? "");
  }
  // Fail visibly instead of silently truncating an applicant's information.
  if (row.some(cell => String(cell).length > 49000)) throw new Error("A spreadsheet cell exceeds Google's size limit");
  return row;
}

export function columnName(column: number): string {
  let name = "";
  while (column > 0) { column--; name = String.fromCharCode(65 + column % 26) + name; column = Math.floor(column / 26); }
  return name;
}
