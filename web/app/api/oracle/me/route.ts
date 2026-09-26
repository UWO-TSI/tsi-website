import { NextResponse } from "next/server";
import { identityContext } from "@/lib/identity/deps";
import { oracleStatus } from "@/lib/oracle/service";
import { jsonResult } from "@/lib/server/memberContext";

// GET /api/oracle/me: current type/family, unlocked auras, open reading, and what the next reading costs (respec quote).
export async function GET() {
  const ctx = await identityContext();
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await oracleStatus(ctx.store, ctx.userId, ctx.now), "oracle");
}
