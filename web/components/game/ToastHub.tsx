"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createToastQueue, type GameToast } from "@/lib/game/toastQueue";
import styles from "./ToastHub.module.css";

export function toast(text: string, icon?: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("tsi:toast", { detail: { text, icon } }));
}

function ToastIcon({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.icon} src={src} alt="" width={22} height={22} onError={() => setFailed(true)} />;
}

export default function ToastHub() {
  const [entries, setEntries] = useState<readonly GameToast[]>([]);
  useEffect(() => {
    const queue = createToastQueue(setEntries);
    const onToast = (event: Event) => queue.push((event as CustomEvent<unknown>).detail);
    window.addEventListener("tsi:toast", onToast);
    return () => { window.removeEventListener("tsi:toast", onToast); queue.dispose(); };
  }, []);

  return (
    <div className={styles.hub} aria-live="polite" aria-relevant="additions" aria-atomic="false">
      {entries.map((entry) => (
        <div key={entry.id} className={styles.toast} style={{ "--toast-ms": `${entry.duration}ms` } as CSSProperties}>
          {entry.icon && <ToastIcon src={entry.icon} />}
          <span className={styles.text}>{entry.text}</span>
        </div>
      ))}
    </div>
  );
}
