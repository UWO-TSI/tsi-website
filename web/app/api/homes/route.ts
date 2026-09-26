import { NextResponse } from "next/server";
import { homesContext } from "@/lib/homes-sync/deps";
import { loadHome } from "@/lib/homes-sync/service";
import { jsonResult } from "@/lib/server/memberContext";

// GET /api/homes: the caller's home (layout doc v1, rooms, revision, mailbox, room price/cap).
export async function GET() {
  const ctx = await homesContext();
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await loadHome(ctx.store, ctx.userId), "home");
}
