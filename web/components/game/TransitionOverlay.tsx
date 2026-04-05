"use client";

import { useState, useCallback, useEffect, createContext, useContext } from "react";

/**
 * Fade-to-black transition overlay per specs/ux-game-world.md Section 7.
 *
 * Timeline:
 *   0.0s  Trigger → input disabled, black overlay fades in (0→1)
 *   0.3s  Fully black → execute callback (navigate, load scene)
 *   0.5s  Callback done → black overlay fades out (1→0)
 *   0.8s  Complete → input re-enabled
 */

type TransitionState = "idle" | "fading-in" | "black" | "fading-out";

interface TransitionContextValue {
  state: TransitionState;
  isTransitioning: boolean;
  triggerTransition: (onBlack: () => void | Promise<void>) => void;
}

const TransitionContext = createContext<TransitionContextValue>({
  state: "idle",
  isTransitioning: false,
  triggerTransition: () => {},
});

export function useTransition() {
  return useContext(TransitionContext);
}

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TransitionState>("idle");
  const [onBlackCallback, setOnBlackCallback] = useState<(() => void | Promise<void>) | null>(null);

  const triggerTransition = useCallback((onBlack: () => void | Promise<void>) => {
    if (state !== "idle") return;
    setOnBlackCallback(() => onBlack);
    setState("fading-in");
  }, [state]);

  // State machine
  useEffect(() => {
    if (state === "fading-in") {
      const timer = setTimeout(async () => {
        setState("black");
        if (onBlackCallback) {
          await onBlackCallback();
        }
        setTimeout(() => setState("fading-out"), 200);
      }, 300);
      return () => clearTimeout(timer);
    }

    if (state === "fading-out") {
      const timer = setTimeout(() => {
        setState("idle");
        setOnBlackCallback(null);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [state, onBlackCallback]);

  const isTransitioning = state !== "idle";

  return (
    <TransitionContext.Provider value={{ state, isTransitioning, triggerTransition }}>
      {children}

      {/* Black overlay */}
      {isTransitioning && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            backgroundColor: "#000000",
            opacity: state === "fading-in" ? 1 : state === "black" ? 1 : 0,
            transition:
              state === "fading-in"
                ? "opacity 0.3s ease-in"
                : state === "fading-out"
                  ? "opacity 0.3s ease-out"
                  : "none",
            pointerEvents: "all",
          }}
        />
      )}
    </TransitionContext.Provider>
  );
}
