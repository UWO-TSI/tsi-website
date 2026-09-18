// Reviewer tabs (David, 2026-09-18): the 15 PMs/VPs read applications in
// Google Sheets and discuss them with cell comments. One tab per live role
// with that role's questions as headers, plus "All applicants". Every
// application keeps a fixed row per tab (recruitment_sheet_rows.tab_row /
// all_row) so comments never drift. No IDs, no admin-only columns.
import type { Application, EssayQuestion, Position } from "./recruitment";

export const ALL_TAB = "All applicants";
/** Live-round roles that get their own tab. Anything else only appears on the master tab. */
export const ROLE_TABS: Record<string, string> = {
  developer: "Developers",
  "director-internal": "Internal",
  "director-external": "External",
  "director-marketing": "Marketing",
};
/** Tabs from earlier layouts, removed once the reviewer tabs exist. */
export const LEGACY_TABS = ["Sheet1", "Screening", "Interview Invite", "Final Review", "Accepted", "Waitlist", "Rejected", "Archived rounds"];

const META = {
  otherLinks: "__profile_other_links",
  commitments: "__profile_commitments_next_year",
  pastProjects: "__past_projects",
  portfolioLink: "__portfolio_link",
  portfolioFiles: "__portfolio_files",
  creativeFiles: "__creative_piece_files",
  picks: ["__project_choice_1", "__project_choice_2", "__project_choice_3"],
  picksReason: "__project_choice_reason",
};

export interface FileLink { filename: string; url: string | null }
/** Signed links resolved by the worker before the row is built. */
export interface RowLinks { resume: string | null; portfolioFiles: FileLink[]; creativeFiles: FileLink[] }

const PROFILE_HEADERS = ["Name", "Email", "Program", "Year", "Submitted", "Resume", "LinkedIn", "Other links", "Portfolio", "Commitments next year"];
export const ALL_HEADERS = ["Name", "Email", "Role", "Program", "Year", "Submitted", "Resume", "LinkedIn"];

/** Header row for a role tab: profile columns, then the role's own questions verbatim. */
export function roleHeaders(position: Pick<Position, "slug" | "essay_questions">): string[] {
  const extras = position.slug === "developer" ? ["Project picks (1st, 2nd, 3rd)", "Why these picks"] : [];
  return [...PROFILE_HEADERS, ...extras, ...position.essay_questions.map(q => q.question)];
}

// Text that Sheets would parse as a formula gets a leading apostrophe under
// USER_ENTERED; the apostrophe is not shown. Links are the only formulas we write.
export function cell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /^[=+\-@]/.test(s) ? `'${s}` : s;
}
const link = (url: string | null | undefined, label: string) =>
  url ? `=HYPERLINK(${JSON.stringify(url)},${JSON.stringify(label)})` : "";
const fileLinks = (files: FileLink[]) => files.map(f => f.url ? link(f.url, f.filename) : cell(f.filename)).filter(Boolean);

export function submittedLabel(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", { timeZone: "America/Toronto", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function answerMap(app: Application) {
  return new Map((app.essay_answers ?? []).map(a => [a.question_id, a.answer ?? ""]));
}

function profileCells(app: Application, links: RowLinks): string[] {
  const m = answerMap(app);
  const portfolio = [
    ...(m.get(META.portfolioLink) ? [link(m.get(META.portfolioLink)!, "Portfolio link")] : []),
    ...fileLinks(links.portfolioFiles),
    ...fileLinks(links.creativeFiles),
  ];
  return [
    cell(app.full_name), cell(app.email), cell(app.program_major), cell(app.year_of_study), submittedLabel(app.submitted_at),
    link(links.resume, app.resume_filename || "Resume"),
    app.linkedin_url ? link(app.linkedin_url, "LinkedIn") : "",
    cell(m.get(META.otherLinks) ?? ""),
    // Several links in one cell need a formula; one link keeps its label.
    portfolio.length > 1 ? `=${portfolio.map(p => p.startsWith("=") ? p.slice(1) : JSON.stringify(p)).join("&CHAR(10)&")}` : portfolio[0] ?? "",
    cell(m.get(META.commitments) ?? ""),
  ];
}

