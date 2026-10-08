import { createAdminClient } from "@/lib/supabase/admin";

export type Progress = "new" | "started" | "done";
export const EVENTS = ["open", "start", "finish", "reveal"] as const;
export type ProgressEvent = (typeof EVENTS)[number];

// The token's payload half is stable per invite, so it doubles as the row id.
export const progressId = (token: string) => token.split(".")[0];

export async function readProgress(token: string): Promise<Progress> {
  try {
    const { data } = await createAdminClient()
      .from("finalround_progress")
      .select("started_at, revealed_at")
      .eq("id", progressId(token))
      .maybeSingle();
    if (data?.revealed_at) return "done";
    if (data?.started_at) return "started";
  } catch {}
  return "new";
}
