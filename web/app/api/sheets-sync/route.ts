import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/supabase/admin";
import { sheetSyncStatus, syncRecruitmentSheet } from "@/lib/google-sheets";

export const maxDuration = 60;

async function allowed(request: Request) {
  const token = process.env.CRON_SECRET;
  const provided = request.headers.get("authorization") ?? "";
  if (token) {
    const expected = Buffer.from(`Bearer ${token}`);
    const actual = Buffer.from(provided);
    if (actual.length === expected.length && timingSafeEqual(actual, expected)) return true;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return !!user && isAdminEmail(user.email ?? "");
}

export async function GET(request: Request) {
  if (!(await allowed(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try { return NextResponse.json(await sheetSyncStatus(), { headers: { "Cache-Control": "no-store" } }); }
  catch { return NextResponse.json({ error: "Could not check spreadsheet delivery. Check the database connection and retry." }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!(await allowed(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const result = await syncRecruitmentSheet();
    return NextResponse.json({ ...result, ...(await sheetSyncStatus()) });
  } catch {
    return NextResponse.json({ error: "Could not sync Google Sheets. Applications are saved; delivery will retry. Check Google access and the delivery setup." }, { status: 503 });
  }
}
