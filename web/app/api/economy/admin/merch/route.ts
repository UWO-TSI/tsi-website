import { NextResponse } from "next/server";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { adminReservations } from "@/lib/wallet/service";
import { isAdminTier, jsonResult, withStore } from "@/lib/server/memberContext";

// GET /api/economy/admin/merch?status=reserved (T1/T2): pickups to hand over.
export async function GET(request: Request) {
  const ctx = await withStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  if (!isAdminTier(ctx.tier)) return NextResponse.json({ ok: false, error: "Forbidden: T1/T2 only" }, { status: 403 });
  const s = new URL(request.url).searchParams.get("status");
  const status = s === "reserved" || s === "fulfilled" || s === "cancelled" ? s : undefined;
  return jsonResult(await adminReservations(ctx.store, status), "reservations");
}
