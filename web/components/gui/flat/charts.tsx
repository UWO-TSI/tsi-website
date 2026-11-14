"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import c from "./charts.module.css";

/**
 * The kit's charts (design bible UI, built 2: added here and on /lab/gui before the admin analytics page used them).
 * One hue per job from the theme (`--ui-chart`, `--ui-chart-gain`), values in ink, a hover read-out on every mark.
 */
export const CHART = { a: "var(--ui-chart)", b: "var(--ui-chart-gain)", soft: "color-mix(in srgb, var(--ui-chart) 32%, var(--ui-card))" } as const;

/** A white card with a title and one plain line under it. */
export function ChartCard({ title, note, children, className }: { title: ReactNode; note?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`${c.card} ${className ?? ""}`}><h2 className={c.head}>{title}</h2>{note ? <p className={c.note}>{note}</p> : <div style={{ height: 12 }} />}{children}</section>;
}

/** A change against the period before: an arrow and the amount, never colour alone. */
export function Delta({ now, before, unit = "n", lowerIsBetter }: { now: number; before: number | null; unit?: "n" | "pct" | "min"; lowerIsBetter?: boolean }) {
  if (before === null) return <span className={c.tileSub}>nothing to compare yet</span>;
  const d = unit === "pct" ? now - before : before ? ((now - before) / before) * 100 : now ? 100 : 0;
  const r = Math.round(d);
  if (!r) return <span className={c.delta}>same as before</span>;
  const good = (r > 0) !== !!lowerIsBetter;
  const Icon = r > 0 ? ArrowUpRight : ArrowDownRight;
  return <span className={c.delta} data-way={good ? "up" : "down"}>
    <Icon size={14} strokeWidth={2.5} aria-hidden />{r > 0 ? "+" : "-"}{Math.abs(r)}{unit === "pct" ? " pts" : "%"}<span className={c.tileSub} style={{ marginLeft: 4 }}>vs before</span>
  </span>;
}

/** One headline number. */
export function StatTile({ label, value, sub }: { label: ReactNode; value: ReactNode; sub?: ReactNode }) {
  return <div className={c.tile}><span className={c.tileLabel}>{label}</span><span className={c.tileValue}>{value}</span>{sub && <span className={c.tileSub}>{sub}</span>}</div>;
}

/** A choice of a few, as pills on a grey well (a chart's range). */
export function Segmented<T extends string | number>({ options, value, onChange, label }: { options: readonly { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void; label: string }) {
  return <div className={c.seg} role="group" aria-label={label}>
    {options.map((o) => <button key={String(o.id)} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}>{o.label}</button>)}
  </div>;
}

export function Legend({ items }: { items: readonly { label: string; color: string; kind?: "line" | "bar" }[] }) {
  return <div className={c.legend}>{items.map((i) => <span key={i.label}><i className={c.swatch} data-kind={i.kind ?? "bar"} style={{ background: i.color }} />{i.label}</span>)}</div>;
}

export interface Series { label: string; values: readonly number[]; color: string; kind: "line" | "bar" }

const niceTop = (v: number) => { if (v <= 4) return 4; const p = 10 ** Math.floor(Math.log10(v)), n = v / p; return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };

/** Values over days on one axis: bars and lines, a crosshair and a read-out of every series on hover or tap. */
export function TimeChart({ labels, series, height = 180, label }: { labels: readonly string[]; series: readonly Series[]; height?: number; label: string }) {
  const [at, setAt] = useState<number | null>(null);
  const n = labels.length, W = Math.max(n, 1) * 10, H = 100;
  const top = niceTop(Math.max(1, ...series.flatMap((s) => s.values)));
  const y = (v: number) => H - (v / top) * H;
  const x = (i: number) => i * 10 + 5;
  return <div>
    <div className={c.plot} style={{ "--h": `${height}px` } as CSSProperties} onPointerLeave={() => setAt(null)}>
      {[0, 0.5, 1].map((k) => <span key={k} className={c.yTick} style={{ top: `${(1 - k) * height}px` }}>{Math.round(top * k)}</span>)}
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
        {[0, 0.5, 1].map((k) => <line key={k} className={c.grid} x1={0} x2={W} y1={H * k} y2={H * k} />)}
        {series.filter((s) => s.kind === "bar").map((s) => s.values.map((v, i) => v > 0 && (
          <rect key={`${s.label}${i}`} x={i * 10 + 1} width={8} y={y(v)} height={H - y(v)} rx={0.8} fill={s.color} />
        )))}
        {at !== null && <line className={c.cross} x1={x(at)} x2={x(at)} y1={0} y2={H} />}
        {series.filter((s) => s.kind === "line").map((s) => (
          <polyline key={s.label} className={c.line} stroke={s.color} points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
        ))}
        {labels.map((_, i) => <rect key={i} x={i * 10} width={10} y={0} height={H} fill="transparent" onPointerEnter={() => setAt(i)} onPointerDown={() => setAt(i)} />)}
      </svg>
      {at !== null && <div className={c.tip} style={at > n / 2 ? { right: `calc((100% - 30px) * ${(n - at - 0.5) / n} + 8px)` } : { left: `calc(30px + (100% - 30px) * ${(at + 0.5) / n} + 8px)` }}>
        <b>{labels[at]}</b>
        {series.map((s) => <div key={s.label}><i className={c.swatch} data-kind={s.kind} style={{ background: s.color }} />{s.label}: <span className={c.num}>{s.values[at]}</span></div>)}
      </div>}
    </div>
    <div className={c.xTicks} style={{ paddingLeft: 30 }}><span>{labels[0]}</span>{n > 2 && <span>{labels[n >> 1]}</span>}<span>{labels[n - 1]}</span></div>
    {series.length > 1 && <Legend items={series} />}
  </div>;
}

