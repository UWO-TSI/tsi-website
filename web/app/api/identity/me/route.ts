import { NextResponse } from "next/server";
import { identityContext } from "@/lib/identity/deps";
import { me } from "@/lib/identity/service";
import { jsonResult } from "@/lib/server/memberContext";

// GET /api/identity/me: world name, member badge, family, auras, settings.
export async function GET() {
  const ctx = await identityContext();
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await me(ctx.store, ctx.userId), "identity");
}
