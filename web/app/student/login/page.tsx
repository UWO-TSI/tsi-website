"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import Link from "next/link";

const EASTER_EGG_PASSWORDS: Record<string, string> = {
  password: "Really? That's your hacker password?",
  admin: "Nice try. The council is watching.",
  "1234": "The mainframe rejects your entry.",
  letmein: "Access denied. Try being more creative.",
  qwerty: "Keyboard walk detected. Insufficient.",
  tethos: "Warm... but not quite.",
};

const ASCII_LOGO = `
 ████████╗███████╗████████╗██╗  ██╗ ██████╗ ███████╗
 ╚══██╔══╝██╔════╝╚══██╔══╝██║  ██║██╔═══██╗██╔════╝
    ██║   █████╗     ██║   ███████║██║   ██║███████╗
    ██║   ██╔══╝     ██║   ██╔══██║██║   ██║╚════██║
    ██║   ███████╗   ██║   ██║  ██║╚██████╔╝███████║
    ╚═╝   ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝
`;

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [easterEgg, setEasterEgg] = useState("");
  const [loading, setLoading] = useState(false);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const [bootComplete, setBootComplete] = useState(false);
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  // Terminal boot sequence
  useEffect(() => {
    const lines = [
      "TETHOS SYSTEM v3.2.1",
      "Initializing secure connection...",
      "Loading authentication module...",
      "Encryption: AES-256-GCM",
      "Status: READY",
      "",
      ">> AGENT LOGIN REQUIRED",
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

  // Easter egg password check
  useEffect(() => {
    const lower = password.toLowerCase();
    if (EASTER_EGG_PASSWORDS[lower]) {
      setEasterEgg(EASTER_EGG_PASSWORDS[lower]);
    } else {
      setEasterEgg("");
    }
  }, [password]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/student/election");
    router.refresh();
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const supabase = createClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo: `${window.location.origin}/student/auth/callback?next=/student/reset-password`,
      }
    );

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setResetSent(true);
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] flex items-center justify-center px-4 pt-20">
      <div className="w-full max-w-md">
        {/* ASCII Logo */}
        <pre className="text-[var(--color-brand-blue)] text-[0.35rem] sm:text-[0.45rem] leading-tight font-mono mb-8 text-center select-none overflow-hidden">
          {ASCII_LOGO}
        </pre>

        {/* Terminal Boot Sequence */}
        <div className="bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-lg p-6 mb-6 font-mono text-sm">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[var(--glass-border)]">
            <span className="w-3 h-3 rounded-full bg-red-500/80" />
            <span className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <span className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-2 text-[var(--color-text-muted)] text-xs">
              tethos://auth/login
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

        {/* Form */}
        <form
          ref={formRef}
          onSubmit={mode === "login" ? handleLogin : handleForgot}
          className={`transition-opacity duration-500 ${
            bootComplete ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-[var(--color-text-muted)] mb-2 uppercase tracking-wider">
                Agent Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md px-4 py-3 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] focus:shadow-[0_0_12px_rgba(0,47,167,0.3)] transition-all"
                placeholder="agent@tethos.org"
                required
                autoComplete="email"
              />
            </div>

            {mode === "login" && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-mono text-[var(--color-text-muted)] uppercase tracking-wider">
                    Passphrase
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError("");
                      setResetSent(false);
                    }}
                    className="text-xs font-mono text-[var(--color-accent-cyan)] hover:text-[var(--color-brand-blue)] transition-colors lowercase"
                  >
                    forgot?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[var(--color-bg-alt)] border border-[var(--glass-border)] rounded-md px-4 py-3 font-mono text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand-blue)] focus:shadow-[0_0_12px_rgba(0,47,167,0.3)] transition-all"
                  placeholder="••••••••"
                  required
                  autoComplete="current-password"
                />
              </div>
            )}

            {/* Easter egg message (login mode only) */}
            {mode === "login" && easterEgg && (
              <div className="font-mono text-xs text-[var(--color-brand-yellow)] bg-[var(--color-brand-yellow)]/5 border border-[var(--color-brand-yellow)]/20 rounded-md px-3 py-2">
                <span className="text-[var(--color-accent-cyan)]">sys:</span>{" "}
                {easterEgg}
              </div>
            )}

            {/* Reset-link confirmation */}
            {mode === "forgot" && resetSent && (
              <div className="font-mono text-xs text-[var(--color-accent-cyan)] bg-[var(--color-accent-cyan)]/5 border border-[var(--color-accent-cyan)]/20 rounded-md px-3 py-2">
                <span className="text-[var(--color-accent-cyan)]">sys:</span>{" "}
                Recovery link dispatched to {email}. Check your inbox.
              </div>
            )}

            {/* Error message */}
            {error && (
              <div className="font-mono text-xs text-red-400 bg-red-400/5 border border-red-400/20 rounded-md px-3 py-2">
                <span className="text-red-500">err:</span> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (mode === "forgot" && resetSent)}
              className="w-full bg-[var(--color-brand-blue)] hover:bg-[var(--color-brand-blue)]/80 text-white font-mono text-sm py-3 rounded-md transition-all hover:shadow-[0_0_20px_rgba(0,47,167,0.4)] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              {loading ? (
                <span className="animate-pulse">
                  {mode === "login" ? "Authenticating..." : "Dispatching..."}
                </span>
              ) : mode === "login" ? (
                "Initialize Session"
              ) : resetSent ? (
                "Link Sent"
              ) : (
                "Send Recovery Link"
              )}
            </button>

            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setResetSent(false);
                }}
                className="w-full text-xs font-mono text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                ← back to login
              </button>
            )}
          </div>
        </form>

        {/* Links */}
        <div
          className={`mt-6 text-center transition-opacity duration-500 ${
            bootComplete ? "opacity-100" : "opacity-0"
          }`}
        >
          <p className="text-[var(--color-text-muted)] text-sm font-mono">
            New agent?{" "}
            <Link
              href="/student/signup"
              className="text-[var(--color-accent-cyan)] hover:text-[var(--color-brand-blue)] transition-colors"
            >
              Request Access
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
