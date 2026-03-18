"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [bootComplete, setBootComplete] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const lines = [
      "TETHOS RECRUITMENT TERMINAL v3.2.1",
      "Scanning for new agents...",
      "Clearance level: PENDING",
      "",
      ">> NEW AGENT REGISTRATION",
    ];

    let i = 0;
    const interval = setInterval(() => {
      if (i < lines.length) {
        const line = lines[i];
        i++;
        setBootLines((prev) => [...prev, line]);
      } else {
        clearInterval(interval);
        setBootComplete(true);
      }
    }, 120);

    return () => clearInterval(interval);
  }, []);

  async function handleSignup(e: React.FormEvent) {
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

    // Validate invite code if provided
    if (inviteCode) {
      const { data: code } = await supabase
        .from("invite_codes")
        .select("id, is_active")
        .eq("code", inviteCode.toUpperCase().trim())
        .eq("is_active", true)
        .single();

      if (!code) {
        setError("Invalid or expired invite code.");
        setLoading(false);
        return;
      }
    }

    // Create account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: displayName,
          invite_code: inviteCode || null,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // Profile is auto-created by database trigger on auth.users INSERT.
      // Increment invite code uses if used
      if (inviteCode) {
        await supabase.rpc("increment_invite_uses", {
          code_value: inviteCode.toUpperCase().trim(),
        });
      }

      router.push("/student/election");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Terminal Header */}
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6 mb-6 font-mono text-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--glass-border)]">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-2 text-[var(--color-text-muted)] text-xs">
              tethos://auth/register
            </span>
          </div>

          {bootLines.map((line, i) => (
            <div
              key={i}
              className={`${
                line.startsWith(">>")
                  ? "text-[var(--color-brand-yellow)]"
                  : "text-[var(--color-text-muted)]"
              } ${line === "" ? "h-3" : ""}`}
            >
              {line && (
                <span className="text-[var(--color-accent-cyan)] mr-2">
                  {line.startsWith(">>") ? "" : "$"}
                </span>
              )}
              {line}
            </div>
          ))}

          {bootComplete && (
            <div className="mt-1 text-[var(--color-text-muted)]">
              <span className="animate-pulse">█</span>
            </div>
          )}
        </div>

        {/* Signup Form */}
        <form
          onSubmit={handleSignup}
          className={`transition-opacity duration-500 ${
            bootComplete ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-[var(--color-text-muted)] mb-2 uppercase tracking-wider">
                Agent Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md px-4 py-3 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] focus:shadow-[0_0_12px_rgba(0,47,167,0.3)] transition-all"
                placeholder="Your display name"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-[var(--color-text-muted)] mb-2 uppercase tracking-wider">
                Agent Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md px-4 py-3 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] focus:shadow-[0_0_12px_rgba(0,47,167,0.3)] transition-all"
                placeholder="agent@email.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label className="block text-xs font-mono text-[var(--color-text-muted)] mb-2 uppercase tracking-wider">
                Passphrase
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

            <div>
              <label className="block text-xs font-mono text-[var(--color-text-muted)] mb-2 uppercase tracking-wider">
                Invite Code{" "}
                <span className="text-[var(--color-text-muted)]/60">
                  (optional)
                </span>
              </label>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                className="w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md px-4 py-3 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] focus:shadow-[0_0_12px_rgba(0,47,167,0.3)] transition-all uppercase"
                placeholder="TETHOS-XXXX"
                autoComplete="off"
              />
              <p className="text-[var(--color-text-muted)] text-xs font-mono mt-1">
                No code? Your account will require admin approval.
              </p>
            </div>

            {error && (
              <div className="font-mono text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-md px-3 py-2">
                <span className="text-red-500">err:</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/80 text-white font-mono text-sm py-3 rounded-md transition-all hover:shadow-[0_0_20px_rgba(0,47,167,0.4)] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              {loading ? (
                <span className="animate-pulse">Registering Agent...</span>
              ) : (
                "Request Access"
              )}
            </button>
          </div>
        </form>

        {/* Links */}
        <div
          className={`mt-6 text-center transition-opacity duration-500 ${
            bootComplete ? "opacity-100" : "opacity-0"
          }`}
        >
          <p className="text-[var(--color-text-muted)] text-sm font-mono">
            Already an agent?{" "}
            <Link
              href="/student/login"
              className="text-[var(--color-accent-cyan)] hover:text-[var(--color-brand-blue)] transition-colors"
            >
              Login
            </Link>
          </p>
          <Link
            href="/student"
            className="inline-block mt-3 text-[var(--color-text-muted)] text-xs font-mono hover:text-[var(--color-text-secondary)] transition-colors"
          >
            ← Back to Student Home
          </Link>
        </div>
      </div>
    </div>
  );
}
