// Signed-URL broker for resume uploads and views.
// Lets the browser upload directly to Supabase Storage without any RLS
// policies on storage.objects (we couldn't run that DDL without DB access).
// Service role generates short-lived signed URLs scoped to {user_id}/...
// so users can only operate on their own folder.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { MAX_RESUME_SIZE_BYTES } from "@/lib/recruitment";

const VIEW_TTL_SECONDS = 60 * 60; // 1h fresh view URLs from the dashboard

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
    positionSlug?: string;
    replacePath?: string | null;
    path?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();

  // ── Upload mode: issue a signed upload URL ────────────────
  if (body.mode === "upload") {
    const slug = (body.positionSlug ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
    if (!slug) {
      return NextResponse.json(
        { error: "Missing or invalid positionSlug" },
        { status: 400 }
      );
    }

    // Best-effort delete of any prior upload before issuing a new path.
    // Path must live in the caller's own folder to avoid touching others.
    const replacePath = body.replacePath;
    if (
      replacePath &&
      typeof replacePath === "string" &&
      replacePath.startsWith(`${user.id}/`)
    ) {
      try {
        await admin.storage.from("resumes").remove([replacePath]);
      } catch {
        // non-blocking
      }
    }

    const path = `${user.id}/${slug}_${Date.now()}.pdf`;
    const { data, error } = await admin.storage
      .from("resumes")
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
      maxBytes: MAX_RESUME_SIZE_BYTES,
    });
  }

  // ── View mode: issue a fresh signed read URL ──────────────
  if (body.mode === "view") {
    const path = body.path;
    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }
    if (!path.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await admin.storage
      .from("resumes")
      .createSignedUrl(path, VIEW_TTL_SECONDS);

    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message ?? "Resume not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ signedUrl: data.signedUrl });
  }

  // ── Delete mode: best-effort remove ───────────────────────
  if (body.mode === "delete") {
    const path = body.path;
    if (!path || typeof path !== "string") {
      return NextResponse.json({ error: "Missing path" }, { status: 400 });
    }
    if (!path.startsWith(`${user.id}/`)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await admin.storage.from("resumes").remove([path]);
    if (error) {
      console.error("Storage remove error:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
}
