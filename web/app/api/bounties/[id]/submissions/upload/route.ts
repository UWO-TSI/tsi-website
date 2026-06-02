// POST /api/bounties/[id]/submissions/upload
// Auth: any authenticated member who holds an active bounty_claim on [id].
// Body: multipart/form-data with field "file"
// Returns: { ok: true, url: string } | { ok: false, error: string }
//
// Member-tier sibling to /api/content/upload (which is T1/T2-only for sprite
// assets). Used by the bounty submission modal to attach deliverables.
//
// Uploads to the "bounty-submissions" bucket (see migration 022).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "bounty-submissions";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

function slugify(name: string): string {
  const stripped = name.replace(/\.[a-zA-Z0-9]{1,8}$/, "");
  const sanitized = stripped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return sanitized || "deliverable";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // 1. Must be multipart
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json(
      { ok: false, error: "Expected multipart/form-data" },
      { status: 400 },
    );
  }

  // 2. Auth
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

  const { id: bountyId } = await params;

  // 3. Verify the caller has an active claim on this bounty.
  const { data: claim } = await supabase
    .from("bounty_claims")
    .select("id, status")
    .eq("bounty_id", bountyId)
    .eq("user_id", user.id)
    .single();

  if (!claim || claim.status !== "active") {
    return NextResponse.json(
      { ok: false, error: "You must have an active claim on this bounty to upload" },
      { status: 403 },
    );
  }

  // 4. Parse the form
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

  // 5. Validate type + size
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Unsupported file type — use PNG, JPEG, WebP, GIF, or PDF",
      },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "File exceeds 10MB limit" },
      { status: 400 },
    );
  }

  // 6. Path: bounty-{id}/{user}/{slug}-{ts}-{rand}.{ext}
  // Folder-per-bounty + per-user makes moderation + cleanup easier later.
  const slug = slugify(file.name || "deliverable");
  const ext = EXT_BY_MIME[file.type] ?? "bin";
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `bounty-${bountyId}/${user.id}/${slug}-${Date.now()}-${rand}.${ext}`;

  // 7. Upload via service-role client (bypasses RLS; auth + claim gate above).
  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("bounty-submissions upload error:", uploadError);
    return NextResponse.json(
      { ok: false, error: uploadError.message || "Upload failed" },
      { status: 500 },
    );
  }

  // 8. Public URL
  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    return NextResponse.json(
      { ok: false, error: "Upload succeeded but public URL is missing" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, url: data.publicUrl });
}
