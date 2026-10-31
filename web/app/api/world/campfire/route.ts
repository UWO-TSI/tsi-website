import { NextResponse } from "next/server";
import { memberContext } from "@/lib/server/memberContext";
import { isCampfireHour } from "@/lib/game/campfire";
import { torontoHour } from "@/lib/game/islandTime";
import { torontoDay } from "@/lib/wallet/rules";
import { SETTINGS } from "@/lib/wallet/catalogue";

// POST /api/world/campfire: campfire hour's bonus for sitting by the fire (s-campfire). Only in the hour, once a
// Toronto day (the ledger key); campfire_coins in economy_settings.
export async function POST() {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  if (!isCampfireHour(torontoHour(ctx.now))) return NextResponse.json({ ok: false, error: "The campfire hour is 8 to 9 in the evening.", code: "closed" }, { status: 409 });
  const day = torontoDay(ctx.now);
  const { data: setting } = await ctx.db.from("economy_settings").select("value").eq("key", "campfire_coins").maybeSingle();
  const coins = Number(setting?.value ?? SETTINGS.campfire_coins);
  const { data, error } = await ctx.db.rpc("wallet_apply", { p_member_id: ctx.userId, p_currency: "coins", p_amount: coins, p_source: "campfire", p_ref: day, p_idempotency_key: `campfire:${day}` });
  if (error) return NextResponse.json({ ok: false, error: "Not available yet.", code: "unavailable" }, { status: 503 });
  const r = (Array.isArray(data) ? data[0] : data) as { balance: number; replayed: boolean };
  return NextResponse.json({ ok: true, campfire: { coins, paid: !r.replayed, balance: r.balance } });
}
