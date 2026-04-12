"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, AlertTriangle, X } from "lucide-react";
import Button from "@/components/ui/Button";

interface ReleaseControlsProps {
  pendingCount: number;
  positions: { id: string; title: string; pendingCount: number }[];
  onReleaseAll: (positionId: string) => Promise<void>;
  onReleaseSelected: (applicationIds: string[]) => Promise<void>;
  selectedIds: string[];
}

export default function ReleaseControls({
  pendingCount,
  positions,
  onReleaseAll,
  onReleaseSelected,
  selectedIds,
}: ReleaseControlsProps) {
  const [confirming, setConfirming] = useState<string | null>(null); // positionId or "selected"
  const [releasing, setReleasing] = useState(false);

  if (pendingCount === 0) return null;

  const handleRelease = async (target: string) => {
    setReleasing(true);
    try {
      if (target === "selected") {
        await onReleaseSelected(selectedIds);
      } else {
        await onReleaseAll(target);
      }
    } finally {
      setReleasing(false);
      setConfirming(null);
    }
  };

  return (
    <div className="glass-card p-4 mb-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FFD166] animate-pulse" />
          <span className="text-sm text-[#F1FFFF]">
            <strong>{pendingCount}</strong> unreleased status change
            {pendingCount !== 1 ? "s" : ""}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Per-role release buttons */}
          {positions
            .filter((p) => p.pendingCount > 0)
            .map((p) => (
              <button
                key={p.id}
                onClick={() => setConfirming(p.id)}
                className="rounded-lg bg-[#002FA7]/10 border border-[#002FA7]/30 px-3 py-1.5 text-xs text-[#F1FFFF] font-mono hover:bg-[#002FA7]/20 transition flex items-center gap-1.5"
              >
                <Send className="w-3 h-3" />
                Release {p.title} ({p.pendingCount})
              </button>
            ))}

          {/* Release selected */}
          {selectedIds.length > 0 && (
            <button
              onClick={() => setConfirming("selected")}
              className="rounded-lg bg-[#22C55E]/10 border border-[#22C55E]/30 px-3 py-1.5 text-xs text-[#22C55E] font-mono hover:bg-[#22C55E]/20 transition flex items-center gap-1.5"
            >
              <Send className="w-3 h-3" />
              Release Selected ({selectedIds.length})
            </button>
          )}
        </div>
      </div>

      {/* Confirmation modal */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirming(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card p-6 max-w-sm w-full mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#FFD166]/10 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-[#FFD166]" />
                </div>
                <h3 className="text-lg font-semibold text-[#F1FFFF]">
                  Confirm Release
                </h3>
              </div>

              <p className="text-sm text-[#9CA3AF] mb-6">
                This will update the applicant-facing status and send email
                notifications. This action cannot be undone.
              </p>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirming(null)}
                  className="px-4 py-2 rounded-lg text-sm text-[#9CA3AF] hover:text-[#F1FFFF] transition"
                >
                  Cancel
                </button>
                <Button
                  variant="primary"
                  onClick={() => handleRelease(confirming)}
                >
                  {releasing ? "Releasing..." : "Release Decisions"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
