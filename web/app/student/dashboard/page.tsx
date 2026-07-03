"use client";

import { Suspense, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import MobileWorld from "@/components/portal/MobileWorld";

// ─── Tier-2 #11: stripped mode for phones ────────────────────────────────────
// Small viewports skip WebGL entirely and get the 2D minimap (MobileWorld).
// An escape hatch lets capable phones opt into the real 3D world per session.
function subscribeViewport(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(max-width: 767px)");
  if (mq.addEventListener) mq.addEventListener("change", cb);
  else mq.addListener(cb);
  return () => {
    if (mq.removeEventListener) mq.removeEventListener("change", cb);
    else mq.removeListener(cb);
  };
}

function getViewportSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

function getViewportServerSnapshot(): boolean {
  return false; // SSR renders the desktop shell; GameWorld is ssr:false anyway
}

/**
 * Sprint A9: branded loading state for the canvas mount.
 *
 * Used twice:
 *   1. next/dynamic `loading` — fires while the GameWorld chunk downloads
 *   2. React <Suspense fallback> — fires while any Suspense-throwing async
 *      resource inside GameWorld (GLBs via useGLTF, etc.) resolves
 *
 * Pure HTML/CSS: no R3F, no GLBs, no images. Keeps first paint cheap.
 * Matches the existing ASCII aesthetic of the marketing site
 * (web/components/ascii/*) without pulling in gsap/ScrollTrigger.
 */
function GameLoadingScreen() {
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: "var(--color-bg-main)" }}
    >
      <div className="text-center">
        <pre
          className="font-mono text-xs mb-4 select-none"
          style={{ color: "var(--color-text-subtle)", opacity: 0.6 }}
          aria-hidden="true"
        >
{`  ████████████████████
  █ LOADING WORLD... █
  ████████████████████`}
        </pre>
        <div
          className="font-mono text-sm mb-4 select-none"
          style={{ color: "var(--color-text-muted)" }}
        >
          Connecting to TSI World
          <span className="a9-cursor">_</span>
        </div>
        <div
          className="w-48 h-1.5 rounded-full mx-auto overflow-hidden"
          style={{ background: "var(--gray-800)" }}
        >
          <div
            className="h-full rounded-full animate-pulse"
            style={{
              width: "60%",
              background: "var(--color-brand-blue)",
            }}
          />
        </div>
      </div>
      <style jsx>{`
        .a9-cursor {
          display: inline-block;
          margin-left: 2px;
          animation: a9-blink 1s steps(2, start) infinite;
        }
        @keyframes a9-blink {
          to {
            visibility: hidden;
          }
        }
      `}</style>
    </div>
  );
}

const GameWorld = dynamic(() => import("@/components/game/GameWorld"), {
  ssr: false,
  loading: () => <GameLoadingScreen />,
});

export default function DashboardHome() {
  const isMobile = useSyncExternalStore(
    subscribeViewport,
    getViewportSnapshot,
    getViewportServerSnapshot
  );
  const [force3D, setForce3D] = useState(false);

  if (isMobile && !force3D) {
    return (
      <div className="w-full h-full">
        <MobileWorld onTry3D={() => setForce3D(true)} />
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <Suspense fallback={<GameLoadingScreen />}>
        <GameWorld />
      </Suspense>
    </div>
  );
}
