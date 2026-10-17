import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { memberContext } from "@/lib/server/memberContext";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { arrivalStatus, finishArrival, type ArrivalLedger } from "@/lib/game/arrival/arrivalService";
import { ledgerHas } from "@/lib/game/arrival/arrivalLedger";

/** The wallet's ledger as the arrival flag reads it (lib/game/arrival/arrivalService.ts). */
function ledger(db: SupabaseClient): ArrivalLedger {
  const wallet = supabaseEconomyStore(db);
  return {
    has: (m, key) => ledgerHas(db, m, key),
    credit: (m, currency, amount, source, ref, key) => wallet.credit(m, currency, amount, source, ref, key),
  };
}
const unavailable = () => NextResponse.json({ ok: false, error: "Not available yet.", code: "unavailable" }, { status: 503 });

// GET /api/world/arrival: has this account arrived (the opening plays once per account, specs/v1-drop.md §1), and are
// its tools taught by people (row 312: it arrived after the HQ onboarding shipped).
export async function GET() {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  try { return NextResponse.json({ ok: true, ...(await arrivalStatus(ledger(ctx.db), ctx.userId)) }); } catch { return unavailable(); }
}

// POST /api/world/arrival: arrived (the tour walked or skipped). Pays Bram's few coins once; the payment is the flag.
export async function POST() {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  try { return NextResponse.json({ ok: true, arrival: await finishArrival(ledger(ctx.db), ctx.userId) }); } catch { return unavailable(); }
}
