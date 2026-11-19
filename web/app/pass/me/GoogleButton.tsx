"use client";

import { createClient } from "@/lib/supabase/client";

/** Google sign-in, coming back to /auth on this host (/pass/auth off the GENESIS host). */
export default function GoogleButton({ back }: { back: string }) {
  return (
    <button type="button" className="gp-btn gp-btn--quiet" style={{ width: "100%" }}
      onClick={() => createClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin + back } })}>
      Continue with Google
    </button>
  );
}
