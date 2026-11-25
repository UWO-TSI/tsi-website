import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { passContext, saveAfterSignIn } from "@/lib/genesis/server";

/** Google sign-in comes back here: open the session, save the pass to the account, back to /me. */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  const { db, href } = await passContext();
  const base = `https://${request.headers.get("x-forwarded-host") ?? new URL(request.url).host}`;
  if (code) {
    const { data, error } = await (await createClient()).auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      await saveAfterSignIn(db, data.user);
      return NextResponse.redirect(base + href("/me?saved=1"));
    }
  }
  return NextResponse.redirect(base + href("/me?error=1"));
}
