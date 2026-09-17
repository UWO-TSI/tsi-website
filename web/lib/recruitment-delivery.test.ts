import { describe, expect, it } from "vitest";
import { SHEET_HEADERS, sheetRow, columnName } from "./recruitment-sheet-data";
import { applicationInput, validatePositionAnswers } from "./recruitment-validation";
import { isPositionOpen, type Application, type Position } from "./recruitment";

const user = "11111111-1111-4111-8111-111111111111";
const position: Position = { id: "22222222-2222-4222-8222-222222222222", slug: "developer", title: "Developer", description: null, phase: 3, visibility: "public", access_code: null, essay_questions: [{ id: "why", question: "Why join?", max_words: 3 }], opens_at: null, closes_at: null, is_active: true, created_at: "2026-09-16" };
const input = { position_id: position.id, full_name: "Example Applicant", email: "test@example.invalid", phone: "", program_major: "Engineering", year_of_study: 2, heard_about_us: "Website", resume_storage_path: `${user}/resume.pdf`, resume_filename: "resume.pdf", essay_answers: [{ question_id: "why", answer: "Build useful things" }] };
const app: Application = { ...input, id: user, user_id: user, linkedin_url: null, resume_drive_url: "https://example.invalid/expires", status: "screening", draft_status: null, tags: [], admin_notes: null, submitted_at: "2026-09-16", released_at: null, created_at: "2026-09-16", updated_at: "2026-09-16", position };

describe("recruitment submission and delivery", () => {
  it("exports 300 complete records to stable-width rows, preserving literal formulas and answers", () => {
    const rows = Array.from({ length: 300 }, (_, i) => sheetRow({ ...app, id: String(i), full_name: '=IMPORTXML("test")', essay_answers: [...app.essay_answers, { question_id: "__past_projects", answer: "A project\nwith two lines" }] }, "https://www.tethos.ca"));
    expect(rows).toHaveLength(300);
    expect(new Set(rows.map(r => r[0])).size).toBe(300);
    for (const row of rows) {
      expect(row).toHaveLength(SHEET_HEADERS.length);
      expect(row[SHEET_HEADERS.indexOf("Full name")]).toBe('=IMPORTXML("test")'); // Google writer must use RAW.
      expect(row[SHEET_HEADERS.indexOf("Question 1")]).toBe("Why join?");
      expect(row[SHEET_HEADERS.indexOf("Answer 1")]).toBe("Build useful things");
      expect(row[SHEET_HEADERS.indexOf("Past projects")]).toBe("A project\nwith two lines");
      expect(row.join(" ")).not.toContain("https://example.invalid/expires");
    }
    expect(columnName(SHEET_HEADERS.length)).toBe("BR");
  });
  it("rejects missing resume, malformed fields and forged attachments", () => {
    expect(applicationInput.safeParse(input).success).toBe(true);
    expect(applicationInput.safeParse({ ...input, resume_storage_path: "" }).success).toBe(false);
    expect(applicationInput.safeParse({ ...input, year_of_study: "two" }).success).toBe(false);
    expect(validatePositionAnswers(input, position, user)).toBeNull();
    expect(validatePositionAnswers({ ...input, resume_storage_path: "another/resume.pdf" }, position, user)).toBe("Invalid resume path");
    expect(validatePositionAnswers({ ...input, essay_answers: [...input.essay_answers, { question_id: "__portfolio_files", answer: '[{"path":"another/private.pdf"}]' }] }, position, user)).toBe("Invalid attachment path");
  });
  it("validates required answers, duplicates, unknown questions and word limits", () => {
    expect(validatePositionAnswers({ ...input, essay_answers: [] }, position, user)).toContain("Please answer");
    expect(validatePositionAnswers({ ...input, essay_answers: [...input.essay_answers, ...input.essay_answers] }, position, user)).toBe("Duplicate answer");
    expect(validatePositionAnswers({ ...input, essay_answers: [{ question_id: "other", answer: "text" }] }, position, user)).toBe("Unknown application question");
    expect(validatePositionAnswers({ ...input, essay_answers: [{ question_id: "why", answer: "one two three four" }] }, position, user)).toContain("exceeds 3 words");
  });
  it("validates link answers without applying essay word limits", () => {
    const linkPosition: Position = { ...position, essay_questions: [{ id: "clip", question: "Send a short video", max_words: 1, response_type: "url" }] };
    const answer = (value: string) => ({ ...input, essay_answers: [{ question_id: "clip", answer: value }] });
    expect(validatePositionAnswers(answer(" https://www.youtube.com/shorts/example "), linkPosition, user)).toBeNull();
    expect(validatePositionAnswers(answer("javascript:alert(1)"), linkPosition, user)).toContain("valid http or https link");
    expect(validatePositionAnswers(answer("my favourite video"), linkPosition, user)).toContain("valid http or https link");
    expect(validatePositionAnswers(answer(""), linkPosition, user)).toContain("Please answer");
  });
  it("never opens archived, inactive, future or expired roles", () => {
    expect(isPositionOpen(position)).toBe(true);
    expect(isPositionOpen({ ...position, archived_at: "2026-09-01" })).toBe(false);
    expect(isPositionOpen({ ...position, is_active: false })).toBe(false);
    expect(isPositionOpen({ ...position, opens_at: "2099-01-01" })).toBe(false);
    expect(isPositionOpen({ ...position, closes_at: "2020-01-01" })).toBe(false);
  });
});
