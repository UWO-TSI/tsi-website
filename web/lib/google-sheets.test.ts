import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  claim: true, googleFails: false, queue: [{ application_id: "deleted-record", sheet_row: 8, version: 2, tab_row: null, all_row: 5, position_id: null }],
  writes: [] as unknown[], acknowledgments: [] as unknown[], updates: [] as { table: string; values: Record<string, unknown> }[],
  spreadsheetId: "existing-sheet" as string | null, foundId: null as string | null,
  creates: [] as unknown[], tabRequests: [] as unknown[], hasTab: true,
  accessError: null as unknown, writable: true, reads: 0, schemaMissing: false,
}));
vi.mock("./google-oauth", () => ({ getOAuthClient: () => ({}) }));
vi.mock("./supabase/admin", () => ({ createAdminClient: () => ({
  rpc: async (name: string, args: unknown) => {
    if (name === "claim_recruitment_sheet") return { data: mock.claim, error: null };
    mock.acknowledgments.push(args); return { error: null };
  },
  from: (table: string) => {
    let operation = "select";
    const q = {
      select: () => q, eq: () => q, is: () => q, order: () => q, limit: () => q, in: () => q, single: () => q,
      update: (values: Record<string, unknown>) => { operation = "update"; mock.updates.push({ table, values }); return q; },
      then: (resolve: (result: unknown) => unknown) => resolve({ error: mock.schemaMissing ? { code: "PGRST205" } : null, count: mock.queue.length, data: mock.schemaMissing || operation === "update" ? null : table === "recruitment_sheet_state" ? { spreadsheet_id: mock.spreadsheetId } : table === "recruitment_sheet_rows" ? mock.queue : [] }),
    }; return q;
  },
}) }));
vi.mock("googleapis", () => ({ google: {
  drive: () => ({ files: {
    get: async () => { mock.reads++; if (mock.accessError) throw mock.accessError; return { data: { capabilities: { canEdit: mock.writable, canAddChildren: mock.writable } } }; },
    list: async () => ({ data: { files: mock.foundId ? [{ id: mock.foundId }] : [] } }),
    create: async (request: unknown) => { mock.creates.push(request); return { data: { id: "new-sheet" } }; },
  } }),
  sheets: () => ({ spreadsheets: {
    get: async () => ({ data: { sheets: mock.hasTab ? [{ properties: { title: "Recruitment records", sheetId: 1, gridProperties: { rowCount: 2000, columnCount: 100 } } }] : [] } }),
    batchUpdate: async (request: unknown) => { mock.tabRequests.push(request); },
    values: { batchUpdate: async (request: unknown) => { mock.writes.push(request); if (mock.googleFails) throw new Error("simulated timeout after possible write"); } },
  } }),
} }));
import { syncRecruitmentSheet, sheetConnection, sheetSyncStatus } from "./google-sheets";

