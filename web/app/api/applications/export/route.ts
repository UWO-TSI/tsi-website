import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin";
import { SHEET_HEADERS, sheetRow } from "@/lib/recruitment-sheet-data";
import { recruitmentOrigin } from "@/lib/google-sheets";
import type { Application } from "@/lib/recruitment";

function csvCell(value: string | number): string {
  // CSV has no RAW input option, so prevent applicant text becoming a formula.
  const text = String(value);
  const safe = /^\s*[=+@-]/u.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '\"\"')}"`;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createAdminClient();
  const lines = [SHEET_HEADERS.map(csvCell).join(",")];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await admin.from("applications").select("*, position:positions(*)")
      .order("submitted_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + 499);
    if (error) return NextResponse.json({ error: "Could not export applications. Please try again." }, { status: 500 });
    for (const app of (data ?? []) as Application[]) {
      lines.push(sheetRow(app, recruitmentOrigin()).map(csvCell).join(","));
    }
    if (!data || data.length < 500) break;
  }
  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(lines.join("\r\n"), { headers: {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="tethos-applications-${stamp}.csv"`,
    "Cache-Control": "no-store",
  } });
}
