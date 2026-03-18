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
  const [emailSent, setEmailSent] = useState(false);
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

    if (!authData.user) {
      // Supabase returns null user (no error) if email already exists
      setError("An account with this email may already exist. Try logging in.");
      setLoading(false);
      return;
    }

    // Increment invite code uses if used
    if (inviteCode) {
      await supabase.rpc("increment_invite_uses", {
        code_value: inviteCode.toUpperCase().trim(),
      });
    }

    // If email confirmation is required, show confirmation message
    if (!authData.session) {
      setEmailSent(true);
      setLoading(false);
      return;
    }

    router.push("/student/election");
    router.refresh();
  }

  if (emailSent) {
    return (
      <div className="min-h-screen bg-[var(--color-bg-main)] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6"
            style={{
              background: "rgba(34, 211, 238, 0.1)",
              border: "1px solid rgba(34, 211, 238, 0.3)",
              boxShadow: "0 0 40px rgba(34, 211, 238, 0.15)",
            }}
          >
            <span className="text-2xl text-[var(--color-accent-cyan)]">✉</span>
          </div>
          <pre className="font-mono text-[0.55rem] text-[var(--color-accent-cyan)] mb-4 leading-tight">
{`╔═══════════════════════════════╗
║   VERIFICATION REQUIRED       ║
║   CHECK YOUR EMAIL INBOX      ║
╚═══════════════════════════════╝`}
          </pre>
          <p className="font-mono text-sm text-[var(--color-text-primary)] mb-2">
            Confirmation link sent to
          </p>
          <p className="font-mono text-sm text-[var(--color-accent-cyan)] mb-4">
            {email}
          </p>
          <p className="font-mono text-xs text-[var(--color-text-muted)] mb-6">
            Click the link in your email to activate your account, then return here to log in.
          </p>
          <Link
            href="/student/login"
            className="inline-block bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/80 text-white font-mono text-sm py-3 px-8 rounded-md transition-all hover:shadow-[0_0_20px_rgba(0,47,167,0.4)] uppercase tracking-wider"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
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
