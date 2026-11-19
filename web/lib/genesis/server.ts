import { cookies, headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { PASS_COOKIE, passFromSecret, passOfUser, savePass, type Pass } from "./pass";
import { passHref } from "./paths";

/**
 * The request's pass, the database, and a link builder for this host. The pass is the one this phone holds, or else the
 * saved pass of the account signed in here. `user` is that account (null when nobody is signed in).
 */
export async function passContext(): Promise<{ db: ReturnType<typeof createAdminClient>; pass: Pass | null; user: User | null; href: (p?: string) => string }> {
  const host = (await headers()).get("host");
  const db = createAdminClient();
  const user = (await (await createClient()).auth.getUser()).data.user ?? null;
  const pass = (await passFromSecret(db, (await cookies()).get(PASS_COOKIE)?.value)) ?? (user ? await passOfUser(db, user.id) : null);
  return { db, pass, user, href: (p = "/") => passHref(host, p) };
}

/** After signing in here: save this phone's pass to the account, dropping the phone's copy when it was merged. */
export async function saveAfterSignIn(db: ReturnType<typeof createAdminClient>, user: User) {
  const jar = await cookies();
  const device = await passFromSecret(db, jar.get(PASS_COOKIE)?.value);
  const { merged } = await savePass(db, device, user.id);
  if (merged) jar.delete(PASS_COOKIE);
}
