#!/usr/bin/env node
// Quick verification that the configured GOOGLE_DRIVE_FOLDER_ID lives
// inside a Shared Drive and the service account has write access.
// Attempts a real (then deleted) upload to confirm end-to-end.

import { google } from "googleapis";
import { Readable } from "stream";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envText = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}

const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS);
const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
console.log("service account:", credentials.client_email);
console.log("folder id:", folderId);

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth });

try {
  // 1. Inspect the folder
  const folder = await drive.files.get({
    fileId: folderId,
    fields: "id, name, driveId, owners(emailAddress), parents, capabilities(canAddChildren)",
    supportsAllDrives: true,
  });
  console.log("\n1. Folder info:");
  console.log("   name:", folder.data.name);
  console.log("   driveId:", folder.data.driveId ?? "(none — not in a shared drive)");
  console.log("   owners:", folder.data.owners?.map((o) => o.emailAddress).join(", ") ?? "(none)");
  console.log("   canAddChildren:", folder.data.capabilities?.canAddChildren);

  if (!folder.data.driveId) {
    console.log(
      "\n❌ This folder is in a personal MyDrive, not a Shared Drive."
    );
    console.log(
      "   Service accounts can't own files in personal Drives."
    );
    console.log("   Action: create a Shared Drive, move this folder into it,");
    console.log("   add the service account as Content Manager, update env var.");
    process.exit(2);
  }

  // 2. Real upload test
  console.log("\n2. Upload test...");
  const res = await drive.files.create({
    requestBody: {
      name: `_verify_${Date.now()}.pdf`,
      parents: [folderId],
      mimeType: "application/pdf",
    },
    media: {
      mimeType: "application/pdf",
      body: Readable.from(Buffer.from("%PDF-1.4\n%%EOF\n")),
    },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });
  console.log("   uploaded:", res.data.id);
  console.log("   link:", res.data.webViewLink);

  // 3. Permission test
  await drive.permissions.create({
    fileId: res.data.id,
    requestBody: { role: "reader", type: "anyone" },
    supportsAllDrives: true,
  });
  console.log("   permissions applied");

  // 4. Cleanup
  await drive.files.delete({ fileId: res.data.id, supportsAllDrives: true });
  console.log("   test file deleted");

  console.log("\n✅ Shared drive works. Upload path is ready.");
} catch (err) {
  console.error("\n❌ Verification failed:", err.message);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
}
