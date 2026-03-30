import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { DirectoryMember } from "@/lib/supabase/types";

const DIRECTORY_FIELDS =
  "id, display_name, avatar_url, tier, position, class, level, xp, skills, is_active";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get caller's tier for visibility rules
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  if (!callerProfile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
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

  // T1/T2 see everyone; T3+ see only active members
  if (callerProfile.tier > 2) {
    query = query.eq("is_active", true);
  }

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
