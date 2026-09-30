import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminContext } from "@/lib/server/adminContext";
import type { DirectoryMember } from "@/lib/supabase/types";

const DIRECTORY_FIELDS =
  "id, display_name, avatar_url, tier, position, class, level, xp, skills, is_active";

export async function GET(request: NextRequest) {
  // T1/T2 see everyone; T3+ see only active members. The gate answers both (401 signed out).
  const gate = await adminContext();
  if (gate instanceof NextResponse && gate.status !== 403) return gate;
  const staff = !(gate instanceof NextResponse);

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json(
      { error: "Service unavailable — database not configured", members: [] },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role");
  const year = searchParams.get("year");
  const active = searchParams.get("active");
  const search = searchParams.get("search");

  let query = supabase
    .from("profiles")
    .select(DIRECTORY_FIELDS)
    .order("level", { ascending: false });

  if (!staff) query = query.eq("is_active", true);

  if (role) {
    query = query.eq("position", role);
  }

  if (year) {
    query = query.eq("year", year);
  }

  if (active === "true") {
    query = query.eq("is_active", true);
  } else if (active === "false") {
    query = query.eq("is_active", false);
  }

  if (search) {
    query = query.ilike("display_name", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ members: data as DirectoryMember[] });
}
