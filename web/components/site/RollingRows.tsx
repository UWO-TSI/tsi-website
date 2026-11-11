"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type Row = { when: string; title: string; detail: string };

// The club's year runs from August.
const MONTHS = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];

/** The months a row covers on the August-to-July ruler: "Aug 10" is August, "Oct–Mar" runs October to March. */
function monthSpan(when: string): [number, number] {
  const found = (when.match(/[A-Z][a-z]{2}/g) ?? []).map((m) => MONTHS.indexOf(m)).filter((i) => i >= 0);
  if (!found.length) return [0, 0];
  return [found[0], found[found.length - 1]];
}

/**
 * The year as a receipt (contentarchitecture.dev's counter and Terminal Industries' steps, rebuilt): a big
 * date pinned on the left rolls in letter by letter, a ruler from August to July lights the months the
 * current row covers, and the row crossing the middle of the screen turns into a dark bar. Rows already
 * passed stay lit, later ones wait dim; rows are tight so each date takes a short scroll.
 */
export default function RollingRows({ id, title, rows, tone = "light" }: { id: string; title: ReactNode; rows: readonly Row[]; tone?: "light" | "dark" }) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
    }, { rootMargin: "-48% 0px -52% 0px" });
    refs.current.forEach((r) => r && io.observe(r));
    return () => io.disconnect();
  }, []);

  const [from, to] = monthSpan(rows[active]?.when ?? "");

  return (
    <section className="ts-section" data-tone={tone} id={id} aria-labelledby={`${id}-title`}>
      <div className="ts-wrap">
        <h2 className="ts-h2" id={`${id}-title`} style={{ maxWidth: "14em" }}>{title}</h2>
        <div className="dt-grid">
          <div className="dt-pin" aria-hidden="true">
            <div className="dt-odo ts-num" key={active}>
              {Array.from(rows[active]?.when ?? "").map((ch, i) => (
                <span key={i} style={{ animationDelay: `${i * 32}ms` }}>{ch === " " ? " " : ch}</span>
              ))}
            </div>
            <div className="dt-ruler">
              <span className="dt-ruler__mark" style={{ left: `calc(${from} * 100% / 12)`, width: `calc(${to - from + 1} * 100% / 12)` }} />
              {MONTHS.map((m, i) => (
                <span key={m} className="dt-ruler__month" data-on={i >= from && i <= to}>{m}</span>
              ))}
            </div>
            <div className="dt-count"><b>{String(active + 1).padStart(2, "0")}</b> / {String(rows.length).padStart(2, "0")}</div>
          </div>
          <ol className="dt-rows">
            {rows.map((r, i) => (
              <li key={r.title} ref={(el) => { refs.current[i] = el; }} data-index={i} className="dt-row" data-active={i === active} data-past={i < active}>
                <span className="dt-row__when">{r.when}</span>
                <div>
                  <h3 className="ts-h3">{r.title}</h3>
                  <p className="ts-body dt-row__detail">{r.detail}</p>
                </div>
                <span className="dt-row__arrow" aria-hidden="true">→</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
