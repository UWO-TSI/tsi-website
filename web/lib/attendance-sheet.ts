import { google } from "googleapis";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOAuthClient } from "./google-oauth";
import { sheetsConfigured } from "./google-sheets";
import { createAdminClient } from "./supabase/admin";

/**
 * Event check-ins copied to a Google Sheet an admin connects by pasting its link (club_admin_settings
 * 'attendance_sheet'). The site's Google account (lib/google-oauth.ts) writes it, so the sheet has to be one that
 * account can edit: made in its Drive, or shared with it. Each check-in is appended as it happens; connecting and
 * "Sync now" rebuild the tab from the database, so a missed append is never lost for good.
 */
const KEY = "attendance_sheet";
const TAB = "Attendance";
const HEADERS = ["Event", "Date", "Location", "Name", "Email"];
const OPTIONS = { timeout: 15000, retry: false };

type Row = { event: string; start: string; location: string | null; name: string; email: string };
const cells = (r: Row) => [r.event, new Date(r.start).toLocaleString("en-CA", { timeZone: "America/Toronto", dateStyle: "medium", timeStyle: "short" }), r.location ?? "", r.name, r.email];
const sheets = () => google.sheets({ version: "v4", auth: getOAuthClient() });
const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;

/** The spreadsheet id in a pasted Google Sheets link. */
export function sheetIdFrom(link: string): string | null {
  return link.trim().match(/\/spreadsheets\/d\/([A-Za-z0-9_-]{20,})/)?.[1] ?? null;
}
export const sheetUrl = (id: string) => `https://docs.google.com/spreadsheets/d/${id}/edit`;

export async function attendanceSheetId(db: SupabaseClient): Promise<string | null> {
  const { data } = await db.from("club_admin_settings").select("value").eq("key", KEY).maybeSingle();
  return data?.value ?? null;
}

/** The Google account the site writes with, so admins know who to share a sheet with. */
export async function siteGoogleAccount(): Promise<string | null> {
  if (!sheetsConfigured()) return null;
  return google.drive({ version: "v3", auth: getOAuthClient() }).about.get({ fields: "user(emailAddress)" }, OPTIONS)
    .then((r) => r.data.user?.emailAddress ?? null, () => null);
}

/** Every check-in at an in-person event, by event date then name. */
async function allCheckIns(db: SupabaseClient): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from("event_attendance")
      .select("events!inner(title, start_time, location, is_irl), profiles(display_name, email)")
      .eq("status", "attended").eq("events.is_irl", true).range(from, from + 999);
    if (error) throw error;
    for (const r of data ?? []) {
      const e = one(r.events as never) as { title: string; start_time: string; location: string | null } | null;
      const p = one(r.profiles as never) as { display_name: string; email: string } | null;
      if (e && p) rows.push({ event: e.title, start: e.start_time, location: e.location, name: p.display_name, email: p.email });
    }
    if ((data ?? []).length < 1000) break;
  }
  return rows.sort((a, b) => a.start.localeCompare(b.start) || a.event.localeCompare(b.event) || a.name.localeCompare(b.name));
}

/** Rebuild the sheet's Attendance tab (made if missing) from the database. Returns the number of check-ins. */
export async function rebuildAttendanceSheet(db: SupabaseClient, id: string): Promise<number> {
  const api = sheets();
  const meta = await api.spreadsheets.get({ spreadsheetId: id, fields: "sheets.properties.title" }, OPTIONS);
  if (!meta.data.sheets?.some((s) => s.properties?.title === TAB)) {
    await api.spreadsheets.batchUpdate({ spreadsheetId: id, requestBody: { requests: [{ addSheet: { properties: { title: TAB } } }] } }, OPTIONS);
  }
  const rows = await allCheckIns(db);
  await api.spreadsheets.values.clear({ spreadsheetId: id, range: TAB }, OPTIONS);
  await api.spreadsheets.values.update({ spreadsheetId: id, range: `${TAB}!A1`, valueInputOption: "RAW", requestBody: { values: [HEADERS, ...rows.map(cells)] } }, OPTIONS);
  return rows.length;
}

/** Connect a pasted sheet: it must open and take a rebuild before it's saved. */
export async function connectAttendanceSheet(db: SupabaseClient, link: string): Promise<{ ok: true; url: string; rows: number } | { ok: false; error: string }> {
  const id = sheetIdFrom(link);
  if (!id) return { ok: false, error: "That isn't a Google Sheets link. Copy it from the sheet's address bar." };
  if (!sheetsConfigured()) return { ok: false, error: "The site's Google account isn't connected." };
  const opened = await sheets().spreadsheets.get({ spreadsheetId: id, fields: "spreadsheetId" }, OPTIONS).then(() => true, () => false);
  if (!opened) return { ok: false, error: "The site's Google account can't open that sheet. Make the sheet in its Drive, or share it with that account as an editor." };
  let rows: number;
  try { rows = await rebuildAttendanceSheet(db, id); } catch { return { ok: false, error: "The site's Google account can open that sheet but can't edit it. Make it an editor." }; }
  const { error } = await db.from("club_admin_settings").upsert({ key: KEY, value: id, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: "The sheet works, but saving the link failed. Try again." };
  return { ok: true, url: sheetUrl(id), rows };
}

/** One new check-in, added to the bottom of the tab. Runs after the member has their answer; a failure only leaves the sheet short until the next sync. */
export async function appendCheckIn(eventId: string, userId: string): Promise<void> {
  if (!sheetsConfigured()) return;
  const db = createAdminClient();
  const id = await attendanceSheetId(db);
  if (!id) return;
  const [{ data: e }, { data: p }] = await Promise.all([
    db.from("events").select("title, start_time, location, is_irl").eq("id", eventId).maybeSingle(),
    db.from("profiles").select("display_name, email").eq("id", userId).maybeSingle(),
  ]);
  if (!e?.is_irl || !p) return;
  await sheets().spreadsheets.values.append({
    spreadsheetId: id, range: `${TAB}!A1`, valueInputOption: "RAW", insertDataOption: "INSERT_ROWS",
    requestBody: { values: [cells({ event: e.title, start: e.start_time, location: e.location, name: p.display_name, email: p.email })] },
  }, OPTIONS);
}
