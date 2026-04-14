"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, ArrowRight } from "lucide-react";
import Link from "next/link";

const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

interface InternalGateProps {
  onUnlock: (code: string) => void;
  error?: string;
}

export default function InternalGate({ onUnlock, error }: InternalGateProps) {
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) onUnlock(code.trim());
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: EASE_OUT }}
        className="w-full max-w-md"
      >
        <div
          className="rounded-2xl p-8 md:p-10 text-center"
          style={{
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.5, ease: EASE_OUT }}
            className="w-14 h-14 rounded-full bg-[#FFD166]/10 border border-[#FFD166]/20 flex items-center justify-center mx-auto mb-6"
          >
            <Lock className="w-6 h-6 text-[#FFD166]" />
          </motion.div>

          <h2 className="text-xl font-semibold text-[#F1FFFF] mb-2">
            Internal Positions
          </h2>
          <p className="text-sm text-[#6B7280] mb-8 max-w-xs mx-auto">
            These roles are available to current and past Tethos members. Enter
            your access code to continue.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Code input */}
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="ACCESS CODE"
                className="w-full rounded-xl bg-white/5 px-5 py-4 text-center text-sm text-[#F1FFFF] placeholder-[#4B5563] font-mono tracking-[0.3em] transition-all duration-200 focus:outline-none"
                style={{
                  border: `1px solid ${
                    error
                      ? "rgba(239,68,68,0.5)"
                      : focused
                        ? "rgba(255,209,102,0.4)"
                        : "rgba(255,255,255,0.10)"
                  }`,
                  boxShadow: focused
                    ? "0 0 0 3px rgba(255,209,102,0.1)"
                    : error
                      ? "0 0 0 3px rgba(239,68,68,0.1)"
                      : "none",
                }}
              />
            </div>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -4, height: 0 }}
                  className="text-sm text-[#EF4444] font-mono"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Submit button */}
            <motion.button
              type="submit"
              disabled={!code.trim()}
              className="w-full group inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-[#FFD166] text-[#0F0F10] text-sm font-semibold transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#FFD980]"
              whileHover={code.trim() ? { scale: 1.02 } : {}}
              whileTap={code.trim() ? { scale: 0.98 } : {}}
            >
              Unlock Positions
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </motion.button>
          </form>
        </div>

        {/* Back link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-8"
        >
          <Link
            href="/student/apply"
            className="inline-flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#F1FFFF] transition-colors"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
            Back to public positions
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
