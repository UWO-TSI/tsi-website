// Creates / updates the private "portfolios" bucket used by the VP
// Marketing portfolio-drop submission. Larger size limit than resumes
// (50 MB) and broader mime types so people can drop short videos,
// design exports, PDFs, or zips. Anything bigger should be a link.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf8")
  .split("\n")
  .reduce((acc, line) => {
    const m = line.match(/^([^=]+)=(.*)$/);
    if (m) acc[m[1].trim()] = m[2].trim();
    return acc;
  }, {});

const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const BUCKET = "portfolios";
const SIZE_LIMIT = 50 * 1024 * 1024; // 50 MB
const MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
];

const { data: buckets } = await admin.storage.listBuckets();
const exists = buckets?.some((b) => b.id === BUCKET);

if (exists) {
  const { error } = await admin.storage.updateBucket(BUCKET, {
    public: false,
    fileSizeLimit: SIZE_LIMIT,
    allowedMimeTypes: MIME_TYPES,
  });
  if (error) {
    console.error("✗", error.message);
    process.exit(1);
  }
  console.log(`✓ Updated bucket "${BUCKET}"`);
} else {
  const { error } = await admin.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: SIZE_LIMIT,
    allowedMimeTypes: MIME_TYPES,
  });
  if (error) {
    console.error("✗", error.message);
    process.exit(1);
  }
  console.log(`✓ Created bucket "${BUCKET}"`);
}

const { data: verified } = await admin.storage.listBuckets();
const b = verified?.find((x) => x.id === BUCKET);
console.log({
  id: b?.id,
  public: b?.public,
  file_size_limit: b?.file_size_limit,
  allowed_mime_types: b?.allowed_mime_types,
});
