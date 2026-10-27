import { NextResponse } from "next/server";
import { memberContext } from "@/lib/server/memberContext";
import { readProgress, writeProgress } from "@/lib/game/arrival/hq/accountProgress";

const unavailable = () => NextResponse.json({ ok: false, error: "Not available yet.", code: "unavailable" }, { status: 503 });

// GET /api/world/onboarding: where this account is in the HQ visit with Alice and the tool quests (t-hq), so another
// device or a reload picks up there. → { ok, progress: { hq: { beat, done } | null, tools } }
export async function GET() {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  try {
    const { data, error } = await ctx.db.from("profiles").select("preferences").eq("id", ctx.userId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ ok: true, progress: readProgress(data?.preferences) });
  } catch { return unavailable(); }
}

// POST /api/world/onboarding { hq?: { beat, done }, tools? }: progress made. Merged, the further along kept; it pays
// nothing (rewards stay on the ledger's keys). → { ok, progress }
export async function POST(request: Request) {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  const body = await request.json().catch(() => null);
  try {
    const { data, error } = await ctx.db.from("profiles").select("preferences").eq("id", ctx.userId).maybeSingle();
    if (error) throw error;
    const next = writeProgress(data?.preferences, body);
    if (!next) return NextResponse.json({ ok: false, error: "That isn't progress.", code: "invalid" }, { status: 400 });
    const { error: update } = await ctx.db.from("profiles").update({ preferences: next }).eq("id", ctx.userId);
    if (update) throw update;
    return NextResponse.json({ ok: true, progress: readProgress(next) });
  } catch { return unavailable(); }
}
