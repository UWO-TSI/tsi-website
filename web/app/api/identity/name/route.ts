import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseIdentityStore } from "@/lib/identity/supabaseStore";
import { jsonResult, withStore } from "@/lib/server/memberContext";
import { checkWorldName, setWorldName } from "@/lib/identity/service";

// GET /api/identity/name?check=<name>: filter + availability (case/spacing/look-alike insensitive).
export async function GET(request: Request) {
  const ctx = await withStore(supabaseIdentityStore);
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await checkWorldName(ctx.store, ctx.userId, new URL(request.url).searchParams.get("check") ?? ""), "name");
}

// POST /api/identity/name { name }: set or change the world name (first free, then once per 30 days).
export async function POST(request: Request) {
  const ctx = await withStore(supabaseIdentityStore);
  if (ctx instanceof NextResponse) return ctx;
  const parsed = z.object({ name: z.string().max(64) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid request" }, { status: 400 });
  return jsonResult(await setWorldName(ctx.store, ctx.userId, parsed.data.name, ctx.now), "name");
}
