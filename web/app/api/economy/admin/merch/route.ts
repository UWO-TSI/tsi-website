import { NextResponse } from "next/server";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { adminReservations } from "@/lib/wallet/service";
import { jsonResult } from "@/lib/server/memberContext";
import { withAdminStore } from "@/lib/server/adminContext";

// GET /api/economy/admin/merch?status=reserved (T1/T2): pickups to hand over.
export async function GET(request: Request) {
  const ctx = await withAdminStore(supabaseEconomyStore);
  if (ctx instanceof NextResponse) return ctx;
  const s = new URL(request.url).searchParams.get("status");
  const status = s === "reserved" || s === "fulfilled" || s === "cancelled" ? s : undefined;
  return jsonResult(await adminReservations(ctx.store, status), "reservations");
}
