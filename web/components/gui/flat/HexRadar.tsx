import f from "./flat.module.css";

export interface RadarAxis { label: string; base: number; gain?: number; hint?: string }

/**
 * A radar chart of a few stats (the rod shop's hex, David 2026-10-27 x-shop): the base as one shape, and the gains
 * on top of it (an add-on's) as a second shape in the second colour, so you see the graph grow. One axis per stat,
 * clockwise from the top; rings every fifth of `max`. Its numbers are in the label for screen readers.
 */
export function HexRadar({ axes, max, label, size = 320, className }: { axes: readonly RadarAxis[]; max: number; label: string; size?: number; className?: string }) {
  const R = 80, n = axes.length;
  const at = (i: number, v: number, r = R) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2, k = (Math.max(0, Math.min(max, v)) / max) * r;
    return [Math.cos(a) * k, Math.sin(a) * k] as const;
  };
  const shape = (pick: (a: RadarAxis) => number) => axes.map((a, i) => at(i, pick(a)).map(c => c.toFixed(1)).join(",")).join(" ");
  const gained = axes.some(a => a.gain);
  const spoken = axes.map(a => `${a.label} ${a.base}${a.gain ? ` plus ${a.gain}` : ""}`).join(", ");
  return <figure className={`${f.radar} ${className ?? ""}`}>
    <svg viewBox="-175 -116 350 232" width="100%" style={{ maxWidth: size }} role="img" aria-label={`${label}: ${spoken}, out of ${max}`}>
      {[0.2, 0.4, 0.6, 0.8, 1].map(k => <polygon key={k} className={f.radarRing} points={axes.map((_, i) => at(i, max * k).join(",")).join(" ")} />)}
      {axes.map((_, i) => { const [x, y] = at(i, max); return <line key={i} className={f.radarRing} x1={0} y1={0} x2={x} y2={y} />; })}
      {gained && <polygon className={f.radarGain} points={shape(a => a.base + (a.gain ?? 0))} />}
      <polygon className={f.radarBase} points={shape(a => a.base)} />
      {axes.map((a, i) => {
        const [x, y] = at(i, max, R + 22);
        return <text key={a.label} className={f.radarLabel} x={x} y={y} textAnchor={Math.abs(x) < 4 ? "middle" : x > 0 ? "start" : "end"} dominantBaseline="middle">
          {a.hint ? <title>{a.hint}</title> : null}
          {a.label} <tspan className={f.radarValue}>{a.base}</tspan>{a.gain ? <tspan className={f.radarPlus}> +{a.gain}</tspan> : null}
        </text>;
      })}
    </svg>
    {gained && <figcaption className={f.radarKey}><i className={f.radarKeyBase} aria-hidden />Rod<i className={f.radarKeyGain} aria-hidden />Add-ons</figcaption>}
  </figure>;
}
