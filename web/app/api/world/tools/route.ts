import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { memberContext } from "@/lib/server/memberContext";
import { ledgerToolsTaught } from "@/lib/game/arrival/arrivalLedger";
import { giveTool, type ToolGrantStore } from "@/lib/game/arrival/hq/grant";

/** The tool grant on the service-role client: the arrival flag's ledger key, and one inventory row per tool. */
function grants(db: SupabaseClient): ToolGrantStore {
  return {
    taught: (m) => ledgerToolsTaught(db, m),
    async grant(m, slug) {
      // As the economy's own grants write it (20260926160000_crafting): the item's slot, one, nothing if it's there.
      const { data: item, error } = await db.from("shop_items").select("id, slot").eq("slug", slug).maybeSingle();
      if (error) throw error;
      if (!item) throw new Error(`no shop item ${slug}`);
      const { error: insert } = await db.from("member_inventory").upsert({ member_id: m, item_id: item.id, qty: 1, slot: item.slot }, { onConflict: "member_id,item_id", ignoreDuplicates: true });
      if (insert) throw insert;
    },
  };
}

// POST /api/world/tools { tool: "net" | "shovel" }: a resident handed you their tool (row 312, specs/hq-onboarding.md).
// → { ok, tool: { tool, key, granted } }. An account that arrived before row 312 already has the starter: granted false.
export async function POST(request: Request) {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  const body = await request.json().catch(() => null);
  try {
    const r = await giveTool(grants(ctx.db), ctx.userId, body);
    if (!r.ok) return NextResponse.json({ ok: false, error: r.error, code: r.code }, { status: r.status });
    return NextResponse.json({ ok: true, tool: r.data });
  } catch {
    return NextResponse.json({ ok: false, error: "Not available yet.", code: "unavailable" }, { status: 503 });
  }
}