describe("durable Google delivery", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "test"); vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "test"); vi.stubEnv("GOOGLE_OAUTH_REFRESH_TOKEN", "test");
    mock.claim = true; mock.googleFails = false; mock.writes = []; mock.acknowledgments = []; mock.updates = [];
    mock.spreadsheetId = "existing-sheet"; mock.foundId = null; mock.creates = []; mock.tabRequests = []; mock.hasTab = true;
    mock.accessError = null; mock.writable = true; mock.reads = 0; mock.schemaMissing = false;
    vi.stubEnv("GOOGLE_SHEETS_SPREADSHEET_ID", "");
  });
  it("writes fixed rows as RAW, and clears deletion tombstones", async () => {
    await syncRecruitmentSheet();
    expect(mock.writes[0]).toMatchObject({ requestBody: { valueInputOption: "RAW", data: [{ range: "'Recruitment records'!A1:BR1" }, { range: "'Recruitment records'!A8:BR8", values: [Array(70).fill("")] }] } });
    expect(mock.acknowledgments).toEqual([{ p_rows: [{ application_id: "deleted-record", version: 2 }] }]);
  });
  it("creates the reviewer tabs, hides the master, removes legacy tabs and writes fixed rows", async () => {
    await syncRecruitmentSheet();
    // One structural request: hide the master tab (no legacy tabs in the mock), add All applicants.
    expect(mock.tabRequests[0]).toMatchObject({ spreadsheetId: "existing-sheet", requestBody: { requests: [
      { updateSheetProperties: { properties: { sheetId: 1, hidden: true } } },
      { addSheet: { properties: { title: "All applicants", gridProperties: { frozenRowCount: 1 } } } },
    ] } });
    const view = mock.writes[1] as { requestBody: { valueInputOption: string; data: { range: string; values: string[][] }[] } };
    expect(view.requestBody.valueInputOption).toBe("USER_ENTERED");
    // The deleted application is blanked on its fixed reviewer row; no ID columns anywhere.
    expect(view.requestBody.data).toEqual([
      { range: "'All applicants'!A1:H1", values: [["Name", "Email", "Role", "Program", "Year", "Submitted", "Resume", "LinkedIn"]] },
      { range: "'All applicants'!A5:H5", values: [Array(8).fill("")] },
    ]);
    expect(mock.acknowledgments).toHaveLength(1);
  });
  it("keeps a failed write pending, releases the lease and retries the identical row", async () => {
    mock.googleFails = true;
    await expect(syncRecruitmentSheet()).rejects.toThrow("simulated timeout");
    expect(mock.acknowledgments).toHaveLength(0);
    expect(mock.updates).toContainEqual(expect.objectContaining({ values: expect.objectContaining({ lease_token: null, lease_until: null }) }));
    mock.googleFails = false;
    await syncRecruitmentSheet();
    expect(mock.writes[1]).toEqual(mock.writes[0]);
    expect(mock.acknowledgments).toHaveLength(1);
  });
  it("does not write if another worker holds the lease", async () => {
    mock.claim = false;
    expect(await syncRecruitmentSheet()).toEqual({ synced: 0, busy: true });
    expect(mock.writes).toHaveLength(0);
  });
  it("creates and persists a marked spreadsheet and its managed tab on first sync", async () => {
    mock.spreadsheetId = null; mock.hasTab = false;
    await syncRecruitmentSheet();
    expect(mock.creates).toHaveLength(1);
    expect(mock.creates[0]).toMatchObject({ requestBody: { mimeType: "application/vnd.google-apps.spreadsheet", appProperties: { tethosRecruitment: "records-v1" } } });
    expect(mock.updates).toContainEqual({ table: "recruitment_sheet_state", values: { spreadsheet_id: "new-sheet" } });
    expect(mock.tabRequests[0]).toMatchObject({ spreadsheetId: "new-sheet", requestBody: { requests: [{ addSheet: { properties: { title: "Recruitment records" } } }] } });
  });
  it("treats a whitespace-only configured workbook as absent and trims the folder", async () => {
    mock.spreadsheetId = null;
    vi.stubEnv("GOOGLE_SHEETS_SPREADSHEET_ID", " \n");
    vi.stubEnv("GOOGLE_DRIVE_FOLDER_ID", " recruitment-folder\n");
    expect(await sheetSyncStatus()).toMatchObject({ url: null, connection: "connected" });
    await syncRecruitmentSheet();
    expect(mock.creates[0]).toMatchObject({ requestBody: { parents: ["recruitment-folder"] } });
    expect(mock.writes[0]).toMatchObject({ spreadsheetId: "new-sheet" });
  });
  it("recovers a previously created workbook after a server interruption", async () => {
    mock.spreadsheetId = null; mock.foundId = "recovered-sheet";
    await syncRecruitmentSheet();
    expect(mock.creates).toHaveLength(0);
    expect(mock.writes[0]).toMatchObject({ spreadsheetId: "recovered-sheet" });
  });
  it("does not mistake present but revoked credentials for a connection", async () => {
    mock.accessError = { response: { data: { error: "invalid_grant", error_description: "sensitive upstream detail" } } };
    const status = await sheetSyncStatus();
    expect(status).toMatchObject({ configured: true, setup_ready: true, connection: "reconnect", pending: 1 });
    expect(JSON.stringify(status)).not.toContain("sensitive upstream detail");
    expect(mock.writes).toHaveLength(0);
  });
  it("reports missing delivery schema and broken Google access together", async () => {
    mock.schemaMissing = true;
    vi.stubEnv("GOOGLE_DRIVE_FOLDER_ID", "recruitment-folder");
    mock.accessError = { response: { data: { error: "invalid_grant" } } };
    expect(await sheetSyncStatus()).toMatchObject({ setup_ready: false, pending: null, connection: "reconnect" });
  });
  it("checks destination edit permissions without writing", async () => {
    mock.writable = false;
    expect(await sheetConnection("existing-sheet")).toMatchObject({ connection: "unavailable" });
    mock.writable = true;
    expect(await sheetConnection("existing-sheet")).toEqual({ connection: "connected", connection_message: null });
    expect(mock.writes).toHaveLength(0);
    expect(mock.creates).toHaveLength(0);
    expect(mock.acknowledgments).toHaveLength(0);
  });
  it("returns a safe transient-error message and recovers on the next check", async () => {
    mock.accessError = new Error("private Google response");
    expect(await sheetConnection("existing-sheet")).toMatchObject({ connection: "unavailable" });
    mock.accessError = null;
    expect(await sheetConnection("existing-sheet")).toMatchObject({ connection: "connected" });
  });
  it("does not contact Google when credentials are missing", async () => {
    vi.stubEnv("GOOGLE_OAUTH_REFRESH_TOKEN", "");
    expect(await sheetConnection("existing-sheet")).toMatchObject({ connection: "missing" });
    expect(mock.reads).toBe(0);
  });
});