export interface BarRow { key: string; label: ReactNode; value: number; text: ReactNode; inner?: number; hint?: string; drop?: { text: string; big?: boolean } }

/** Bars along rows against one max (a funnel, a ranking): the value at the end, an optional inner part, a drop line under. */
export function BarRows({ rows, max, color = CHART.a, inner = CHART.b, empty = "Nothing yet." }: { rows: readonly BarRow[]; max?: number; color?: string; inner?: string; empty?: string }) {
  if (!rows.length) return <p className={c.empty}>{empty}</p>;
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return <div className={c.rows}>{rows.map((r) => <div key={r.key} className={c.row} title={r.hint}>
    <span className={c.rowLabel}>{r.label}</span>
    <span className={c.track}>
      <span className={c.bar} style={{ width: `${(r.value / top) * 100}%`, background: color }} />
      {r.inner !== undefined && <span className={c.bar} style={{ width: `${(r.inner / top) * 100}%`, background: inner }} />}
    </span>
    <span className={c.rowValue}>{r.text}</span>
    {r.drop && <p className={c.drop} data-big={r.drop.big || undefined}>{r.drop.text}</p>}
  </div>)}</div>;
}

/** A distribution in columns, each count over its column. */
export function Columns({ bins, height = 150, color = CHART.a, label }: { bins: readonly { label: string; n: number }[]; height?: number; color?: string; label: string }) {
  const top = Math.max(1, ...bins.map((b) => b.n));
  return <div role="img" aria-label={`${label}: ${bins.map((b) => `${b.label} ${b.n}`).join(", ")}`}>
    <div className={c.cols} style={{ "--h": `${height}px` } as CSSProperties}>
      {bins.map((b) => <div key={b.label} className={c.col} title={`${b.label}: ${b.n}`}>
        <div className={c.colBar} style={{ height: `${(b.n / top) * 100}%`, background: color, position: "relative" }}><span className={c.colValue}>{b.n}</span></div>
      </div>)}
    </div>
    <div className={c.colLabels}>{bins.map((b) => <span key={b.label}>{b.label}</span>)}</div>
  </div>;
}

/** Shares in a grid, one hue light to dark (0 to 100%); null cells are not known yet. */
export function Heatmap({ cols, rows, lead }: { cols: readonly string[]; rows: readonly { label: ReactNode; side?: ReactNode; cells: readonly (number | null)[] }[]; lead: [string, string] }) {
  return <div style={{ overflowX: "auto" }}>
    <div className={c.heat} style={{ gridTemplateColumns: `auto auto repeat(${cols.length}, minmax(3.5rem, 1fr))` }}>
      <span className={c.heatHead} style={{ paddingLeft: 0 }}>{lead[0]}</span><span className={c.heatHead}>{lead[1]}</span>
      {cols.map((h) => <span key={h} className={c.heatHead} style={{ textAlign: "center" }}>{h}</span>)}
      {rows.map((r, i) => [
        <span key={`l${i}`} className={c.heatLabel}>{r.label}</span>,
        <span key={`s${i}`} className={`${c.heatLabel} ${c.num}`}>{r.side}</span>,
        ...r.cells.map((v, j) => v === null
          ? <span key={j} className={c.cell} data-none title="Not old enough yet">soon</span>
          : <span key={j} className={c.cell} data-dark={v >= 75 || undefined} title={`${cols[j]}: ${v}%`}
            style={{ background: `color-mix(in srgb, var(--ui-chart) ${Math.round(8 + v * 0.92)}%, var(--ui-card))` }}>{Math.round(v)}%</span>),
      ])}
    </div>
  </div>;
}
