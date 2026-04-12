"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Unlock } from "lucide-react";
import Button from "@/components/ui/Button";

interface InternalGateProps {
  onUnlock: (code: string) => void;
  error?: string;
}

export default function InternalGate({ onUnlock, error }: InternalGateProps) {
  const [code, setCode] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim()) onUnlock(code.trim());
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-md mx-auto text-center"
    >
      <div className="glass-card p-8">
        <div className="w-16 h-16 rounded-full bg-[#FFD166]/10 border border-[#FFD166]/30 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-7 h-7 text-[#FFD166]" />
        </div>

        <h2 className="text-2xl font-semibold text-[#F1FFFF] mb-2">
          Internal Positions
        </h2>
        <p className="text-sm text-[#9CA3AF] mb-6">
          These positions are available to past Tethos members. Enter your
          access code to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter access code"
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-[#F1FFFF] placeholder-[#6B7280] focus:outline-none focus:border-[#FFD166] focus:shadow-[0_0_0_2px_rgba(255,209,102,0.2)] transition text-center font-mono tracking-wider"
          />

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="text-sm text-[#EF4444]"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          <Button variant="primary" onClick={() => handleSubmit}>
            <span className="flex items-center gap-2">
              <Unlock className="w-4 h-4" />
              Unlock Positions
            </span>
          </Button>
        </form>
      </div>
    </motion.div>
  );
}
