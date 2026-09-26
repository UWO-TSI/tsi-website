import { NextResponse } from "next/server";
import { economyContext } from "@/lib/wallet/deps";
import { adminReservations } from "@/lib/wallet/service";
import { jsonResult } from "@/lib/server/memberContext";

// GET /api/economy/admin/merch?status=reserved (T1/T2): pickups to hand over.
export async function GET(request: Request) {
  const ctx = await economyContext();
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.tier !== 1 && ctx.tier !== 2) return NextResponse.json({ ok: false, error: "Forbidden: T1/T2 only" }, { status: 403 });
  const s = new URL(request.url).searchParams.get("status");
  const status = s === "reserved" || s === "fulfilled" || s === "cancelled" ? s : undefined;
  return jsonResult(await adminReservations(ctx.store, status), "reservations");
}
