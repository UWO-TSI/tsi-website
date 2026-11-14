import { NextResponse } from "next/server";
import { clubAdmin } from "@/lib/server/clubAdmin";
import { attendanceSheetId, connectAttendanceSheet, rebuildAttendanceSheet, sheetUrl, siteGoogleAccount } from "@/lib/attendance-sheet";

/** GET /api/admin/attendance/sheet: the connected sheet (if any) and the Google account that writes it. */
export async function GET() {
  const ctx = await clubAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const [id, account] = await Promise.all([attendanceSheetId(ctx.db), siteGoogleAccount()]);
  return NextResponse.json({ url: id ? sheetUrl(id) : null, account }, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/admin/attendance/sheet {link}: connect a sheet (and fill it). Without a link: rebuild the connected one. */
export async function POST(request: Request) {
  const ctx = await clubAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const body = (await request.json().catch(() => null)) as { link?: unknown } | null;
  if (typeof body?.link === "string") {
    const r = await connectAttendanceSheet(ctx.db, body.link);
    return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: 400 });
  }
  const id = await attendanceSheetId(ctx.db);
  if (!id) return NextResponse.json({ error: "Connect a sheet first." }, { status: 400 });
  const rows = await rebuildAttendanceSheet(ctx.db, id).catch(() => null);
  return rows === null
    ? NextResponse.json({ error: "Couldn't write to the sheet. Check the site's Google account can still edit it." }, { status: 503 })
    : NextResponse.json({ ok: true, url: sheetUrl(id), rows });
}
