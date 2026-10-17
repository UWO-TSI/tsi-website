/**
 * Server side: the arrival flags as the wallet's ledger holds them (lib/game/arrival/arrivalService.ts), read with the
 * service-role client (app/api/world/arrival, the collections store's taught check, app/api/world/tools).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ARRIVAL_TAUGHT_KEY } from "./arrivalService";

/** Whether the member's wallet ledger holds an idempotency key. */
export async function ledgerHas(db: SupabaseClient, memberId: string, key: string): Promise<boolean> {
  const { data, error } = await db.from("wallet_ledger").select("id").eq("member_id", memberId).eq("idempotency_key", key).limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/** This member's tools are taught by people (row 312): they arrived under the row 312 key. */
export const ledgerToolsTaught = (db: SupabaseClient, memberId: string) => ledgerHas(db, memberId, ARRIVAL_TAUGHT_KEY);
