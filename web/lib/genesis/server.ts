import { cookies, headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { PASS_COOKIE, passFromSecret, type Pass } from "./pass";
import { passHref } from "./paths";

/** The request's pass (or null), the database, and a link builder for this host. */
export async function passContext(): Promise<{ db: ReturnType<typeof createAdminClient>; pass: Pass | null; href: (p?: string) => string }> {
  const host = (await headers()).get("host");
  const db = createAdminClient();
  const pass = await passFromSecret(db, (await cookies()).get(PASS_COOKIE)?.value);
  return { db, pass, href: (p = "/") => passHref(host, p) };
}
