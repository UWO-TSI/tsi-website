import { createClient } from "@supabase/supabase-js";
import { seasonCta, type SeasonCta } from "./season";

/**
 * The nav's call to action for the site pages. Reads public roles with the anon key and no cookies,
 * so the pages stay static and revalidate on a timer. Without a database answer in 3s it falls back
 * to the date rules alone.
 */
export async function loadSeasonCta(now = new Date()): Promise<SeasonCta> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return seasonCta(now, []);
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const query = supabase
      .from("positions")
      .select("is_active, archived_at, opens_at, closes_at")
      .eq("is_active", true)
      .eq("visibility", "public");
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
    const result = await Promise.race([query, timeout]);
    return seasonCta(now, result?.data ?? []);
  } catch {
    return seasonCta(now, []);
  }
}
