import { cookies, headers } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { createPass, PASS_COOKIE, PASS_COOKIE_OPTIONS, passFromSecret, passOfUser, savePass, type Pass } from "./pass";
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

/**
 * For the tap routes (front desk, booth sticker, photo QR): the request's pass, made on the spot when the phone has none
 * and nobody is signed in. `secret` is set only for a new pass, for the caller to put in the cookie on its redirect.
 */
export async function passForTap(): Promise<{ db: ReturnType<typeof createAdminClient>; pass: Pass | null; secret: string | null; href: (p?: string) => string }> {
  const ctx = await passContext();
  if (ctx.pass) return { ...ctx, secret: null };
  const made = await createPass(ctx.db);
  return { ...ctx, pass: made?.pass ?? null, secret: made?.secret ?? null };
}

/** A redirect from a tap route, carrying a new pass's cookie. */
export function tapRedirect(request: Request, path: string, secret: string | null) {
  const res = NextResponse.redirect(new URL(path, request.url));
  if (secret) res.cookies.set(PASS_COOKIE, secret, PASS_COOKIE_OPTIONS);
  return res;
}
