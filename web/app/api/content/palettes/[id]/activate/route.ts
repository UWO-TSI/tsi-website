import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Atomic "Set Active" for seasonal_palettes.
//
// The table has a partial unique index `WHERE active = TRUE` so only one
// palette can be active at a time. Switching active palettes therefore
// requires deactivating the current one before activating the new one.
//
// NOTE: This implementation runs two sequential UPDATE statements via the
// service role. Between the two statements there is a brief window where
// no palette is active, and if two admins clicked simultaneously the second
// UPDATE could still hit the partial unique index. Admin tooling is
// low-concurrency, so this is acceptable for first cut. If contention
// becomes an issue, move this to a Postgres RPC function that wraps both
// UPDATEs in a single transaction.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  if (!profile || (profile.tier !== 1 && profile.tier !== 2)) {
    return NextResponse.json(
      { ok: false, error: "Forbidden — T1/T2 only" },
      { status: 403 },
    );
  }

  const { id: targetId } = await params;
  const admin = createAdminClient();

  // 1. Confirm target palette exists.
  const { data: target, error: targetError } = await admin
    .from("seasonal_palettes")
    .select("id, active")
    .eq("id", targetId)
    .single();

  if (targetError || !target) {
    return NextResponse.json(
      { ok: false, error: "Palette not found" },
      { status: 404 },
    );
  }

  if (target.active) {
    return NextResponse.json({ ok: true, already_active: true });
  }

  // 2. Deactivate whatever palette is currently active (if any).
  const { error: clearError } = await admin
    .from("seasonal_palettes")
    .update({ active: false })
    .eq("active", true);

  if (clearError) {
    return NextResponse.json(
      { ok: false, error: `Failed to clear active palette: ${clearError.message}` },
      { status: 500 },
    );
  }

  // 3. Activate the target.
  const { error: setError } = await admin
    .from("seasonal_palettes")
    .update({ active: true })
    .eq("id", targetId);

  if (setError) {
    return NextResponse.json(
      { ok: false, error: `Failed to set active: ${setError.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
