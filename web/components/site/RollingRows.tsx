"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type Row = { when: string; title: string; detail: string; tag?: string };

/**
 * A rolling date pinned on the left beside rows that scroll past (Terminal Industries' steps scene,
 * rebuilt). The date rolls to whichever row crosses the middle of the screen; rows already passed stay
 * lit, the rest wait dim. Every row carries content, so no stretch of scroll is empty.
 */
export default function RollingRows({ id, label, title, rows, tone = "light" }: { id: string; label: string; title: ReactNode; rows: readonly Row[]; tone?: "light" | "dark" }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
    }, { rootMargin: "-50% 0px -50% 0px" });
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);

  return (
    <section className="ts-section" data-tone={tone} id={id} aria-labelledby={`${id}-title`}>
      <div className="ts-wrap">
        <p className="ts-label">{label}</p>
        <h2 className="ts-h2" id={`${id}-title`} style={{ maxWidth: "14em", marginTop: 18 }}>{title}</h2>
        <div className="dt-grid">
          <div className="dt-pin" aria-hidden="true">
            <div className="dt-roll">
              <div className="dt-roll__list" style={{ transform: `translateY(calc(${-active} * clamp(4.5rem, 10vw, 9rem)))` }}>
                {rows.map((r, i) => <div key={i} className="dt-roll__item ts-num">{r.when}</div>)}
              </div>
            </div>
            <div className="dt-count"><b>{String(active + 1).padStart(2, "0")}</b> / {String(rows.length).padStart(2, "0")}</div>
          </div>
          <ol className="dt-rows">
            {rows.map((r, i) => (
              <li key={r.title} ref={(el) => { refs.current[i] = el; }} data-index={i} className="dt-row" data-active={i === active} data-past={i < active}>
                <span className="dt-row__when">{r.when}</span>
                <div>
                  {r.tag && <span className="dt-row__who">{r.tag}</span>}
                  <h3 className="ts-h3">{r.title}</h3>
                  <p className="ts-body dt-row__detail">{r.detail}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
