"use client";

import { type ReactNode, useState, useRef, useCallback } from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/portal/Sidebar";
import { TransitionProvider } from "@/components/game/TransitionOverlay";
import { UserProvider } from "@/components/portal/UserContext";
import PreviewBanner from "@/components/portal/PreviewBanner";
import QuestChecklist from "@/components/portal/QuestChecklist";

const HIDE_DELAY_MS = 250; // grace period when mouse leaves before sidebar tucks away

export default function DashboardLayout({ children }: { children: ReactNode }) {
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

  return (
    <UserProvider>
      <TransitionProvider>
        <PreviewBanner />
        <div
          className="fixed inset-0 z-50 flex"
          style={{ background: "var(--color-bg-main)" }}
        >
          {/* Hamburger button — always visible, top-left. Hover or click. */}
          <button
            aria-label={pinned ? "Unpin menu" : "Open menu"}
            className="hidden md:flex fixed items-center justify-center"
            style={{
              top: "12px",
              left: "12px",
              width: "40px",
              height: "40px",
              zIndex: 60,
              background: pinned ? "var(--color-brand-blue, #1D9BF0)" : "var(--color-surface)",
              border: "1px solid var(--glass-border-soft)",
              borderRadius: "8px",
              color: "var(--color-text-main)",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
            onMouseEnter={handleEnter}
            onMouseLeave={scheduleHide}
            onClick={togglePin}
          >
            <Menu style={{ width: "20px", height: "20px" }} />
          </button>

          {/* Desktop sidebar — slides in/out, only mounted on md+ */}
          <div
            className="hidden md:flex fixed top-0 bottom-0 left-0 flex-shrink-0"
            style={{
              zIndex: 55,
              transform: sidebarVisible ? "translateX(0)" : "translateX(-100%)",
              transition: "transform 0.22s ease-out",
              pointerEvents: sidebarVisible ? "auto" : "none",
              boxShadow: sidebarVisible
                ? "0 0 24px rgba(0,0,0,0.35)"
                : "none",
            }}
            onMouseEnter={handleEnter}
            onMouseLeave={scheduleHide}
          >
            <Sidebar />
          </div>

          {/* Mobile hamburger button (separate — tap behavior) */}
          <button
            aria-label="Open menu"
            className="md:hidden fixed flex items-center justify-center"
            style={{
              top: "12px",
              left: "12px",
              width: "40px",
              height: "40px",
              zIndex: 50,
              background: "var(--color-surface)",
              border: "1px solid var(--glass-border-soft)",
              borderRadius: "8px",
              color: "var(--color-text-main)",
            }}
            onClick={() => setMobileOpen(true)}
          >
            <Menu style={{ width: "24px", height: "24px" }} />
          </button>

          {/* Mobile sidebar overlay */}
          {mobileOpen && (
            <>
              <div
                className="fixed inset-0 md:hidden"
                style={{ zIndex: 45, background: "rgba(0, 0, 0, 0.5)" }}
                onClick={() => setMobileOpen(false)}
              />
              <div
                className="fixed inset-y-0 left-0 md:hidden"
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
          <QuestChecklist />

          <style jsx>{`
            @keyframes slideIn {
              from { transform: translateX(-100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </div>
      </TransitionProvider>
    </UserProvider>
  );
}
