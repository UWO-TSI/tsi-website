import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  const supabase = await createClient();

  let query = supabase
    .from("positions")
    .select("*")
    .eq("is_active", true)
    .order("phase", { ascending: true });

  // If no access code, only return public positions
  if (!code) {
    query = query.eq("visibility", "public");
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // If code provided, validate it for internal positions.
  // Accepts per-position access_code OR a global INTERNAL_ACCESS_CODE env var
  // (so the DB doesn't need per-row codes to unlock all internal roles).
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
