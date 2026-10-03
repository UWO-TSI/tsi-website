"use client";

import { type ReactNode, useState, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import Sidebar from "@/components/portal/Sidebar";
import { UserProvider } from "@/components/portal/UserContext";
import PreviewBanner from "@/components/portal/PreviewBanner";
import QuestChecklist from "@/components/portal/QuestChecklist";
import { ThemeInit } from "@/components/portal/ThemeToggle";

const HIDE_DELAY_MS = 250; // grace period when mouse leaves before sidebar tucks away

export default function MemberDashboardShell({ children }: { children: ReactNode }) {
  // Mobile: tap hamburger to open, tap backdrop to close.
  const [mobileOpen, setMobileOpen] = useState(false);
  // Desktop: hover hamburger or sidebar to reveal; click hamburger to pin open.
  const [revealed, setRevealed] = useState(false);
  const [pinned, setPinned] = useState(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelHide = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    cancelHide();
    if (pinned) return;
    hideTimerRef.current = setTimeout(() => setRevealed(false), HIDE_DELAY_MS);
  }, [pinned, cancelHide]);

  const handleEnter = useCallback(() => {
    cancelHide();
    setRevealed(true);
  }, [cancelHide]);

  const togglePin = useCallback(() => {
    setPinned((prev) => {
      const next = !prev;
      if (next) setRevealed(true);
      return next;
    });
  }, []);

  const sidebarVisible = revealed || pinned;
  const pathname = usePathname()?.replace(/\/+$/, "") ?? "";
  // The member island (/student/dashboard) is full-screen: no portal menu over its title, no portal quest bubble.
  const island = pathname === "/student/dashboard";
  // The recruitment board (components/admin, live) keeps its own look inside the shell; everything else wears the GUI sheet.
  const recruitment = pathname.startsWith("/student/dashboard/admin/recruitment");

  return (
    <UserProvider>
        <PreviewBanner />
        <div
          className={`fixed inset-0 z-50 flex ${recruitment ? "" : "gui"}`}
          style={{ background: "var(--color-bg-main)" }}
        >
          {/* Hamburger button — top-left on portal pages. Hover or click. */}
          {!island && <button
            aria-label={pinned ? "Unpin menu" : "Open menu"}
            className="gui hidden md:flex fixed items-center justify-center"
            style={{
              top: "12px",
              left: "12px",
              width: "44px",
              height: "44px",
              zIndex: 60,
              background: pinned ? "var(--gui-butter)" : "var(--gui-paper-hi)",
              border: 0,
              borderRadius: "50%",
              boxShadow: "var(--gui-shadow-sm), inset 0 0 0 1.5px var(--gui-paper-edge)",
              color: "var(--gui-ink)",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={handleEnter}
            onMouseLeave={scheduleHide}
            onClick={togglePin}
          >
            <Menu style={{ width: "20px", height: "20px" }} />
          </button>}

          {/* Desktop sidebar — slides in/out, only mounted on md+ */}
          <div
            className="gui hidden md:flex fixed top-0 bottom-0 left-0 flex-shrink-0"
            style={{
              zIndex: 55,
              transform: sidebarVisible ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 0.22s ease-out",
              pointerEvents: sidebarVisible ? "auto" : "none",
              boxShadow: sidebarVisible
                ? "var(--gui-shadow-lg)"
                : "none",
            }}
            onMouseEnter={handleEnter}
            onMouseLeave={scheduleHide}
          >
            <Sidebar />
          </div>

          {/* Mobile hamburger button (separate — tap behavior) */}
          {!island && <button
            aria-label="Open menu"
            className="gui md:hidden fixed flex items-center justify-center"
            style={{
              top: "12px",
              left: "12px",
              width: "44px",
              height: "44px",
              zIndex: 50,
              background: "var(--gui-paper-hi)",
              border: 0,
              borderRadius: "50%",
              boxShadow: "var(--gui-shadow-sm), inset 0 0 0 1.5px var(--gui-paper-edge)",
              color: "var(--gui-ink)",
            }}
            onClick={() => setMobileOpen(true)}
          >
            <Menu style={{ width: "24px", height: "24px" }} />
          </button>}

          {/* Mobile sidebar overlay */}
          {mobileOpen && (
            <>
              <div
                className="fixed inset-0 md:hidden"
                style={{ zIndex: 45, background: "var(--gui-scrim)" }}
                onClick={() => setMobileOpen(false)}
              />
              <div
                className="gui fixed inset-y-0 left-0 md:hidden"
                style={{
                  zIndex: 50,
                  animation: "slideIn 0.25s ease-out",
                }}
              >
                <Sidebar onClose={() => setMobileOpen(false)} />
              </div>
            </>
          )}

          {/* Main content — fills full width since sidebar is now an overlay */}
          <main className="flex-1 h-full overflow-y-auto overflow-x-hidden">
            {children}
          </main>

          {/* R3-1: Onboarding quest checklist (floating, opt-in, mute via Settings → Appearance) */}
          <QuestChecklist hidden={island} />

          {/* R3-2: apply stored theme on every portal page load, not just Settings */}
          <ThemeInit />

          <style jsx>{`
            @keyframes slideIn {
              from { transform: translateX(-100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </div>
    </UserProvider>
  );
}
