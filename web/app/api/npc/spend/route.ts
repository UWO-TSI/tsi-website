import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/npc/spend
// T1-only. Aggregates this calendar month's npc_conversations into token
// totals + estimated cost + top users / NPCs. Computed in-memory because
// total rows per month is bounded (~22.5k at peak), and SWR caches client-side.

interface TopUser {
  user_id: string;
  name: string;
  interactions: number;
}
interface TopNPC {
  npc_id: string;
  name: string;
  interactions: number;
}

interface SpendResponse {
  month: string;
  tokens_in: number;
  tokens_out: number;
  estimated_cost_usd: number;
  top_users: TopUser[];
  top_npcs: TopNPC[];
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .maybeSingle();
  const tier = (profile?.tier as number | undefined) ?? 5;
  if (tier !== 1) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const monthLabel = `${monthStart.getUTCFullYear()}-${String(
    monthStart.getUTCMonth() + 1,
  ).padStart(2, "0")}`;

  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("npc_conversations")
    .select("npc_id, user_id, tokens_in, tokens_out")
    .gte("created_at", monthStart.toISOString());
  if (error) {
    return NextResponse.json({ error: "Failed to load spend" }, { status: 500 });
  }

  let tokensIn = 0;
  let tokensOut = 0;
  const userCounts = new Map<string, number>();
  const npcCounts = new Map<string, number>();
  for (const r of rows ?? []) {
    tokensIn += (r.tokens_in as number | null) ?? 0;
    tokensOut += (r.tokens_out as number | null) ?? 0;
    const uid = r.user_id as string | null;
    if (uid) userCounts.set(uid, (userCounts.get(uid) ?? 0) + 1);
    const nid = r.npc_id as string | null;
    if (nid) npcCounts.set(nid, (npcCounts.get(nid) ?? 0) + 1);
  }

  const topUserEntries = [...userCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const topNPCEntries = [...npcCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const userIds = topUserEntries.map(([id]) => id);
  const npcIds = topNPCEntries.map(([id]) => id);

  const [{ data: profiles }, { data: npcs }] = await Promise.all([
    userIds.length
      ? admin.from("profiles").select("id, display_name").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
    npcIds.length
      ? admin.from("npc_personas").select("id, display_name").in("id", npcIds)
      : Promise.resolve({ data: [] as { id: string; display_name: string | null }[] }),
  ]);

  const nameOfUser = new Map(
    (profiles ?? []).map((p) => [
      (p as { id: string }).id,
      ((p as { display_name: string | null }).display_name) ?? "unknown",
    ]),
  );
  const nameOfNPC = new Map(
    (npcs ?? []).map((n) => [
      (n as { id: string }).id,
      ((n as { display_name: string | null }).display_name) ?? "unknown",
    ]),
  );

  const top_users: TopUser[] = topUserEntries.map(([id, count]) => ({
    user_id: id,
    name: nameOfUser.get(id) ?? "unknown",
    interactions: count,
  }));
  const top_npcs: TopNPC[] = topNPCEntries.map(([id, count]) => ({
    npc_id: id,
    name: nameOfNPC.get(id) ?? "unknown",
    interactions: count,
  }));

  // Claude Haiku rates: $0.25/M input, $1.25/M output.
  const estimated_cost_usd =
    (tokensIn * 0.25 + tokensOut * 1.25) / 1_000_000;

  const response: SpendResponse = {
    month: monthLabel,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    estimated_cost_usd: Math.round(estimated_cost_usd * 10000) / 10000,
    top_users,
    top_npcs,
  };
  return NextResponse.json(response);
}
