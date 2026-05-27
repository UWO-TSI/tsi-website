import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_TABLES = new Set(["npc_personas", "shop_items", "seasonal_palettes"]);

// POST — create a new draft
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const { table_name, row_id, draft_data } = (body ?? {}) as {
    table_name?: string;
    row_id?: string | null;
    draft_data?: unknown;
  };

  if (!table_name || !ALLOWED_TABLES.has(table_name)) {
    return NextResponse.json(
      { ok: false, error: "Invalid table_name" },
      { status: 400 },
    );
  }
  if (!draft_data || typeof draft_data !== "object") {
    return NextResponse.json(
      { ok: false, error: "Missing draft_data" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("content_drafts")
    .insert({
      table_name,
      row_id: row_id ?? null,
      draft_data,
      author: user.id,
      status: "draft",
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, draft: data }, { status: 201 });
}

// GET — list drafts. RLS restricts visibility (author or T1/T2 admin).
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const tableName = searchParams.get("table_name");

  let query = supabase
    .from("content_drafts")
    .select("*")
    .order("created_at", { ascending: false });

  if (status && ["draft", "published", "discarded"].includes(status)) {
    query = query.eq("status", status);
  }
  if (tableName && ALLOWED_TABLES.has(tableName)) {
    query = query.eq("table_name", tableName);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, drafts: data ?? [] });
}
