import { previewRecruitmentPositions } from "@/lib/recruitment-round";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Last good public list. During a database stall (2026-09-18) every
// applicant page waited on this route; serving the last copy keeps the
// landing, role pages and village readable while submissions still go
// through the real database. Per instance, refreshed on every success.
let lastPublic: { at: number; data: unknown[] } | null = null;
const FRESH_MS = 30_000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (process.env.NODE_ENV === "development" && searchParams.get("preview") === "1") {
    return NextResponse.json(previewRecruitmentPositions(), { headers: { "Cache-Control": "no-store" } });
  }
  const code = searchParams.get("code");
  if (!code && lastPublic && Date.now() - lastPublic.at < FRESH_MS) {
    return NextResponse.json(lastPublic.data, { headers: { "Cache-Control": "no-store", "x-positions": "cached" } });
  }

  // Without a code: anon RLS policy already hides internal rows, so the
  // regular client is fine and gives us a proper public view.
  // With a code: bypass RLS via service role so we can see internal rows
  // and then validate the code at the app layer below. RLS would otherwise
  // pre-filter internals out of unauthenticated requests, regardless of code.
  const supabase = code ? createAdminClient() : await createClient();

  let query = supabase
    .from("positions")
    .select("*")
    .eq("is_active", true)
    .order("phase", { ascending: true });

  if (!code) {
    query = query.eq("visibility", "public");
  }

  const { data, error } = await query.then(
    (r) => r,
    (e: unknown) => ({ data: null, error: { message: e instanceof Error ? e.message : "Database unavailable" } })
  );
  if (error) {
    if (!code && lastPublic) {
      return NextResponse.json(lastPublic.data, { headers: { "Cache-Control": "no-store", "x-positions": "stale" } });
    }
    return NextResponse.json({ error: error.message }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!code) lastPublic = { at: Date.now(), data: data ?? [] };

  // App-layer code validation. Accepts per-position access_code OR a
  // global INTERNAL_ACCESS_CODE env var.
  if (code && data) {
    const globalCode = process.env.INTERNAL_ACCESS_CODE;
    const globalMatches = !!globalCode && globalCode === code;
    const filtered = data.filter(
      (p) =>
        p.visibility === "public" ||
        p.access_code === code ||
        (p.visibility === "internal" && globalMatches)
    );
    return NextResponse.json(filtered);
  }

  return NextResponse.json(data ?? []);
}
