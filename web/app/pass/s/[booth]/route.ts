import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { boothBySlug } from "@/lib/genesis/booths";
import { createPass, PASS_COOKIE, PASS_COOKIE_OPTIONS, passFromSecret, stamp } from "@/lib/genesis/pass";
import { passHref } from "@/lib/genesis/paths";

export const dynamic = "force-dynamic";

/** A booth sticker (genesis.tethos.ca/s/<booth>): stamp it into the pass (made on the spot if needed), then open the project. */
export async function GET(request: Request, { params }: { params: Promise<{ booth: string }> }) {
  const host = request.headers.get("host");
  const booth = boothBySlug((await params).booth);
  if (!booth) return NextResponse.redirect(new URL(passHref(host, "/"), request.url));
  const db = createAdminClient();
  const secretIn = request.headers.get("cookie")?.match(new RegExp(`${PASS_COOKIE}=([^;]+)`))?.[1];
  let pass = await passFromSecret(db, secretIn);
  let secret: string | null = null;
  if (!pass) { const made = await createPass(db); if (made) { pass = made.pass; secret = made.secret; } }
  const result = pass ? await stamp(db, pass.id, booth.slug) : "error";
  const res = NextResponse.redirect(new URL(passHref(host, `/p/${booth.slug}${result === "stamped" ? "?stamped=1" : ""}`), request.url));
  if (secret) res.cookies.set(PASS_COOKIE, secret, PASS_COOKIE_OPTIONS);
  return res;
}
