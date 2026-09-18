import { randomUUID } from "node:crypto";
import { google } from "googleapis";
import { getOAuthClient } from "./google-oauth";
import { createAdminClient } from "./supabase/admin";
import type { Application } from "./recruitment";
import { SHEET_TAB, SHEET_HEADERS, sheetRow, columnName } from "./recruitment-sheet-data";
import { ALL_HEADERS, ALL_TAB, LEGACY_TABS, RESUME_LINK_TTL_SECONDS, ROLE_TABS, allRow, fileEntries, formatRequests, resumePath, roleHeaders, roleRow, type RowLinks } from "./recruitment-sheet-tabs";
import type { Position } from "./recruitment";

const GOOGLE_OPTIONS = { timeout: 15000, retry: false };
const BATCH_SIZE = 100;
const SHEET_TITLE = "Tethos Recruitment 2026-27";
const configuredSheetId = () => process.env.GOOGLE_SHEETS_SPREADSHEET_ID?.trim() || null;
const configuredFolderId = () => process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || null;
export const recruitmentOrigin = () => process.env.NEXT_PUBLIC_SITE_URL || "https://www.tethos.ca";

export function sheetsConfigured(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET && process.env.GOOGLE_OAUTH_REFRESH_TOKEN);
}

/** Read-only health check. Credential presence is not proof of Google access. */
export async function sheetConnection(spreadsheetId: string | null) {
  spreadsheetId = spreadsheetId?.trim() || null;
  if (!sheetsConfigured()) return { connection: "missing" as const, connection_message: "Connect the recruitment Google account before syncing." };
  try {
    const auth = getOAuthClient();
    const drive = google.drive({ version: "v3", auth });
    const destination = spreadsheetId || configuredFolderId();
    if (destination) {
      const file = await drive.files.get({ fileId: destination, supportsAllDrives: true,
        fields: "id,mimeType,capabilities(canEdit,canAddChildren)" }, GOOGLE_OPTIONS);
      const writable = spreadsheetId ? file.data.capabilities?.canEdit : file.data.capabilities?.canAddChildren;
      if (!writable) return { connection: "unavailable" as const, connection_message: "The recruitment Google account cannot write to the configured destination. Check its access." };
    } else {
      await drive.about.get({ fields: "kind" }, GOOGLE_OPTIONS);
    }
    if (spreadsheetId) await google.sheets({ version: "v4", auth }).spreadsheets.get({ spreadsheetId, fields: "spreadsheetId" }, GOOGLE_OPTIONS);
    return { connection: "connected" as const, connection_message: null };
  } catch (error) {
    const response = (error as { response?: { data?: { error?: unknown } } })?.response;
    if (response?.data?.error === "invalid_grant") return { connection: "reconnect" as const,
      connection_message: "Google authorization expired or was revoked. Reconnect the recruitment Google account; applications remain saved." };
    return { connection: "unavailable" as const, connection_message: "Google access could not be verified. Check the connection and destination, then retry. Applications remain saved." };
  }
}

