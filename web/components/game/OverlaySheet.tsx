"use client";

/**
 * OverlaySheet (game-feel item 14, 2026-07-12) — feature pages as sheets
 * over the living world.
 *
 * Walking into the Shop / Bounty Board / Job Board / Leaderboard used to
 * router.push to the full-page route, unmounting the entire Canvas — a
 * multi-second world reload on the way back. Now those four targets slide
 * up as a sheet OVER the world: the Canvas keeps rendering (NPCs wander,
 * rain falls, TOD ticks) and closing the sheet is instant.
 *
 * The sheet mounts the same "use client" page components the routes render
 * (they take no route params), lazily imported so GameWorld's chunk stays
 * lean. The /student/dashboard/* routes are untouched — deep links and the
 * dashboard sidebar still work; this only changes in-world interaction.
 */

import { useEffect } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";

const SheetShop = dynamic(() => import("@/app/student/dashboard/shop/page"), { ssr: false });
const SheetBounty = dynamic(() => import("@/app/student/dashboard/bounty/page"), { ssr: false });
const SheetJobs = dynamic(() => import("@/app/student/dashboard/jobs/page"), { ssr: false });
const SheetLeaderboard = dynamic(() => import("@/app/student/dashboard/leaderboard/page"), { ssr: false });

const SHEETS = {
  shop: { Component: SheetShop, title: "Shop" },
  bounty: { Component: SheetBounty, title: "Bounty Board" },
  jobs: { Component: SheetJobs, title: "Job Board" },
  leaderboard: { Component: SheetLeaderboard, title: "Leaderboard" },
} as const;

export type SheetKey = keyof typeof SHEETS;

const HREF_TO_SHEET: Record<string, SheetKey> = {
  "/student/dashboard/shop": "shop",
  "/student/dashboard/bounty": "bounty",
  "/student/dashboard/jobs": "jobs",
  "/student/dashboard/leaderboard": "leaderboard",
};

export function sheetKeyForHref(href: string | undefined): SheetKey | null {
  if (!href) return null;
  return HREF_TO_SHEET[href] ?? null;
}

export default function OverlaySheet({ sheet, onClose }: { sheet: SheetKey | null; onClose: () => void }) {
  useEffect(() => {
    if (!sheet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [sheet, onClose]);

  if (!sheet) return null;
  const { Component, title } = SHEETS[sheet];

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70 }}>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(8, 8, 12, 0.45)",
          animation: "tsi-sheet-dim 0.25s ease-out",
        }}
      />
      <div
        role="dialog"
        aria-label={title}
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: 0,
          top: "5%",
          width: "min(1040px, 95vw)",
          background: "var(--color-bg-main, #0f0f10)",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          borderBottom: "none",
          borderRadius: "18px 18px 0 0",
          boxShadow: "0 -12px 48px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          animation: "tsi-sheet-up 0.28s cubic-bezier(0.32, 0.9, 0.35, 1)",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close sheet"
          title="Close (Esc)"
          style={{
            position: "absolute",
            top: 12,
            right: 14,
            zIndex: 5,
            width: 34,
            height: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(255, 255, 255, 0.08)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            borderRadius: 10,
            color: "#f1ffff",
            cursor: "pointer",
          }}
        >
          <X size={16} />
        </button>
        <div style={{ flex: 1, overflowY: "auto" }}>
          <Component />
        </div>
      </div>
      <style>{`
        @keyframes tsi-sheet-up { from { transform: translate(-50%, 6%); opacity: 0.6; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes tsi-sheet-dim { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
