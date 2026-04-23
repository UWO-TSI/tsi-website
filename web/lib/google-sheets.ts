import { google } from "googleapis";
import type { Application, Position } from "./recruitment";

function getAuth() {
  const credentials = JSON.parse(
    process.env.GOOGLE_DRIVE_CREDENTIALS ?? "{}"
  );
  return new google.auth.GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive.file",
    ],
  });
}

// In-memory cache for auto-created spreadsheet ID
let cachedSpreadsheetId: string | null = null;

/**
 * Get or create the recruitment spreadsheet.
 * If GOOGLE_SHEETS_SPREADSHEET_ID is set, uses that.
 * Otherwise creates a new spreadsheet in the Drive folder.
 */
async function getSpreadsheetId(): Promise<string> {
  if (process.env.GOOGLE_SHEETS_SPREADSHEET_ID) {
    return process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  }

  if (cachedSpreadsheetId) {
    return cachedSpreadsheetId;
  }

  const auth = getAuth();
  const drive = google.drive({ version: "v3", auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

  // Check if a spreadsheet already exists in the folder
  const existing = await drive.files.list({
    q: `name='Tethos Recruitment 2026-27' and '${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    fields: "files(id)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (existing.data.files && existing.data.files.length > 0) {
    cachedSpreadsheetId = existing.data.files[0].id!;
    return cachedSpreadsheetId;
  }

  // Create new spreadsheet in the folder
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheet = await sheets.spreadsheets.create({
    requestBody: {
      properties: { title: "Tethos Recruitment 2026-27" },
      sheets: [{ properties: { title: "Applications" } }],
    },
  });

  const newId = spreadsheet.data.spreadsheetId!;

  // Move to the Drive folder
  await drive.files.update({
    fileId: newId,
    addParents: folderId,
    removeParents: "root",
    fields: "id, parents",
    supportsAllDrives: true,
  });

  cachedSpreadsheetId = newId;
  console.log(`Created recruitment spreadsheet: ${newId}`);
  return newId;
}

/**
 * Append an application row to the Google Sheet.
 * Creates the spreadsheet and headers if they don't exist.
 */
export async function syncApplicationToSheet(
  application: Application,
  position: Position
): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = await getSpreadsheetId();
  const sheetName = "Applications";

  // Check if headers exist
  const existing = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A1:A1`,
  });

  if (!existing.data.values || existing.data.values.length === 0) {
    // Write headers
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [
          [
            "Application ID",
            "Position",
            "Phase",
            "Full Name",
            "Email",
            "Phone",
            "Program/Major",
            "Year",
            "LinkedIn",
            "Heard About Us",
            "Resume URL",
            "Status",
            "Tags",
            "Submitted At",
          ],
        ],
      },
    });
  }

  // Append the row
  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A:N`,
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
          application.id,
          position.title,
          `Phase ${position.phase}`,
          application.full_name,
          application.email,
          application.phone,
          application.program_major,
          application.year_of_study,
          application.linkedin_url ?? "",
          application.heard_about_us,
          application.resume_drive_url ?? "",
          application.status,
          application.tags.join(", "),
          application.submitted_at,
        ],
      ],
    },
  });
}

/**
 * Update an existing row's status in the sheet (by application ID).
 */
export async function updateSheetStatus(
  applicationId: string,
  newStatus: string
): Promise<void> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = await getSpreadsheetId();
  const sheetName = "Applications";

  // Find the row
  const data = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:A`,
  });

  const rows = data.data.values ?? [];
  const rowIndex = rows.findIndex((row) => row[0] === applicationId);
  if (rowIndex === -1) return;

  // Update status column (L = column 12)
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!L${rowIndex + 1}`,
    valueInputOption: "RAW",
    requestBody: {
      values: [[newStatus]],
    },
  });
}
