import { google } from "googleapis";
import { Readable } from "stream";
import { getOAuthClient } from "./google-oauth";

/**
 * Upload a file buffer to Google Drive on behalf of the OAuth user.
 * Files are owned by that user (davidliu8473@gmail.com) and count
 * against their personal Drive quota.
 *
 * Returns the web view URL of the uploaded file.
 */
export async function uploadResumeToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  folderPath: string // e.g. "Recruitment/vp-internal"
): Promise<{ fileUrl: string; fileId: string }> {
  const auth = getOAuthClient();
  const drive = google.drive({ version: "v3", auth });
  const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID!;

  const folderId = await ensureFolderPath(drive, rootFolderId, folderPath);

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType,
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: "id, webViewLink",
  });

  await drive.permissions.create({
    fileId: response.data.id!,
    requestBody: {
      role: "reader",
      type: "anyone",
    },
  });

  return {
    fileUrl: response.data.webViewLink!,
    fileId: response.data.id!,
  };
}

async function ensureFolderPath(
  drive: ReturnType<typeof google.drive>,
  parentId: string,
  path: string
): Promise<string> {
  const parts = path.split("/").filter(Boolean);
  let currentParent = parentId;

  for (const folderName of parts) {
    const query = `name='${folderName.replace(/'/g, "\\'")}' and '${currentParent}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const existing = await drive.files.list({
      q: query,
      fields: "files(id)",
    });

    if (existing.data.files && existing.data.files.length > 0) {
      currentParent = existing.data.files[0].id!;
    } else {
      const created = await drive.files.create({
        requestBody: {
          name: folderName,
          parents: [currentParent],
          mimeType: "application/vnd.google-apps.folder",
        },
        fields: "id",
      });
      currentParent = created.data.id!;
    }
  }

  return currentParent;
}
