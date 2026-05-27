// POST /api/content/upload
// Auth: T1/T2 only
// Body: multipart/form-data with field "file"
// Returns: { ok: true, url: string } | { ok: false, error: string }
//
// Lets admins drop a sprite/image into the content-assets bucket from the
// editor instead of pasting a third-party URL. Bucket is public; the returned
// `url` is the permanent public URL and goes straight into sprite_url.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "content-assets";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function slugify(name: string): string {
  const stripped = name.replace(/\.[a-zA-Z0-9]{1,8}$/, ""); // drop extension
  const sanitized = stripped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return sanitized || "asset";
}

export async function POST(request: Request) {
  // 1. Must be multipart
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  // 2. Auth + T1/T2 gate via the regular SSR client
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.tier !== 1 && profile.tier !== 2)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden — T1/T2 only" },
      { status: 403 },
    );
  }

  // 3. Parse the form
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Could not parse multipart body" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { ok: false, error: "No file provided" },
      { status: 400 },
    );
  }

  // 4. Validate type + size
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unsupported file type — use PNG, JPEG, WebP, or GIF",
      },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "File exceeds 5MB limit" },
      { status: 400 },
    );
  }

  // 5. Filename: {slug}-{timestamp}-{rand}.{ext}
  const slug = slugify(file.name || "asset");
  const ext = EXT_BY_MIME[file.type] ?? "bin";
  const rand = Math.random().toString(36).slice(2, 8);
  const filename = `${slug}-${Date.now()}-${rand}.${ext}`;

  // 6. Upload via service-role client (bypasses RLS — auth gate above is
  // what actually gates the operation)
  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(filename, buffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("content-assets upload error:", uploadError);
    return NextResponse.json(
      { ok: false, error: uploadError.message || "Upload failed" },
      { status: 500 },
    );
  }

  // 7. Public URL (bucket is public — URL is permanent + unsigned)
  const { data } = admin.storage.from(BUCKET).getPublicUrl(filename);
  if (!data?.publicUrl) {
    return NextResponse.json(
      { ok: false, error: "Upload succeeded but public URL is missing" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, url: data.publicUrl });
}
