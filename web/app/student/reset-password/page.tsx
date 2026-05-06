"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const router = useRouter();

  // Recovery flow lands here after the auth callback exchanges the code.
  // We just verify there's a session — no token parsing needed.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setAuthed(!!data.user);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passphrases do not match.");
      return;
    }
    if (password.length < 6) {
      setError("Passphrase must be at least 6 characters.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setDone(true);
    setLoading(false);
    setTimeout(() => router.push("/student/apply"), 1500);
  }

  if (authed === false) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-main)] flex items-center justify-center px-4 pt-20">
        <div className="w-full max-w-md text-center">
          <pre className="font-mono text-[0.55rem] text-red-400 mb-4 leading-tight">
{`╔═══════════════════════════════╗
║   RECOVERY LINK INVALID       ║
║   OR EXPIRED                  ║
╚═══════════════════════════════╝`}
          </pre>
          <p className="font-mono text-sm text-[var(--color-text-muted)] mb-6">
            Request a new recovery link from the login screen.
          </p>
          <Link
            href="/student/login"
            className="inline-block bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/80 text-white font-mono text-sm py-3 px-8 rounded-md transition-all uppercase tracking-wider"
          >
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] flex items-center justify-center px-4 pt-20">
      <div className="w-full max-w-md">
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6 mb-6 font-mono text-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--glass-border)]">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-2 text-[var(--color-text-muted)] text-xs">
              tethos://auth/recovery
            </span>
          </div>
          <div className="text-[var(--color-text-muted)]">
            <span className="text-[var(--color-accent-cyan)] mr-2">$</span>
            Identity verified.
          </div>
          <div className="text-[var(--color-brand-yellow)] mt-1">
            {">>"} SET NEW PASSPHRASE
          </div>
        </div>

        {done ? (
          <div className="font-mono text-sm text-[var(--color-accent-cyan)] bg-[var(--color-accent-cyan)]/5 border border-[var(--color-accent-cyan)]/20 rounded-md px-4 py-3 text-center">
            Passphrase rotated. Routing to apply portal…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-[var(--color-text-muted)] mb-2 uppercase tracking-wider">
                New Passphrase
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md px-4 py-3 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] focus:shadow-[0_0_12px_rgba(0,47,167,0.3)] transition-all"
                placeholder="Min 6 characters"
                required
                autoComplete="new-password"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-[var(--color-text-muted)] mb-2 uppercase tracking-wider">
                Confirm Passphrase
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md px-4 py-3 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] focus:shadow-[0_0_12px_rgba(0,47,167,0.3)] transition-all"
                placeholder="Repeat passphrase"
                required
                autoComplete="new-password"
              />
            </div>

            {error && (
              <div className="font-mono text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-md px-3 py-2">
                <span className="text-red-500">err:</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || authed === null}
              className="w-full bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/80 text-white font-mono text-sm py-3 rounded-md transition-all hover:shadow-[0_0_20px_rgba(0,47,167,0.4)] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              {loading ? (
                <span className="animate-pulse">Updating...</span>
              ) : (
                "Set New Passphrase"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
