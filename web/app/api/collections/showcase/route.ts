import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseCollectionsStore } from "@/lib/collections/supabaseStore";
import { getShowcase, setShowcase } from "@/lib/collections/service";
import { jsonResult, withStore } from "@/lib/server/memberContext";

// GET /api/collections/showcase[?member=<uuid>]: a member's show-off (the one slot on their ID: a fish, sea creature or bug).
export async function GET(request: Request) {
  const ctx = await withStore(supabaseCollectionsStore);
  if (ctx instanceof NextResponse) return ctx;
  const member = new URL(request.url).searchParams.get("member");
  if (member && !z.string().uuid().safeParse(member).success) return NextResponse.json({ ok: false, error: "Invalid member" }, { status: 400 });
  return jsonResult(await getShowcase(ctx.store, member ?? ctx.userId), "showcase");
}

// PUT /api/collections/showcase { items: [key|null] } (only a fish, sea creature or bug you've found).
export async function PUT(request: Request) {
  const ctx = await withStore(supabaseCollectionsStore);
  if (ctx instanceof NextResponse) return ctx;
  const body = (await request.json().catch(() => null)) as { items?: unknown } | null;
  return jsonResult(await setShowcase(ctx.store, ctx.userId, body?.items), "showcase");
}
