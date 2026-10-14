import { NextResponse } from "next/server";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { supabaseTraditionsStore } from "@/lib/traditions/supabaseStore";
import { knock, tonight } from "@/lib/traditions/service";

// GET /api/traditions/treat: tonight's trick-or-treat for the caller (on, the night, who has answered).
export async function GET() {
  const ctx = await withStore(supabaseTraditionsStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await tonight(ctx.store, ctx.userId, ctx.now), "tonight");
}

// POST /api/traditions/treat { resident }: knock at their door; the treat (into the bag) and their line, once a night.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseTraditionsStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await knock(ctx.store, ctx.userId, await request.json().catch(() => null), ctx.now), "treat");
}
