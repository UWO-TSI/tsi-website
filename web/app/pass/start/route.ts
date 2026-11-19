import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { arrive, createPass, PASS_COOKIE, PASS_COOKIE_OPTIONS, passFromSecret } from "@/lib/genesis/pass";
import { passHref } from "@/lib/genesis/paths";

export const dynamic = "force-dynamic";

/** The front desk sticker (genesis.tethos.ca/start): make the pass if there isn't one, count the arrival, then setup or home. */
export async function GET(request: Request) {
  const host = request.headers.get("host");
  const db = createAdminClient();
  const secretIn = request.headers.get("cookie")?.match(new RegExp(`${PASS_COOKIE}=([^;]+)`))?.[1];
  let pass = await passFromSecret(db, secretIn);
  let secret: string | null = null;
  if (!pass) { const made = await createPass(db); if (made) { pass = made.pass; secret = made.secret; } }
  if (pass) await arrive(db, pass.id);
  const res = NextResponse.redirect(new URL(passHref(host, pass?.name ? "/?welcome=1" : "/setup"), request.url));
  if (secret) res.cookies.set(PASS_COOKIE, secret, PASS_COOKIE_OPTIONS);
  return res;
}
