"use client";

/**
 * The flat kit's fishing pieces (specs/design-bible.md UI; shown in /lab/gui "Fishing"): plain props, no fishing rules
 * (those are lib/game/useFishingSession, useReelLoop, useCastMeter). The live ones take refs the caller's loop writes
 * every frame (transform only, no React renders):
 *   ReelTrack   the water track: the catch window (`windowRef`: translateX in its own widths) and the fish on its rail
 *               (`markerRef`: translateX in the track's width); `data-in` / `data-slip` on the track (`trackRef`) say
 *               whether the fish is in the window or slipping out, `data-away` on the rail that it's out of the water;
 *   LineGauge   a thin fill (`fillRef`, scaleX) with marks; `data-near` and `data-tone="low"` on it;
 *   PowerMeter  the cast's meter with its gold tip zone, standing up or `horizontal` (`fillRef` scaleY / scaleX, `readoutRef`, `data-tip`);
 *   StatusChip  a white pill with an icon: plain, `wait` (a gentle bob), `gold` (a max cast), `alert` (the hook, the
 *               big moment: black, springs in and tugs until you strike);
 *   CatchCard   the catch on its white stage, edged in its rarity (divine holographic), developing from a silhouette;
 *               a rare one's edge flares as it develops.
 * And `sparkBurst`, the catch's sparks thrown from a point.
 */
import type { ComponentProps, ReactNode, Ref } from "react";
import PixelImage from "@/components/economy/PixelImage";
import { DarkButton } from ".";
import r from "./reel.module.css";

export { r as reelStyles };

/** A white panel for a live piece (the reel, the meter). */
export function ReelPanel({ className, ...rest }: ComponentProps<"div">) {
  return <div {...rest} className={`${r.panel} ${className ?? ""}`} />;
}

export function ReelTrack({ trackRef, windowRef, markerRef, picture, unknown, windowWidth, windowAt = 0, fishAt = 0.15, state = "in" }: {
  trackRef?: Ref<HTMLDivElement>; windowRef?: Ref<HTMLDivElement>; markerRef?: Ref<HTMLDivElement>;
  /** The fish's icon (the pixel finish); `unknown`: its silhouette, not caught yet. */
  picture: string; unknown?: boolean;
  /** Where the window and the fish start (0..1 of the track), and whether the fish starts in the window or slipping. */
  windowWidth: number; windowAt?: number; fishAt?: number; state?: "in" | "slip";
}) {
  return <div ref={trackRef} className={r.track} data-in={state === "in"} data-slip={state === "slip"}>
    <div ref={windowRef} className={r.window} style={{ width: `${windowWidth * 100}%`, transform: `translateX(${(windowAt / windowWidth) * 100}%)` }} />
    <div ref={markerRef} className={r.marker} data-unknown={unknown ? "true" : undefined} style={{ transform: `translateX(${fishAt * 100}%)` }}>
      <PixelImage src={picture} px={32} className={r.fish} />
    </div>
  </div>;
}

export function LineGauge({ fillRef, gaugeRef, value, marks = [], label, near, low }: {
  fillRef?: Ref<HTMLDivElement>; gaugeRef?: Ref<HTMLDivElement>;
  /** The fill before the loop takes over (0..1). */
  value: number; marks?: readonly number[];
  /** Its name for screen readers (a progressbar). */
  label: string;
  /** Nearly full (it glows), or running low (red), before the loop takes over. */
  near?: boolean; low?: boolean;
}) {
  return <div ref={gaugeRef} className={r.gauge} data-near={near ? "true" : undefined} data-tone={low ? "low" : undefined} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value * 100)}>
    <div ref={fillRef} className={r.fill} style={{ transform: `scaleX(${value})` }} />
    {marks.map((m) => <span key={m} aria-hidden className={r.mark} style={{ left: `${m * 100}%` }} />)}
  </div>;
}

