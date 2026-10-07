// The world's database reads and writes through the secret key (specs/multiplayer.md M2):
// the chat log batch (realtime_log_chat), a joining player's blocks (world_blocks, both
// directions) and the sanctions poll (realtime_sanctions_poll). All three are service-only.
// Without Supabase (local development) they do nothing: no log, no blocks, no sanctions.
import { createClient } from "@supabase/supabase-js";
import type { WorldSources } from "./world";

/** Supabase answers that mean the database or its schema isn't there, worth a short code in the log. */
const fail = (what: string, error: { code?: string } | null) => new Error(`${what} ${error?.code ?? "error"}`);

export function supabaseWorldSources(url: string, secretKey: string): WorldSources {
  const db = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return {
    async writeChat(rows, signal) {
      const { error } = await db.rpc("realtime_log_chat", { p_rows: rows }).abortSignal(signal);
      if (error) throw fail("realtime_log_chat", error);
    },
    async loadBlocks(uid, signal) {
      // uid is a verified token's sub (a UUID), safe inside the filter.
      const { data, error } = await db
        .from("world_blocks")
        .select("blocker_id, blocked_id")
        .or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`)
        .limit(5000)
        .abortSignal(signal);
      if (error) throw fail("world_blocks", error);
      const rows = (data ?? []) as { blocker_id: string; blocked_id: string }[];
      return {
        blocks: rows.filter((r) => r.blocker_id === uid).map((r) => r.blocked_id),
        blockedBy: rows.filter((r) => r.blocked_id === uid).map((r) => r.blocker_id),
      };
    },
    async pollSanctions(uids, signal) {
      const { data, error } = await db.rpc("realtime_sanctions_poll", { p_members: uids }).abortSignal(signal);
      if (error) throw fail("realtime_sanctions_poll", error);
      return (data ?? []) as { member_id: string; muted_until: string | null; removed_until: string | null }[];
    },
  };
}

/** Local development without Supabase. */
export const offlineWorldSources: WorldSources = {
  writeChat: async () => {},
  loadBlocks: async () => ({ blocks: [], blockedBy: [] }),
  pollSanctions: async () => [],
};
