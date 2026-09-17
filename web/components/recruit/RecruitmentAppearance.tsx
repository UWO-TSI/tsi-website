"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { applicantDayPhase } from "@/lib/game/applicantTime";
import styles from "./appearance.module.css";

function subscribeClock(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => { clearInterval(timer); document.removeEventListener("visibilitychange", onChange); };
}

export function useApplicantDayPhase() {
  return useSyncExternalStore(subscribeClock, applicantDayPhase, () => "day" as const);
}

export default function RecruitmentAppearance({ children }: { children: ReactNode }) {
  const phase = useApplicantDayPhase();
  return <div className={styles.theme} data-time={phase}>{children}</div>;
}
