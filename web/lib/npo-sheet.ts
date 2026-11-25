import { google } from "googleapis";
import { getOAuthClient } from "./google-oauth";
import { sheetsConfigured } from "./google-sheets";
import { createAdminClient } from "./supabase/admin";
import { ORG_TYPES } from "./npo-applications";

const TITLE = "Tethos nonprofit applications";
const HEADERS = ["Submitted", "Cycle", "Organization", "Type", "Website", "City", "Contact", "Email", "Role", "What they need", "Who would use it", "Current tools", "Can give 2 to 3 hours a week", "Heard about us", "Id"];
const OPTIONS = { timeout: 15000, retry: false };

export type NpoApplicationRow = {
  id: string; created_at: string; cycle: string; org_name: string; website: string | null; org_type: string; city: string | null;
  contact_name: string; contact_email: string; contact_role: string | null; problem: string; users: string | null;
  current_tools: string | null; can_commit: boolean; heard_about: string | null;
};

const values = (r: NpoApplicationRow) => [
  new Date(r.created_at).toLocaleString("en-CA", { timeZone: "America/Toronto" }), r.cycle, r.org_name,
  ORG_TYPES.find((t) => t.value === r.org_type)?.label ?? r.org_type, r.website ?? "", r.city ?? "", r.contact_name,
  r.contact_email, r.contact_role ?? "", r.problem, r.users ?? "", r.current_tools ?? "", r.can_commit ? "Yes" : "No", r.heard_about ?? "", r.id,
];

/**
 * Copies one application into the "Tethos nonprofit applications" sheet with the recruitment Google
 * account, creating the sheet (in the recruitment Drive folder) on the first real submission.
 * Preview rows never reach the sheet. The application is already saved; a failure here only leaves
 * `sheet_synced_at` empty, and /admin/npo still lists it.
 */
export async function copyToSheet(row: NpoApplicationRow): Promise<boolean> {
  if (row.cycle === "preview" || !sheetsConfigured()) return false;
  const admin = createAdminClient();
  const auth = getOAuthClient();
  const sheets = google.sheets({ version: "v4", auth });

  const read = async () => (await admin.from("npo_sheet_state").select("spreadsheet_id").eq("id", true).maybeSingle()).data?.spreadsheet_id ?? null;
  let spreadsheetId = await read();
  if (!spreadsheetId) {
    const folder = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
    const file = await google.drive({ version: "v3", auth }).files.create({
      requestBody: { name: TITLE, mimeType: "application/vnd.google-apps.spreadsheet", ...(folder ? { parents: [folder] } : {}) },
      fields: "id", supportsAllDrives: true,
    }, OPTIONS);
    await sheets.spreadsheets.values.update({ spreadsheetId: file.data.id!, range: "A1", valueInputOption: "RAW", requestBody: { values: [HEADERS] } }, OPTIONS);
    // Two first submissions at once both create a sheet; the first one stored wins.
    await admin.from("npo_sheet_state").upsert({ id: true, spreadsheet_id: file.data.id! }, { onConflict: "id", ignoreDuplicates: true });
    spreadsheetId = await read();
  }
  if (!spreadsheetId) return false;

  await sheets.spreadsheets.values.append({
    spreadsheetId, range: "A1", valueInputOption: "RAW", insertDataOption: "INSERT_ROWS", requestBody: { values: [values(row)] },
  }, OPTIONS);
  await admin.from("npo_applications").update({ sheet_synced_at: new Date().toISOString() }).eq("id", row.id);
  return true;
}

export async function npoSheetUrl(): Promise<string | null> {
  const { data } = await createAdminClient().from("npo_sheet_state").select("spreadsheet_id").eq("id", true).maybeSingle();
  return data?.spreadsheet_id ? `https://docs.google.com/spreadsheets/d/${data.spreadsheet_id}/edit` : null;
}
