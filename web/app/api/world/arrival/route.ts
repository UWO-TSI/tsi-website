import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { memberContext } from "@/lib/server/memberContext";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { finishArrival, hasArrived, type ArrivalLedger } from "@/lib/game/arrival/arrivalService";

/** The wallet's ledger as the arrival flag reads it (lib/game/arrival/arrivalService.ts). */
function ledger(db: SupabaseClient): ArrivalLedger {
  const wallet = supabaseEconomyStore(db);
  return {
    async has(m, key) {
      const { data, error } = await db.from("wallet_ledger").select("id").eq("member_id", m).eq("idempotency_key", key).limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
    credit: (m, currency, amount, source, ref, key) => wallet.credit(m, currency, amount, source, ref, key),
  };
}
const unavailable = () => NextResponse.json({ ok: false, error: "Not available yet.", code: "unavailable" }, { status: 503 });

// GET /api/world/arrival: has this account arrived (the opening plays once per account, specs/v1-drop.md §1).
export async function GET() {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  try { return NextResponse.json({ ok: true, arrived: await hasArrived(ledger(ctx.db), ctx.userId) }); } catch { return unavailable(); }
}

// POST /api/world/arrival: arrived (the tour walked or skipped). Pays Bram's few coins once; the payment is the flag.
export async function POST() {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  try { return NextResponse.json({ ok: true, arrival: await finishArrival(ledger(ctx.db), ctx.userId) }); } catch { return unavailable(); }
}