export function PowerMeter({ meterRef, fillRef, readoutRef, zone, hint, value = 0, horizontal }: {
  meterRef?: Ref<HTMLDivElement>; fillRef?: Ref<HTMLDivElement>; readoutRef?: Ref<HTMLDivElement>;
  /** The gold tip: the top (the right end, horizontal) fraction of the meter. */
  zone: number; hint: ReactNode;
  /** The power before the loop takes over (0..1). */
  value?: number;
  /** Laid along the lane (the fill scales on x) instead of standing up: it stays under the character. */
  horizontal?: boolean;
}) {
  const tip = value >= 1 - zone;
  return <div ref={meterRef} className={r.meter} data-tip={tip ? "true" : undefined} data-axis={horizontal ? "x" : undefined}>
    <div className={r.meterTrack}>
      <div className={r.zone} style={horizontal ? { width: `${zone * 100}%` } : { height: `${zone * 100}%` }} />
      <div ref={fillRef} className={r.meterFill} style={{ transform: horizontal ? `scaleX(${value})` : `scaleY(${value})` }} />
    </div>
    <div className={r.meterText}>
      <div ref={readoutRef} className={r.readout}>{tip ? "Max" : `${Math.round(value * 100)}%`}</div>
      <div className={r.meterHint}>{hint}</div>
    </div>
  </div>;
}

export type ChipTone = "plain" | "wait" | "gold" | "alert";
export function StatusChip({ icon, tone = "plain", children }: { icon?: ReactNode; tone?: ChipTone; children: ReactNode }) {
  return <div className={r.chip} data-tone={tone} role="status">
    {icon && <span className={r.chipIcon} aria-hidden>{icon}</span>}
    <span>{children}</span>
  </div>;
}

/** The rarity's edge colour (the GUI sheet's one palette). */
const edge = (rarity: string) => `var(--gui-rarity-${rarity})`;

export function CatchCard({ cardRef, picture, name, developed, rarity, rarityLabel, rare, facts, tags, line, note, action, label }: {
  cardRef?: Ref<HTMLDivElement>;
  picture: string; name: ReactNode; developed: boolean;
  rarity: string; rarityLabel: ReactNode;
  /** Rare and up: its edge flares as it develops. */
  rare?: boolean;
  /** Small facts after the rarity (the size, the odds). */
  facts?: ReactNode; tags?: ReactNode; line?: ReactNode; note?: ReactNode;
  action: { label: ReactNode; onClick: () => void };
  label: string;
}) {
  return <div ref={cardRef} className={r.card} data-developed={developed} role="dialog" aria-modal="false" aria-live="polite" aria-label={label} style={{ ["--edge" as string]: developed ? edge(rarity) : undefined }}>
    <div className={r.stage} data-developed={developed} data-rarity={developed ? rarity : undefined} data-rare={rare ? "true" : undefined}>
      <PixelImage src={picture} px={64} className={r.stagePicture} />
    </div>
    <div className={r.cardText}>
      <div className={r.cardHead}><p className={r.cardName}>{name}</p>{tags}</div>
      <div className={r.facts}><span className={r.rarity} data-rarity={rarity}>{rarityLabel}</span>{facts}</div>
      {line && <p className={r.line}>{line}</p>}
      {note}
      <div className={r.cardFoot}><DarkButton size="sm" onClick={action.onClick}>{action.label}</DarkButton></div>
    </div>
  </div>;
}

/** A small tag on the catch card (New, a record). */
export function CatchTag({ children }: { children: ReactNode }) {
  return <span className={r.tag}>{children}</span>;
}

/**
 * Sparks thrown from a point on the screen (px), in the given colours (tokens), gone when they land. A one-off (the
 * catch, a rare fish), never per frame; nothing under reduced motion.
 */
export function sparkBurst(x: number, y: number, colors: readonly string[], count = 12) {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  for (let i = 0; i < count; i++) {
    const s = document.createElement("span"), a = (i / count) * Math.PI * 2 - Math.PI / 2, d = 36 + (i % 3) * 16;
    s.className = r.spark;
    Object.assign(s.style, { left: `${x}px`, top: `${y}px`, background: colors[i % colors.length] });
    document.body.appendChild(s);
    s.animate([
      { transform: "translate(0, 0) scale(0.4) rotate(0deg)", opacity: 1 },
      { transform: `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px) scale(1) rotate(160deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(${Math.cos(a) * d * 1.2}px, ${Math.sin(a) * d * 1.2 + 16}px) scale(0.5) rotate(240deg)`, opacity: 0 },
    ], { duration: 560, easing: "cubic-bezier(0.15, 0.8, 0.4, 1)" }).onfinish = () => s.remove();
  }
}