/** One row of a role tab. Questions come from the position so the row lines up with roleHeaders. */
export function roleRow(app: Application, position: Pick<Position, "slug" | "essay_questions">, links: RowLinks): string[] {
  const m = answerMap(app);
  const extras = position.slug === "developer"
    ? [META.picks.map(id => m.get(id)).filter(Boolean).join("\n"), cell(m.get(META.picksReason) ?? "")]
    : [];
  return [...profileCells(app, links), ...extras, ...position.essay_questions.map((q: EssayQuestion) => cell(m.get(q.id) ?? ""))];
}

export function allRow(app: Application, position: Pick<Position, "title">, links: RowLinks): string[] {
  return [cell(app.full_name), cell(app.email), cell(position.title), cell(app.program_major), cell(app.year_of_study), submittedLabel(app.submitted_at),
    link(links.resume, app.resume_filename || "Resume"), app.linkedin_url ? link(app.linkedin_url, "LinkedIn") : ""];
}

export const RESUME_LINK_TTL_SECONDS = 45 * 24 * 3600;

/** Storage path inside the resumes bucket, from the signed URL stored at submission. */
export function resumePath(resumeUrl: string | null | undefined): string | null {
  const m = resumeUrl?.match(/\/object\/sign\/resumes\/([^?]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
export function parseFiles(json: string | undefined): { path: string; filename: string }[] {
  if (!json) return [];
  try { const arr = JSON.parse(json); return Array.isArray(arr) ? arr.filter(f => f && typeof f.path === "string") : []; } catch { return []; }
}
export function fileEntries(app: Application) {
  const m = answerMap(app);
  return { portfolio: parseFiles(m.get(META.portfolioFiles)), creative: parseFiles(m.get(META.creativeFiles)) };
}

/** Sheets API requests that make a fresh tab readable: frozen bold header, wrap, widths, banding, filter. */
export function formatRequests(sheetId: number, headers: string[], answerColumnsFrom: number) {
  const width = (start: number, end: number, px: number) => ({ updateDimensionProperties: {
    range: { sheetId, dimension: "COLUMNS", startIndex: start, endIndex: end }, properties: { pixelSize: px }, fields: "pixelSize" } });
  return [
    { repeatCell: { range: { sheetId, startRowIndex: 0, endRowIndex: 1 }, cell: { userEnteredFormat: {
      backgroundColor: { red: 0.14, green: 0.24, blue: 0.31 }, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
      wrapStrategy: "WRAP", verticalAlignment: "MIDDLE" } }, fields: "userEnteredFormat(backgroundColor,textFormat,wrapStrategy,verticalAlignment)" } },
    { repeatCell: { range: { sheetId, startRowIndex: 1 }, cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
      fields: "userEnteredFormat(wrapStrategy,verticalAlignment)" } },
    { updateDimensionProperties: { range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 }, properties: { pixelSize: 64 }, fields: "pixelSize" } },
    width(0, 1, 170), width(1, 2, 210), width(2, answerColumnsFrom, 140),
    ...(headers.length > answerColumnsFrom ? [width(answerColumnsFrom, headers.length, 460)] : []),
    { addBanding: { bandedRange: { range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: headers.length },
      rowProperties: { headerColor: { red: 0.14, green: 0.24, blue: 0.31 }, firstBandColor: { red: 1, green: 1, blue: 1 }, secondBandColor: { red: 0.96, green: 0.97, blue: 0.98 } } } } },
    { setBasicFilter: { filter: { range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: headers.length } } } },
    { addProtectedRange: { protectedRange: { range: { sheetId }, warningOnly: true,
      description: "Rows are placed by the application portal. Comment on cells; do not sort, insert or delete rows." } } },
  ];
}
