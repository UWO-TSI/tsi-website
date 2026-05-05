// Admin-only: download all applications as CSV. Includes the JSONB
// meta fields (other links, commitments, portfolio link, file paths)
// flattened into their own columns so the spreadsheet is readable.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin";

const META_OTHER_LINKS_ID = "__profile_other_links";
const META_COMMITMENTS_ID = "__profile_commitments_next_year";
const META_PORTFOLIO_FILES_ID = "__portfolio_files";
const META_PORTFOLIO_LINK_ID = "__portfolio_link";
const META_CREATIVE_PIECE_FILES_ID = "__creative_piece_files";
const META_IDS = new Set([
  META_OTHER_LINKS_ID,
  META_COMMITMENTS_ID,
  META_PORTFOLIO_FILES_ID,
  META_PORTFOLIO_LINK_ID,
  META_CREATIVE_PIECE_FILES_ID,
]);

interface FileEntry {
  path: string;
  filename: string;
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  // Quote anything with comma, quote, or newline; double internal quotes.
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

function findMeta(
  answers: { question_id: string; answer: string }[],
  id: string
): string {
  return answers.find((a) => a.question_id === id)?.answer ?? "";
}

function fileList(json: string): string {
  if (!json) return "";
  try {
    const arr = JSON.parse(json) as FileEntry[];
    return arr.map((f) => f.filename).join(" | ");
  } catch {
    return "";
  }
}

function filePaths(json: string): string {
  if (!json) return "";
  try {
    const arr = JSON.parse(json) as FileEntry[];
    return arr.map((f) => f.path).join(" | ");
  } catch {
    return "";
  }
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("applications")
    .select(
      "id, submitted_at, status, full_name, email, phone, " +
        "program_major, year_of_study, linkedin_url, heard_about_us, " +
        "resume_filename, resume_drive_url, essay_answers, tags, admin_notes, " +
        "position:positions(slug, title)"
    )
    .order("submitted_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];

  // Collect all unique non-meta question_ids across applications so each
  // gets its own CSV column.
  const realQuestionIds = new Set<string>();
  for (const r of rows) {
    for (const a of r.essay_answers ?? []) {
      if (!META_IDS.has(a.question_id) && a.answer?.trim()) {
        realQuestionIds.add(a.question_id);
      }
    }
  }
  const essayCols = [...realQuestionIds].sort();

  const header = [
    "submitted_at",
    "position",
    "status",
    "full_name",
    "email",
    "phone",
    "program",
    "year",
    "linkedin",
    "other_links",
    "commitments_next_year",
    "portfolio_link",
    "portfolio_files",
    "portfolio_paths",
    "creative_files",
    "creative_paths",
    "resume_filename",
    "resume_url",
    "heard_about_us",
    "tags",
    "admin_notes",
    ...essayCols.map((id) => `essay:${id}`),
  ];

  const lines = [csvRow(header)];

  for (const r of rows) {
    const answers = r.essay_answers ?? [];
    const positionAny = r.position as
      | { title?: string; slug?: string }
      | { title?: string; slug?: string }[]
      | null
      | undefined;
    const positionRow = Array.isArray(positionAny)
      ? positionAny[0]
      : positionAny;
    const positionLabel = positionRow
      ? `${positionRow.title ?? ""} (${positionRow.slug ?? ""})`
      : "";

    const cells: unknown[] = [
      r.submitted_at,
      positionLabel,
      r.status,
      r.full_name,
      r.email,
      r.phone,
      r.program_major,
      r.year_of_study,
      r.linkedin_url ?? "",
      findMeta(answers, META_OTHER_LINKS_ID),
      findMeta(answers, META_COMMITMENTS_ID),
      findMeta(answers, META_PORTFOLIO_LINK_ID),
      fileList(findMeta(answers, META_PORTFOLIO_FILES_ID)),
      filePaths(findMeta(answers, META_PORTFOLIO_FILES_ID)),
      fileList(findMeta(answers, META_CREATIVE_PIECE_FILES_ID)),
      filePaths(findMeta(answers, META_CREATIVE_PIECE_FILES_ID)),
      r.resume_filename ?? "",
      r.resume_drive_url ?? "",
      r.heard_about_us,
      (r.tags ?? []).join(" | "),
      r.admin_notes ?? "",
      ...essayCols.map((id) => findMeta(answers, id)),
    ];

    lines.push(csvRow(cells));
  }

  const body = lines.join("\r\n");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tsi-applications-${stamp}.csv"`,
    },
  });
}
