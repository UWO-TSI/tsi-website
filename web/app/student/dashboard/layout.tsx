"use client";

import { type ReactNode, useState } from "react";
import { Menu } from "lucide-react";
import Sidebar from "@/components/portal/Sidebar";
import { TransitionProvider } from "@/components/game/TransitionOverlay";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <TransitionProvider>
    <div
      className="fixed inset-0 z-50"
      style={{ background: "var(--color-bg-main)" }}
    >
      {/* Desktop sidebar */}
      <div className="hidden md:block h-full">
        <Sidebar />
      </div>

      {/* Mobile hamburger button */}
      <button
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
          {/* Backdrop */}
          <div
            className="fixed inset-0 md:hidden"
            style={{ zIndex: 45, background: "rgba(0, 0, 0, 0.5)" }}
            onClick={() => setMobileOpen(false)}
          />
          {/* Sidebar slide-over */}
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

      {/* Main content area */}
      <main
        className="h-full overflow-y-auto overflow-x-hidden md:ml-[240px]"
      >
        {children}
      </main>

      <style jsx>{`
        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
    </TransitionProvider>
  );
}
