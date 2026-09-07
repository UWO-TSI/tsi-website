"use client";

import { useState, useRef, useCallback, useEffect, createContext, useContext } from "react";
import { createWorldTransition, type SceneChange, type TransitionState } from "@/lib/game/worldTransition";
import { toast } from "./ToastHub";
import styles from "./TransitionOverlay.module.css";

interface TransitionContextValue {
  state: TransitionState;
  isTransitioning: boolean;
  triggerTransition: (onBlack: SceneChange) => boolean;
}

const TransitionContext = createContext<TransitionContextValue>({
  state: "idle",
  isTransitioning: false,
  triggerTransition: () => false,
});

export function useTransition() {
  return useContext(TransitionContext);
}

export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TransitionState>("idle");
  const runner = useRef<ReturnType<typeof createWorldTransition> | null>(null);
  useEffect(() => {
    const transition = createWorldTransition(setState, (error) => {
      console.error("[world transition] Scene change failed", error);
      toast("Couldn’t finish changing rooms. Please try again.");
    });
    runner.current = transition;
    return () => { transition.dispose(); if (runner.current === transition) runner.current = null; };
  }, []);

  const triggerTransition = useCallback((onBlack: SceneChange) => {
    return runner.current?.trigger(onBlack, window.matchMedia("(prefers-reduced-motion: reduce)").matches) ?? false;
  }, []);
  const isTransitioning = state !== "idle";

  return (
    <TransitionContext.Provider value={{ state, isTransitioning, triggerTransition }}>
      {children}
      {isTransitioning && <div className={styles.overlay} data-phase={state} aria-hidden="true" />}
    </TransitionContext.Provider>
  );
}
