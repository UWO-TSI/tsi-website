import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

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

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

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
