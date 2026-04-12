import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminEmail } from "@/lib/supabase/admin";
import { syncApplicationToSheet } from "@/lib/google-sheets";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data: applications, error } = await admin
    .from("applications")
    .select("*, position:positions(*)")
    .order("submitted_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let synced = 0;
  for (const app of applications ?? []) {
    try {
      await syncApplicationToSheet(app, app.position);
      synced++;
    } catch (err) {
      console.error(`Sync failed for ${app.id}:`, err);
    }
  }

  return NextResponse.json({ synced, total: applications?.length ?? 0 });
}
