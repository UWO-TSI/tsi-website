import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for admin operations.
 * Bypasses RLS — use only in trusted server contexts.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/** Check if an email is in the admin whitelist */
export function isAdminEmail(email: string): boolean {
  const whitelist = (process.env.ADMIN_EMAIL_WHITELIST ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return whitelist.includes(email.toLowerCase());
}