export async function sheetSyncStatus() {
  const admin = createAdminClient();
  const [state, pending] = await Promise.all([
    admin.from("recruitment_sheet_state").select("spreadsheet_id,last_synced_at,last_error,next_attempt_at").eq("id", true).single(),
    admin.from("recruitment_sheet_rows").select("application_id", { count: "exact" }).is("synced_at", null).limit(1),
  ]);
  const errors = [state.error, pending.error].filter(Boolean);
  if (errors.some(error => error?.code !== "PGRST205" && error?.code !== "PGRST116")) throw new Error("Could not check spreadsheet delivery");
  const setup_ready = errors.length === 0;
  const spreadsheetId = state.data?.spreadsheet_id?.trim() || configuredSheetId();
  return { setup_ready, pending: setup_ready ? pending.count ?? 0 : null, configured: sheetsConfigured(),
    last_synced_at: state.data?.last_synced_at ?? null, last_error: state.data?.last_error ?? null,
    next_attempt_at: state.data?.next_attempt_at ?? null,
    ...(await sheetConnection(spreadsheetId)),
    url: spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit` : null };
}

/** Fixed database-assigned rows, one leased worker, and version-aware acknowledgments. */
export async function syncRecruitmentSheet() {
  const admin = createAdminClient();
  if (!sheetsConfigured()) return { synced: 0, configured: false };
  const token = randomUUID();
  const claim = await admin.rpc("claim_recruitment_sheet", { p_token: token });
  if (claim.error) throw new Error("Spreadsheet delivery migration is not available");
  if (!claim.data) return { synced: 0, busy: true };
  let failed = false;
  try {
    const queued = await admin.from("recruitment_sheet_rows").select("application_id,sheet_row,version,tab_row,all_row,position_id")
      .is("synced_at", null).order("sheet_row").limit(BATCH_SIZE);
    if (queued.error) throw queued.error;
    const rows = queued.data ?? [];
    const auth = getOAuthClient();
    const sheets = google.sheets({ version: "v4", auth });
    const drive = google.drive({ version: "v3", auth });
    const state = await admin.from("recruitment_sheet_state").select("spreadsheet_id").eq("id", true).single();
    if (state.error) throw state.error;
    let spreadsheetId = (state.data.spreadsheet_id as string | null)?.trim() || null;
    if (!rows.length && spreadsheetId) return { synced: 0, configured: true };
    if (!spreadsheetId) {
      spreadsheetId = configuredSheetId();
      if (!spreadsheetId) {
        // Recover a create that succeeded at Google before the server stopped.
        const found = await drive.files.list({
          q: "appProperties has { key='tethosRecruitment' and value='records-v1' } and trashed=false",
          fields: "files(id)", pageSize: 10,
        }, GOOGLE_OPTIONS);
        spreadsheetId = found.data.files?.[0]?.id ?? null;
        if (!spreadsheetId) {
          const file = await drive.files.create({ requestBody: {
            name: SHEET_TITLE, mimeType: "application/vnd.google-apps.spreadsheet",
            appProperties: { tethosRecruitment: "records-v1" },
            ...(configuredFolderId() ? { parents: [configuredFolderId()!] } : {}),
          }, fields: "id", supportsAllDrives: true }, GOOGLE_OPTIONS);
          spreadsheetId = file.data.id ?? null;
        }
      }
      if (!spreadsheetId) throw new Error("Google did not return a spreadsheet ID");
      const saved = await admin.from("recruitment_sheet_state").update({ spreadsheet_id: spreadsheetId }).eq("id", true).eq("lease_token", token);
      if (saved.error) throw saved.error;
    }
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" }, GOOGLE_OPTIONS);
    const tab = meta.data.sheets?.find(s => s.properties?.title === SHEET_TAB)?.properties;
    const rowCount = Math.max(1000, ...rows.map(r => Number(r.sheet_row) + 100));
    if (!tab) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ addSheet: { properties: {
        title: SHEET_TAB, gridProperties: { rowCount, columnCount: SHEET_HEADERS.length, frozenRowCount: 1 },
      } } }] } }, GOOGLE_OPTIONS);
    } else if ((tab.gridProperties?.rowCount ?? 0) < rowCount || (tab.gridProperties?.columnCount ?? 0) < SHEET_HEADERS.length) {
      await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: [{ updateSheetProperties: {
        properties: { sheetId: tab.sheetId, gridProperties: {
          rowCount: Math.max(rowCount, tab.gridProperties?.rowCount ?? 0),
          columnCount: Math.max(SHEET_HEADERS.length, tab.gridProperties?.columnCount ?? 0),
        } }, fields: "gridProperties.rowCount,gridProperties.columnCount",
      } }] } }, GOOGLE_OPTIONS);
    }
    const apps = rows.length ? await admin.from("applications").select("*, position:positions(*)").in("id", rows.map(r => r.application_id)) : { data: [], error: null };
    if (apps.error) throw apps.error;
    const byId = new Map((apps.data as Application[]).map(a => [a.id, a]));
    const end = columnName(SHEET_HEADERS.length);
    await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: {
      valueInputOption: "RAW",
      data: [
        { range: `'${SHEET_TAB}'!A1:${end}1`, values: [SHEET_HEADERS] },
        ...rows.map(r => ({ range: `'${SHEET_TAB}'!A${r.sheet_row}:${end}${r.sheet_row}`,
          values: [byId.has(r.application_id) ? sheetRow(byId.get(r.application_id)!, recruitmentOrigin()) : SHEET_HEADERS.map(() => "")] })),
      ],
    } }, GOOGLE_OPTIONS);
    // Reviewer tabs (one per live role + All applicants), written after the
    // master rows so a failure retries the same delivery. Rows are fixed per
    // application (tab_row / all_row) because reviewers comment on cells.
    await writeReviewerTabs(admin, sheets, spreadsheetId, meta.data.sheets ?? [], rows as QueuedRow[], apps.data as Application[]);
    const now = new Date().toISOString();
    // A concurrent edit increments version; it must remain queued for the next write.
    const ack = await admin.rpc("ack_recruitment_sheet", { p_rows: rows.map(({ application_id, version }) => ({ application_id, version })) });
    if (ack.error) throw ack.error;
    const done = await admin.from("recruitment_sheet_state").update({ last_synced_at: now, last_error: null })
      .eq("id", true).eq("lease_token", token);
    if (done.error) throw done.error;
    return { synced: rows.length, configured: true };
  } catch (error) {
    failed = true;
    // Do not persist Google error bodies: they can contain credentials or applicant data.
    await admin.from("recruitment_sheet_state").update({
      last_error: "Google Sheets sync failed. Applications are saved. Check Google access and retry.",
      next_attempt_at: new Date(Date.now() + 60_000).toISOString(),
    }).eq("id", true).eq("lease_token", token);
    throw error;
  } finally {
    await admin.from("recruitment_sheet_state").update({ lease_token: null, lease_until: null,
      ...(!failed ? { next_attempt_at: new Date(Date.now() + 10_000).toISOString() } : {}),
    }).eq("id", true).eq("lease_token", token);
  }
}

export async function trySheetSync() {
  try { await syncRecruitmentSheet(); } catch { console.error("Recruitment spreadsheet sync pending retry"); }
}

type QueuedRow = { application_id: string; sheet_row: number; version: number; tab_row: number | null; all_row: number | null; position_id: string | null };
type SheetProps = { properties?: { title?: string | null; sheetId?: number | null; hidden?: boolean | null; gridProperties?: { rowCount?: number | null; columnCount?: number | null } | null } | null };
type SheetsApi = ReturnType<typeof google.sheets>;
type AdminApi = ReturnType<typeof createAdminClient>;

async function signLinks(admin: AdminApi, app: Application): Promise<RowLinks> {
  const links: RowLinks = { resume: null, portfolioFiles: [], creativeFiles: [] };
  const files = fileEntries(app);
  try {
    const path = resumePath(app.resume_drive_url);
    if (path) {
      const signed = await admin.storage.from("resumes").createSignedUrl(path, RESUME_LINK_TTL_SECONDS);
      links.resume = signed.data?.signedUrl ?? null;
    }
    for (const [key, list] of [["portfolioFiles", files.portfolio], ["creativeFiles", files.creative]] as const) {
      if (!list.length) { continue; }
      const signed = await admin.storage.from("portfolios").createSignedUrls(list.map(f => f.path), RESUME_LINK_TTL_SECONDS);
      const byPath = new Map((signed.data ?? []).map(x => [x.path, x.signedUrl]));
      links[key] = list.map(f => ({ filename: f.filename, url: byPath.get(f.path) ?? null }));
    }
  } catch {
    // A file that cannot be signed shows as its name; the row still delivers.
    links.portfolioFiles = files.portfolio.map(f => ({ filename: f.filename, url: null }));
    links.creativeFiles = files.creative.map(f => ({ filename: f.filename, url: null }));
  }
  return links;
}

async function writeReviewerTabs(admin: AdminApi, sheets: SheetsApi, spreadsheetId: string, existing: SheetProps[], rows: QueuedRow[], apps: Application[]) {
  const byId = new Map(apps.map(a => [a.id, a]));
  const positionIds = [...new Set(rows.map(r => r.position_id ?? byId.get(r.application_id)?.position_id).filter((x): x is string => !!x))];
  const positions = positionIds.length ? await admin.from("positions").select("*").in("id", positionIds) : { data: [], error: null };
  if (positions.error) throw positions.error;
  const positionById = new Map(((positions.data ?? []) as Position[]).map(p => [p.id, p]));
  const tabs = new Map(existing.map(s => [s.properties?.title ?? "", s.properties ?? {}]));

  // Tabs needed by this batch; All applicants always.
  const needed: { title: string; headers: string[]; answersFrom: number }[] = [{ title: ALL_TAB, headers: ALL_HEADERS, answersFrom: ALL_HEADERS.length }];
  for (const p of positionById.values()) {
    const title = ROLE_TABS[p.slug];
    if (title && !needed.some(n => n.title === title)) needed.push({ title, headers: roleHeaders(p), answersFrom: roleHeaders(p).length - p.essay_questions.length });
  }
  const requests: object[] = [];
  const master = tabs.get(SHEET_TAB);
  if (master?.sheetId !== undefined && master?.sheetId !== null && !master.hidden) {
    requests.push({ updateSheetProperties: { properties: { sheetId: master.sheetId, hidden: true }, fields: "hidden" } });
  }
  for (const legacy of LEGACY_TABS) {
    const t = tabs.get(legacy);
    if (t?.sheetId !== undefined && t?.sheetId !== null) requests.push({ deleteSheet: { sheetId: t.sheetId } });
  }
  const missing = needed.filter(n => !tabs.has(n.title));
  for (const n of missing) requests.push({ addSheet: { properties: { title: n.title, gridProperties: { rowCount: 1000, columnCount: n.headers.length + 2, frozenRowCount: 1 } } } });
  if (requests.length) {
    const res = await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } }, GOOGLE_OPTIONS);
    const replies = (res as { data?: { replies?: { addSheet?: { properties?: { sheetId?: number | null } } }[] } } | undefined)?.data?.replies ?? [];
    const created = replies.map(r => r.addSheet?.properties?.sheetId).filter((x): x is number => typeof x === "number");
    const format = missing.flatMap((n, i) => created[i] === undefined ? [] : formatRequests(created[i], n.headers, n.answersFrom));
    if (format.length) await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests: format } }, GOOGLE_OPTIONS);
  }

  const data: { range: string; values: string[][] }[] = [];
  const blank = (n: number) => Array.from({ length: n }, () => "");
  const links = new Map<string, RowLinks>();
  for (const r of rows) {
    const app = byId.get(r.application_id);
    if (app && positionById.get(app.position_id) && !positionById.get(app.position_id)!.archived_at) links.set(app.id, await signLinks(admin, app));
  }
  const allEnd = columnName(ALL_HEADERS.length);
  data.push({ range: `'${ALL_TAB}'!A1:${allEnd}1`, values: [ALL_HEADERS] });
  for (const r of rows) {
    if (!r.all_row) continue;
    const app = byId.get(r.application_id);
    const position = app ? positionById.get(app.position_id) : undefined;
    const live = app && position && !position.archived_at;
    data.push({ range: `'${ALL_TAB}'!A${r.all_row}:${allEnd}${r.all_row}`, values: [live ? allRow(app, position, links.get(app.id)!) : blank(ALL_HEADERS.length)] });
  }
  for (const n of needed) {
    if (n.title === ALL_TAB) continue;
    const end = columnName(n.headers.length);
    data.push({ range: `'${n.title}'!A1:${end}1`, values: [n.headers] });
    for (const r of rows) {
      if (!r.tab_row) continue;
      const position = r.position_id ? positionById.get(r.position_id) : undefined;
      if (!position || ROLE_TABS[position.slug] !== n.title) continue;
      const app = byId.get(r.application_id);
      const live = app && !position.archived_at;
      data.push({ range: `'${n.title}'!A${r.tab_row}:${end}${r.tab_row}`, values: [live ? roleRow(app, position, links.get(app.id)!) : blank(n.headers.length)] });
    }
  }
  await sheets.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "USER_ENTERED", data } }, GOOGLE_OPTIONS);
}
