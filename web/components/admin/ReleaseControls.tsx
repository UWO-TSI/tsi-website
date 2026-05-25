"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, AlertTriangle, ChevronDown } from "lucide-react";

interface ReleaseControlsProps {
  pendingCount: number;
  positions: { id: string; title: string; pendingCount: number }[];
  onReleaseAll: (positionId: string) => Promise<void>;
  onReleaseSelected: (applicationIds: string[]) => Promise<void>;
  selectedIds: string[];
}

// Floating bottom-right action pill. Replaces the old top banner so
// pending verdicts never push list content down. Click the pill to
// expand a popover with per-position release buttons and a confirm step.
export default function ReleaseControls({
  pendingCount,
  positions,
  onReleaseAll,
  onReleaseSelected,
  selectedIds,
}: ReleaseControlsProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<
    | { kind: "position"; id: string; title: string; count: number }
    | { kind: "selected"; count: number }
    | null
  >(null);
  const [releasing, setReleasing] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Click-outside to close the popover (but not while confirm modal is up).
  useEffect(() => {
    if (!open || confirming) return;
    const handler = (e: MouseEvent) => {
      if (!popoverRef.current) return;
      if (popoverRef.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [open, confirming]);

  // Only surface the pill when there's actually something to release. A
  // bare selection without drafts can't do anything via release-batch.
  if (pendingCount === 0) return null;

  const handleConfirmRelease = async () => {
    if (!confirming) return;
    setReleasing(true);
    try {
      if (confirming.kind === "selected") {
        await onReleaseSelected(selectedIds);
      } else {
        await onReleaseAll(confirming.id);
      }
    } finally {
      setReleasing(false);
      setConfirming(null);
      setOpen(false);
    }
  };

  const positionsWithPending = positions.filter((p) => p.pendingCount > 0);

  return (
    <>
      {/* Bottom-right floating action */}
      <div
        ref={popoverRef}
        className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2"
      >
        {/* Expandable popover */}
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="w-[320px] rounded-2xl overflow-hidden shadow-2xl"
              style={{
                background: "rgba(15,15,16,0.94)",
                backdropFilter: "blur(20px) saturate(1.4)",
                WebkitBackdropFilter: "blur(20px) saturate(1.4)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow:
                  "0 20px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              {/* Header */}
              <div className="px-4 pt-4 pb-3 flex items-baseline justify-between border-b border-white/[0.06]">
                <div>
                  <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-[#FFD166]">
                    Pending release
                  </p>
                  <p className="text-sm text-[#F1FFFF] mt-1">
                    {pendingCount} unreleased decision
                    {pendingCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <p className="text-[10px] text-[#6B7280] font-mono">
                  emails fire on release
                </p>
              </div>

              {/* Per-position list */}
              <div className="max-h-[280px] overflow-y-auto">
                {positionsWithPending.length === 0 ? (
                  <p className="px-4 py-6 text-xs text-[#6B7280] text-center">
                    No pending decisions to release.
                  </p>
                ) : (
                  positionsWithPending.map((p) => (
                    <button
                      key={p.id}
                      onClick={() =>
                        setConfirming({
                          kind: "position",
                          id: p.id,
                          title: p.title,
                          count: p.pendingCount,
                        })
                      }
                      className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/[0.04] transition group border-b border-white/[0.03] last:border-b-0"
                    >
                      <div>
                        <p className="text-sm text-[#F1FFFF] group-hover:text-white transition">
                          {p.title}
                        </p>
                        <p className="text-[10px] font-mono text-[#6B7280]">
                          {p.pendingCount} decision
                          {p.pendingCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#1D9BF0] opacity-60 group-hover:opacity-100 transition">
                        <Send className="w-3 h-3" />
                        Release
                      </div>
                    </button>
                  ))
                )}
              </div>

              {/* Selected footer */}
              {selectedIds.length > 0 && (
                <button
                  onClick={() =>
                    setConfirming({
                      kind: "selected",
                      count: selectedIds.length,
                    })
                  }
                  className="w-full flex items-center justify-between px-4 py-3 text-left bg-[#22C55E]/[0.06] hover:bg-[#22C55E]/[0.12] transition border-t border-[#22C55E]/[0.18]"
                >
                  <div>
                    <p className="text-sm text-[#22C55E]">Release selected</p>
                    <p className="text-[10px] font-mono text-[#22C55E]/70">
                      {selectedIds.length} applicant
                      {selectedIds.length !== 1 ? "s" : ""} checked
                    </p>
                  </div>
                  <Send className="w-3.5 h-3.5 text-[#22C55E]" />
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* The pill itself */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="group inline-flex items-center gap-2.5 rounded-full pl-3 pr-4 py-2.5 transition shadow-lg"
          style={{
            background: open ? "rgba(255,209,102,0.18)" : "rgba(15,15,16,0.94)",
            backdropFilter: "blur(16px) saturate(1.4)",
            WebkitBackdropFilter: "blur(16px) saturate(1.4)",
            border: `1px solid ${open ? "rgba(255,209,102,0.4)" : "rgba(255,255,255,0.10)"}`,
            boxShadow:
              "0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          <span className="relative flex items-center justify-center">
            <span className="absolute w-3 h-3 rounded-full bg-[#FFD166]/40 animate-ping" />
            <span className="relative w-2 h-2 rounded-full bg-[#FFD166]" />
          </span>
          <span className="text-[11px] font-mono uppercase tracking-[0.12em] text-[#F1FFFF]">
            {pendingCount > 0 ? (
              <>
                {pendingCount} pending
                <span className="opacity-50 mx-1.5">·</span>
                {open ? "close" : "release"}
              </>
            ) : (
              <>{selectedIds.length} selected</>
            )}
          </span>
          <ChevronDown
            className="w-3 h-3 text-[#9CA3AF] transition-transform"
            style={{ transform: open ? "rotate(180deg)" : "none" }}
          />
        </button>
      </div>

      {/* Confirmation modal */}
      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => !releasing && setConfirming(null)}
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.94, opacity: 0, y: 12 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-sm w-full mx-4 rounded-2xl overflow-hidden"
              style={{
                background: "rgba(15,15,16,0.98)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow:
                  "0 30px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-[#FFD166]/10 border border-[#FFD166]/30 flex items-center justify-center flex-shrink-0">
                    <AlertTriangle className="w-4 h-4 text-[#FFD166]" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-[#F1FFFF] leading-tight">
                      Release{" "}
                      {confirming.kind === "selected"
                        ? `${confirming.count} selected`
                        : `${confirming.count} ${confirming.title} decision${confirming.count !== 1 ? "s" : ""}`}
                      ?
                    </h3>
                    <p className="text-[11px] font-mono text-[#6B7280] mt-1 uppercase tracking-wider">
                      Action is final
                    </p>
                  </div>
                </div>

                <p className="text-sm text-[#9CA3AF] leading-relaxed mb-6">
                  Applicant-facing status will update and a notification email
                  will be sent to each applicant. This cannot be undone.
                </p>

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setConfirming(null)}
                    disabled={releasing}
                    className="px-4 py-2 rounded-lg text-sm text-[#9CA3AF] hover:text-[#F1FFFF] transition disabled:opacity-40"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmRelease}
                    disabled={releasing}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#0B0B0E] bg-[#1D9BF0] hover:bg-[#1a8cd8] transition disabled:opacity-60"
                  >
                    {releasing ? (
                      <>
                        <span className="w-3 h-3 rounded-full border-2 border-[#0B0B0E] border-t-transparent animate-spin" />
                        Releasing
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Release decisions
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
