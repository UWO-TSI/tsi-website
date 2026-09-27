import { NextResponse } from "next/server";
import { adminContext } from "@/lib/server/adminContext";
import { CONTENT_TABLES, DRAFT_VALIDATORS } from "@/lib/content/drafts";

// POST — create a new draft. T1/T2 only (row 215: T3 gets no draft access);
// each table's validator runs before anything is stored.
export async function POST(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;

  const { table_name, row_id, draft_data } = ((await request.json().catch(() => null)) ?? {}) as {
    table_name?: string;
    row_id?: string | null;
    draft_data?: unknown;
  };

  if (!table_name || !CONTENT_TABLES.has(table_name)) {
    return NextResponse.json({ ok: false, error: "Invalid table_name" }, { status: 400 });
  }
  if (!draft_data || typeof draft_data !== "object" || Array.isArray(draft_data)) {
    return NextResponse.json({ ok: false, error: "Missing draft_data" }, { status: 400 });
  }
  if (row_id != null && (typeof row_id !== "string" || row_id.length > 64)) {
    return NextResponse.json({ ok: false, error: "Invalid row_id" }, { status: 400 });
  }

  const problems = DRAFT_VALIDATORS[table_name]?.(draft_data as Record<string, unknown>) ?? [];
  if (problems.length > 0) {
    return NextResponse.json({ ok: false, error: `Invalid draft: ${problems.join("; ")}` }, { status: 400 });
  }

  const { data, error } = await ctx.db
    .from("content_drafts")
    .insert({ table_name, row_id: row_id ?? null, draft_data, author: ctx.userId, status: "draft" })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, draft: data }, { status: 201 });
}

// GET — list drafts (T1/T2).
export async function GET(request: Request) {
  const ctx = await adminContext();
  if (ctx instanceof NextResponse) return ctx;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const tableName = searchParams.get("table_name");

  let query = ctx.db.from("content_drafts").select("*").order("created_at", { ascending: false });
  if (status && ["draft", "published", "discarded"].includes(status)) query = query.eq("status", status);
  if (tableName && CONTENT_TABLES.has(tableName)) query = query.eq("table_name", tableName);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, drafts: data ?? [] });
}
