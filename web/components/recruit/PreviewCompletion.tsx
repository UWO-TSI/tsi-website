"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { VillageButton } from "./ui";
import styles from "./island.module.css";

export default function PreviewCompletion({ onReturn }: { onReturn: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!canvas.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const celebrate = confetti.create(canvas.current, { resize: true, useWorker: false });
    void celebrate({ particleCount: 90, spread: 85, origin: { y: 0.6 }, colors: ["#1d9bf0", "#ffd166", "#80af67"] });
    return () => celebrate.reset();
  }, []);
  return <div className={styles.completion}>
    <canvas ref={canvas} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
    <div className={styles.completionMark} aria-hidden="true">✓</div>
    <h3>That’s the full journey.</h3>
    <p>Rehearsal complete. No application was sent or saved. In the live round, this celebration appears only after the server confirms your application was received.</p>
    <VillageButton onClick={onReturn}>Back to the hiring board</VillageButton>
  </div>;
}
