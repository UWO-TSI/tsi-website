"use client";

import { useId, type ReactNode } from "react";
import styles from "./DefaultIslandWorld.module.css";

/**
 * In-world sheet chrome (non-modal, the world stays live behind it): title,
 * × close, body. The world's Escape handler closes it. `embedded`: inside
 * another sheet's frame, so no dialog role and no close button.
 */
export default function IslandSheet({ title, onClose, className, testId, embedded, children }: {
  title: string; onClose?: () => void; className?: string; testId: string; embedded?: boolean; children: ReactNode;
}) {
  const id = useId();
  return <section className={`${styles.sheet} ${className ?? ""}`} role={embedded ? undefined : "dialog"} aria-modal={embedded ? undefined : false} aria-labelledby={id} data-testid={testId}>
    <header><h2 id={id}>{title}</h2>{!embedded && onClose && <button onClick={onClose} aria-label="Close">×</button>}</header>
    {children}
  </section>;
}
