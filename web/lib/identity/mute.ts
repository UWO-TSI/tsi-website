/**
 * Row 221: a T1/T2 mute blocks member-written text (letters/notes, table
 * chat) until it expires. Read in the routes that accept member text.
 * Returns null when not muted or when 034 isn't applied yet.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function mutedUntil(db: SupabaseClient, memberId: string, now: Date): Promise<string | null> {
  const { data, error } = await db.from("member_identity").select("muted_until").eq("member_id", memberId).maybeSingle();
  if (error || !data) return null;
  const until = (data as { muted_until: string | null }).muted_until;
  return until && Date.parse(until) > now.getTime() ? until : null;
}

export function mutedResponseBody(until: string) {
  return { ok: false, code: "muted", error: `You can't post until ${new Date(until).toLocaleDateString("en-CA")}.` };
}
