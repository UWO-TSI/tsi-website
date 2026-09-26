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

import { Component as ReactComponent, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { useWorldDialog } from "@/lib/game/useWorldDialog";

const SheetShop = dynamic(() => import("@/app/student/dashboard/shop/page"), { ssr: false, loading: SheetLoading });
const SheetBounty = dynamic(() => import("@/app/student/dashboard/bounty/page"), { ssr: false, loading: SheetLoading });
const SheetJobs = dynamic(() => import("@/app/student/dashboard/jobs/page"), { ssr: false, loading: SheetLoading });
const SheetLeaderboard = dynamic(() => import("@/app/student/dashboard/leaderboard/page"), { ssr: false, loading: SheetLoading });
// The legacy 12-question quiz is retired here; the Oracle opens the new reading (oracle-identity.md).
const SheetOracle = dynamic(() => import("./oracle/OracleSheetEmbed"), { ssr: false, loading: SheetLoading });
const SheetDirectory = dynamic(() => import("@/app/student/dashboard/directory/page"), { ssr: false, loading: SheetLoading });
const SheetProfile = dynamic(() => import("@/app/student/dashboard/profile/page"), { ssr: false, loading: SheetLoading });
const SheetQuests = dynamic(() => import("@/app/student/dashboard/quests/page"), { ssr: false, loading: SheetLoading });
const SheetJournal = dynamic(() => import("@/app/student/dashboard/journal/page"), { ssr: false, loading: SheetLoading });
const SheetLetters = dynamic(() => import("@/app/student/dashboard/letters/page"), { ssr: false, loading: SheetLoading });
const SheetWharfSell = dynamic(() => import("./WharfSellSheet"), { ssr: false, loading: SheetLoading });

function SheetLoading() {
  return <p role="status" style={{ padding: 32, color: "var(--color-text-muted, #A9B8C4)", fontSize: 14 }}>Opening panel…</p>;
}

export class SheetContentBoundary extends ReactComponent<{ title: string; onClose: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <section role="alert" style={{ padding: 32, color: "var(--color-text-main, #f1ffff)" }}>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>{this.props.title} couldn’t open</h2>
      <p style={{ color: "var(--color-text-muted, #A9B8C4)", fontSize: 14 }}>You can keep exploring, or reload the page to try again.</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20 }}>
        <button onClick={this.props.onClose} style={{ minHeight: 44, padding: "8px 14px", borderRadius: 8, background: "#FFD166", color: "#25291e" }}>Back to village</button>
        <button onClick={() => window.location.reload()} style={{ minHeight: 44, padding: "8px 14px", borderRadius: 8, border: "1px solid var(--glass-border-soft, #53616a)" }}>Reload page</button>
      </div>
    </section>;
  }
}

const SHEETS = {
  shop: { Component: SheetShop, title: "Shop" },
  bounty: { Component: SheetBounty, title: "Bounty Board" },
  jobs: { Component: SheetJobs, title: "Job Board" },
  leaderboard: { Component: SheetLeaderboard, title: "Leaderboard" },
  oracle: { Component: SheetOracle, title: "Oracle Temple" },
  directory: { Component: SheetDirectory, title: "Directory" },
  profile: { Component: SheetProfile, title: "Profile" },
  quests: { Component: SheetQuests, title: "Quests" },
  journal: { Component: SheetJournal, title: "Journal" },
  letters: { Component: SheetLetters, title: "Letters" },
  wharfsell: { Component: SheetWharfSell, title: "Wharf Shack — Sell Catches" },
} as const;

export type SheetKey = keyof typeof SHEETS;

const HREF_TO_SHEET: Record<string, SheetKey> = {
  "/student/dashboard/shop": "shop",
  "/student/dashboard/bounty": "bounty",
  "/student/dashboard/jobs": "jobs",
  "/student/dashboard/leaderboard": "leaderboard",
  "/student/dashboard/oracle": "oracle",
  "/student/dashboard/directory": "directory",
  "/student/dashboard/profile": "profile",
  "/student/dashboard/quests": "quests",
  "/student/dashboard/journal": "journal",
  "/student/dashboard/letters": "letters",
};

export function sheetKeyForHref(href: string | undefined): SheetKey | null {
  if (!href) return null;
  return HREF_TO_SHEET[href] ?? null;
}

export default function OverlaySheet({ sheet, onClose }: { sheet: SheetKey | null; onClose: () => void }) {
  const dialogRef = useWorldDialog(sheet !== null, onClose);

  if (!sheet) return null;
  const { Component, title } = SHEETS[sheet];

  return (
    <div data-world-sheet style={{ position: "absolute", inset: 0, zIndex: 70 }}>
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
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 16px", borderBottom: "1px solid var(--glass-border-soft, rgba(255,255,255,0.14))", flexShrink: 0 }}>
          <span style={{ color: "var(--color-text-main, #f1ffff)", fontSize: 13, fontWeight: 600 }}>{title}</span>
          <button
            onClick={onClose}
            aria-label="Close sheet"
            title="Close (Esc)"
            style={{ width: 44, height: 44, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--surface-chip, rgba(255,255,255,0.08))", border: "1px solid var(--glass-border-soft, rgba(255,255,255,0.16))", borderRadius: 10, color: "var(--color-text-main, #f1ffff)", cursor: "pointer" }}
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
          <SheetContentBoundary key={sheet} title={title} onClose={onClose}>
            <Component />
          </SheetContentBoundary>
        </div>
      </div>
      <style>{`
        @media (prefers-reduced-motion: reduce) { [data-world-sheet] * { animation: none !important; } }
        @keyframes tsi-sheet-up { from { transform: translate(-50%, 6%); opacity: 0.6; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes tsi-sheet-dim { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
