"use client";

import { useEffect, useState } from "react";
import type { Position } from "@/lib/recruitment";
import { recruitmentCountdown } from "@/lib/recruitment-countdown";
import styles from "./island.module.css";

export default function ApplicationCountdown({ positions }: { positions: Position[] }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const rows = positions.map(position => ({ title: position.title, ...recruitmentCountdown(position, now) }));
  const shared = rows.length > 0 && rows.every(row => row.label === rows[0].label && row.remaining === rows[0].remaining && row.date === rows[0].date);
  const visible = shared ? [{ ...rows[0], title: "Applications" }] : rows;
  return <aside className={styles.countdown} aria-label="Application countdown">
    {!visible.length && <p>Application dates coming soon.</p>}
    <dl>{visible.map(row => <div key={row.title}>
      <dt>{row.title}</dt>
      <dd>{row.label}{row.remaining && <strong>{row.remaining}</strong>}{row.date && <small>{row.date}</small>}</dd>
    </div>)}</dl>
  </aside>;
}
