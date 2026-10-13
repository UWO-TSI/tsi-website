import { createBrowserClient } from "@supabase/ssr";
import { authCookieOptions } from "./cookie";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookieOptions: authCookieOptions(typeof window === "undefined" ? null : window.location.hostname) }
  );
}
