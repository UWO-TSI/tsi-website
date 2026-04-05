"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

/**
 * Overlay Panel — Solid dark panel for in-game object interactions.
 * Per specs/ux-game-world.md Section 7.3 + Section 8.
 *
 * Used for: Bounty Board, Job Board, Leaderboard (objects without interiors).
 * Appears on top of the game world with a blurred backdrop.
 */

interface OverlayPanelProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export default function OverlayPanel({
  title,
  open,
  onClose,
  children,
}: OverlayPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 55,
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(4px)",
        }}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-label={title}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 60,
          width: "min(800px, 90vw)",
          maxHeight: "80vh",
          background: "#0d1b2a",
          border: "1px solid rgba(0, 47, 167, 0.3)",
          borderRadius: "16px",
          boxShadow: "0 18px 45px rgba(0, 0, 0, 0.6)",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          animation: "panelIn 0.25s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: "16px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            marginBottom: "16px",
          }}
        >
          <h2
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: "#f1ffff",
              margin: 0,
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#9ca3af",
              padding: "4px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f1ffff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#9ca3af")}
          >
            <X style={{ width: "24px", height: "24px" }} />
          </button>
        </div>

        {/* Content — scrollable */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            maxHeight: "calc(80vh - 80px)",
          }}
        >
          {children}
        </div>
      </div>

      <style jsx>{`
        @keyframes panelIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }
      `}</style>
    </>
  );
}
