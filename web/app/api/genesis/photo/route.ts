import { NextResponse } from "next/server";
import { staffContext } from "@/lib/server/adminContext";
import { createAdminClient } from "@/lib/supabase/admin";
import { PHOTO_ID } from "@/lib/genesis/pass";

export const dynamic = "force-dynamic";

/**
 * The photobooth's upload (staff only, T1-T3): the id the booth laptop made and printed, and the colour photo. Safe to
 * retry: the same id overwrites its own file and keeps its row.
 */
export async function POST(request: Request) {
  const staff = await staffContext();
  if (staff instanceof NextResponse) return staff;
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  const file = form.get("photo");
  if (!PHOTO_ID.test(id) || !(file instanceof Blob) || !["image/jpeg", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: "Bad photo" }, { status: 400 });
  }
  const db = createAdminClient();
  const path = `${id}.${file.type === "image/webp" ? "webp" : "jpg"}`;
  const up = await db.storage.from("genesis-photos").upload(path, file, { contentType: file.type, upsert: true });
  if (up.error) return NextResponse.json({ error: "Upload failed" }, { status: 502 });
  const { error } = await db.from("genesis_photos").insert({ id, path, taken_by: staff.user.id });
  if (error && error.code !== "23505") return NextResponse.json({ error: "Save failed" }, { status: 500 });
  return NextResponse.json({ id, url: `https://genesis.tethos.ca/ph/${id}` });
}
