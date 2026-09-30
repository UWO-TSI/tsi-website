/**
 * Moderation audit log (20260929100100): who did what to which item, when.
 * Written after the action by the routes that act; read in the moderation queue.
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ModerationEntry {
  action: "remove" | "remove_mute" | "dismiss" | "mute" | "unmute" | "reset_name";
  item_kind: "letter" | "chat" | "name" | "member";
  item_id?: string;
  target_id: string | null;
  excerpt?: string | null;
}

/** False when the row didn't save (the action itself already happened). */
export async function logModeration(db: SupabaseClient, actorId: string, e: ModerationEntry): Promise<boolean> {
  const { error } = await db.from("moderation_log").insert({ actor_id: actorId, item_id: e.item_id ?? null, action: e.action, item_kind: e.item_kind, target_id: e.target_id, excerpt: e.excerpt?.slice(0, 120) ?? null });
  return !error;
}

export const unlogged = () => NextResponse.json({ ok: false, error: "Done, but the audit log didn't save it. Tell the other admins." }, { status: 500 });
