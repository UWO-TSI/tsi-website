// Signed-URL broker for resume + portfolio uploads and views.
// Lets the browser upload directly to Supabase Storage without any RLS
// policies on storage.objects (we couldn't run that DDL without DB access).
// Service role generates short-lived signed URLs scoped to {user_id}/...
// so users can only operate on their own folder.
//
// `bucket` defaults to "resumes" for backward compat; "portfolios" is
// used by the VP Marketing portfolio drop.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_RESUME_SIZE_BYTES } from "@/lib/recruitment";

const VIEW_TTL_SECONDS = 60 * 60;
const PORTFOLIO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

type BucketName = "resumes" | "portfolios";

function isAllowedBucket(b: unknown): b is BucketName {
  return b === "resumes" || b === "portfolios";
}

function extensionFor(filename: string): string {
  const m = filename.match(/\.([a-zA-Z0-9]{1,8})$/);
  return m ? m[1].toLowerCase() : "bin";
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    mode?: string;
    bucket?: string;
    positionSlug?: string;
    replacePath?: string | null;
    path?: string;
    filename?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const bucket: BucketName = isAllowedBucket(body.bucket)
    ? body.bucket
    : "resumes";
  const admin = createAdminClient();

  // ── Upload mode ──────────────────────────────────────────
  if (body.mode === "upload") {
    const slug = (body.positionSlug ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
    if (!slug) {
      return NextResponse.json(
        { error: "Missing or invalid positionSlug" },
        { status: 400 }
      );
    }

    const replacePath = body.replacePath;
    if (
      replacePath &&
      typeof replacePath === "string" &&
      replacePath.startsWith(`${user.id}/`)
    ) {
      try {
        await admin.storage.from(bucket).remove([replacePath]);
      } catch {
        // non-blocking
      }
    }

    // Resumes are PDF-only; portfolios accept whatever extension was
    // in the source filename (validated against the bucket's allowed
    // mime types at upload time).
    const ext =
      bucket === "resumes"
        ? "pdf"
        : extensionFor(body.filename ?? "submission");
    const path = `${user.id}/${slug}_${Date.now()}.${ext}`;
    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !data) {
      console.error("createSignedUploadUrl error:", error);
      return NextResponse.json(
        { error: error?.message ?? "Failed to create upload URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      path,
      token: data.token,
      signedUrl: data.signedUrl,
      maxBytes:
        bucket === "resumes" ? MAX_RESUME_SIZE_BYTES : PORTFOLIO_MAX_BYTES,
    });
  }

  // ── View mode ────────────────────────────────────────────
  if (body.mode === "view") {
    const path = body.path;
    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }
    if (!path.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await admin.storage
      .from(bucket)
      .createSignedUrl(path, VIEW_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message ?? "File not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ signedUrl: data.signedUrl });
  }

  // ── Delete mode ──────────────────────────────────────────
  if (body.mode === "delete") {
    const path = body.path;
    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }
    if (!path.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await admin.storage.from(bucket).remove([path]);
    if (error) {
      console.error("Storage remove error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
}
