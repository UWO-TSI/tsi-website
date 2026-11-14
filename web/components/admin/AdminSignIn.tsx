"use client";

import { useState } from "react";
import AuthModal from "@/components/recruit/AuthModal";
import { createClient } from "@/lib/supabase/client";

/** Signs the current account out and reloads, so the gate asks again. */
export function SignOutButton({ className }: { className?: string }) {
  return (
    <button type="button" className={className}
      onClick={async () => { await createClient().auth.signOut(); window.location.reload(); }}>
      Sign out
    </button>
  );
}

/** The club admin gate's screens: signed out (sign in, then come back to `path`), or signed in with an email not on the list. */
export default function AdminSignIn({ path, deniedEmail }: { path: string; deniedEmail?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <p className={`font-mono text-[10px] tracking-[0.2em] uppercase mb-3 ${deniedEmail ? "text-[#EF4444]" : "text-[#1D9BF0]"}`}>
          {deniedEmail ? "Not an admin" : "Tethos admin"}
        </p>
        <p className="text-[#F1FFFF] text-lg font-semibold mb-2">
          {deniedEmail ? `Signed in as ${deniedEmail}` : "Sign in to the club admin"}
        </p>
        <p className="text-sm text-[#9CA3AF] mb-6">
          {deniedEmail ? "This account isn't on the admin list. Sign out and sign back in with the email that is." : "Use the email that is on the admin list."}
        </p>
        {deniedEmail
          ? <SignOutButton className="rounded-full bg-white/5 border border-white/10 text-[#F1FFFF] hover:bg-white/10 px-6 py-2.5 text-sm font-medium transition" />
          : <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-[#1D9BF0] hover:bg-[#1a8cd8] text-white px-6 py-2.5 text-sm font-medium transition">Sign in</button>}
      </div>
      <AuthModal isOpen={open} onClose={() => setOpen(false)} redirectTo={path} />
    </main>
  );
}
