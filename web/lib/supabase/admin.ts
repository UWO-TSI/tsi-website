import { createClient } from "@supabase/supabase-js";
import { fetchWithTimeout } from "./fetch-timeout";

/**
 * Service-role client for admin operations.
 * Bypasses RLS — use only in trusted server contexts.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { fetch: fetchWithTimeout } }
  );
}

// Baseline admin list — kept in code so admin access doesn't silently
// break if the env var is missing or misconfigured on Vercel. The env
// var is still honored and unioned with this list.
const BASELINE_ADMINS = [
  "davidliu8473@gmail.com",
  "dliu468@uwo.ca",
  "anguyen.hba2027@ivey.ca",
  "jhogan53@uwo.ca", // Jack Hogan, added by David 2026-09-12
  // Application-portal reviewers, added by David 2026-09-28. Both known
  // emails listed where a person has two accounts.
  "sierra.xwlin@gmail.com", // Sierra Lin
  "slin542@uwo.ca", // Sierra Lin
  "judygao07@gmail.com", // Judy Gao
  "jgao537@uwo.ca", // Judy Gao
  "danielrltan@gmail.com", // Daniel Tan
  "matthew.zhou07@gmail.com", // Matthew Zhou
  "mzhou446@uwo.ca", // Matthew Zhou
  "emmayclii@gmail.com", // Emma Li
];

/** Check if an email is in the admin whitelist */
export function isAdminEmail(email: string): boolean {
  const fromEnv = (process.env.ADMIN_EMAIL_WHITELIST ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const whitelist = new Set([...BASELINE_ADMINS, ...fromEnv]);
  return whitelist.has(email.toLowerCase());
}
