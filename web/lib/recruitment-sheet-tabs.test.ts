import { describe, expect, it } from "vitest";
import { allRow, cell, formatRequests, resumePath, roleHeaders, roleRow } from "./recruitment-sheet-tabs";
import type { Application, Position } from "./recruitment";

const position = { slug: "developer", title: "Developer", essay_questions: [
  { id: "dev-1", question: "Why TSI?", max_words: 200 }, { id: "dev-2", question: "A project you shipped", max_words: 200 },
] } as unknown as Position;
const app = {
  id: "a1", position_id: "p1", full_name: "Ada Lovelace", email: "ada@uwo.ca", program_major: "CS", year_of_study: 2,
  submitted_at: "2026-09-18T14:05:00Z", resume_filename: "ada.pdf", linkedin_url: "https://linkedin.com/in/ada",
  resume_drive_url: "https://x.supabase.co/storage/v1/object/sign/resumes/u1/developer_1.pdf?token=t",
  essay_answers: [
    { question_id: "dev-1", answer: "=SUM(1)" }, { question_id: "dev-2", answer: "Built a thing" },
    { question_id: "__project_choice_1", answer: "ArkAid (Kitchen Dashboard)" }, { question_id: "__project_choice_reason", answer: "Kitchens" },
    { question_id: "__profile_other_links", answer: "https://ada.dev" },
  ],
} as unknown as Application;
const links = { resume: "https://signed/resume", portfolioFiles: [], creativeFiles: [] };

describe("reviewer tab rows", () => {
  it("puts the role's questions in the header, verbatim, after the profile columns", () => {
    const headers = roleHeaders(position);
    expect(headers.slice(-2)).toEqual(["Why TSI?", "A project you shipped"]);
    expect(headers).toContain("Project picks (1st, 2nd, 3rd)");
    expect(headers.join(" ")).not.toMatch(/ID|Status|Tags|notes/i);
  });
  it("writes links as HYPERLINK formulas and neutralises answers that look like formulas", () => {
    const row = roleRow(app, position, links);
    expect(row[0]).toBe("Ada Lovelace");
    expect(row[5]).toBe('=HYPERLINK("https://signed/resume","ada.pdf")');
    expect(row[6]).toBe('=HYPERLINK("https://linkedin.com/in/ada","LinkedIn")');
    expect(row[row.length - 2]).toBe("'=SUM(1)");
    expect(row[row.length - 1]).toBe("Built a thing");
    expect(row[roleHeaders(position).indexOf("Project picks (1st, 2nd, 3rd)")]).toBe("ArkAid (Kitchen Dashboard)");
  });
  it("keeps the All applicants row to the roster columns", () => {
    expect(allRow(app, position, links)).toHaveLength(8);
    expect(allRow(app, position, { ...links, resume: null })[6]).toBe("");
  });
  it("recovers the storage path from the signed resume URL", () => {
    expect(resumePath(app.resume_drive_url)).toBe("u1/developer_1.pdf");
    expect(resumePath(null)).toBeNull();
    expect(cell("+1 555")).toBe("'+1 555");
  });
  it("formats a new tab with a frozen bold header, wrapping, banding, a filter and a warning-only protection", () => {
    const kinds = formatRequests(7, roleHeaders(position), 12).map(r => Object.keys(r)[0]);
    expect(kinds).toEqual(expect.arrayContaining(["repeatCell", "updateDimensionProperties", "addBanding", "setBasicFilter", "addProtectedRange"]));
  });
});
