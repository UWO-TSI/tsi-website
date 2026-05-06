"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { X } from "lucide-react";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectTo?: string;
}

export default function AuthModal({
  isOpen,
  onClose,
  redirectTo = "/student/apply/dashboard",
}: AuthModalProps) {
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const supabase = createClient();

  const handleGoogleAuth = async () => {
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirectTo)}`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/student/reset-password`,
      });
      if (error) {
        setError(error.message);
      } else {
        setSuccessMessage(
          `Recovery link sent to ${email}. Check your inbox to set a new password.`
        );
      }
      setLoading(false);
      return;
    }

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(redirectTo)}`,
        },
      });
      if (error) {
        setError(error.message);
      } else if (data.session) {
        onClose();
        window.location.href = redirectTo;
      } else {
        setSuccessMessage(
          `We sent a verification link to ${email}. Click it to finish signing up — you'll land right back on your application.`
        );
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
      } else {
        onClose();
        window.location.href = redirectTo;
      }
    }

    setLoading(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div
              className="w-full max-w-md p-8 md:p-10 relative rounded-2xl"
              style={{
                background: "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)",
                border: "1px solid rgba(255,255,255,0.10)",
                backdropFilter: "blur(24px)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-4 right-4 text-[#6B7280] hover:text-[#F1FFFF] transition"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <h2 className="text-2xl font-semibold text-[#F1FFFF] mb-2">
                {mode === "signin"
                  ? "Sign In"
                  : mode === "signup"
                    ? "Create Account"
                    : "Reset Password"}
              </h2>
              <p className="text-sm text-[#9CA3AF] mb-6">
                {mode === "signin"
                  ? "Sign in to submit your application."
                  : mode === "signup"
                    ? "Create an account to apply to Tethos."
                    : "Enter your email and we'll send a recovery link."}
              </p>

              {/* Google OAuth — hidden in forgot mode */}
              {mode !== "forgot" && (
              <button
                onClick={handleGoogleAuth}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-3 text-sm text-[#F1FFFF] font-medium transition mb-6 disabled:opacity-50"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Continue with Google
              </button>
              )}

              {/* Divider — hidden in forgot mode */}
              {mode !== "forgot" && (
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-[#6B7280] font-mono">or</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
              )}

              {/* Email form */}
              <form onSubmit={handleEmailAuth} className="space-y-4">
                {mode === "signup" && (
                  <div>
                    <label className="block text-xs text-[#9CA3AF] mb-1.5 font-mono">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-[#F1FFFF] placeholder-[#6B7280] focus:outline-none focus:border-[#1D9BF0] focus:shadow-[0_0_0_2px_rgba(29,155,240,0.3)] transition"
                      placeholder="Your full name"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-[#9CA3AF] mb-1.5 font-mono">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-[#F1FFFF] placeholder-[#6B7280] focus:outline-none focus:border-[#1D9BF0] focus:shadow-[0_0_0_2px_rgba(29,155,240,0.3)] transition"
                    placeholder="you@university.ca"
                  />
                </div>
                {mode !== "forgot" && (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs text-[#9CA3AF] font-mono">
                        Password
                      </label>
                      {mode === "signin" && (
                        <button
                          type="button"
                          onClick={() => {
                            setMode("forgot");
                            setError(null);
                            setSuccessMessage(null);
                          }}
                          className="text-xs text-[#1D9BF0] hover:underline font-mono"
                        >
                          Forgot password?
                        </button>
                      )}
                    </div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-[#F1FFFF] placeholder-[#6B7280] focus:outline-none focus:border-[#1D9BF0] focus:shadow-[0_0_0_2px_rgba(29,155,240,0.3)] transition"
                      placeholder="Min 6 characters"
                    />
                  </div>
                )}

                {error && (
                  <p className="text-sm text-[#EF4444]">{error}</p>
                )}
                {successMessage && (
                  <div className="rounded-xl bg-[#1D9BF0]/10 border border-[#1D9BF0]/30 px-4 py-3">
                    <p className="text-sm text-[#86EFAC] leading-relaxed">
                      {successMessage}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-[#1D9BF0] hover:bg-[#0e7dbf] text-[#F1FFFF] px-4 py-3 text-sm font-medium transition disabled:opacity-50"
                >
                  {loading
                    ? "Loading..."
                    : mode === "signin"
                      ? "Sign In"
                      : mode === "signup"
                        ? "Create Account"
                        : "Send Recovery Link"}
                </button>
              </form>

              {/* Toggle mode */}
              <p className="text-center text-sm text-[#6B7280] mt-6">
                {mode === "signin" ? (
                  <>
                    No account?{" "}
                    <button
                      onClick={() => {
                        setMode("signup");
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      className="text-[#1D9BF0] hover:underline"
                    >
                      Sign up
                    </button>
                  </>
                ) : mode === "signup" ? (
                  <>
                    Already have an account?{" "}
                    <button
                      onClick={() => {
                        setMode("signin");
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      className="text-[#1D9BF0] hover:underline"
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => {
                      setMode("signin");
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="text-[#1D9BF0] hover:underline"
                  >
                    ← Back to sign in
                  </button>
                )}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
