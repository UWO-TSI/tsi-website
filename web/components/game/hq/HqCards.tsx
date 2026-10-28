"use client";

/**
 * The HQ visit's cards (row 312, specs/hq-onboarding.md), from the GUI kit over the room: where a gathering's check-in
 * code goes (the existing flow: the QR at the door), the Founder's plaque (blank until David writes it), the lore
 * overlay (the island, a page at a time, over a dimmed room) and the fly card (an icon up in the middle, then off to
 * its place on screen; David's v2 review). Your island ID is IdCard.tsx. Copy: lib/game/arrival/hq/lines.ts (drafts).
 */
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { CalendarCheck, Landmark, Mail, Map as MapIcon, Menu, QrCode } from "lucide-react";
import { Button, Sheet } from "@/components/gui";
import { CurrencyIcon } from "@/components/economy/Amount";
import { AudioManager } from "@/lib/game/audio";
import { CHECKIN_CARD, FLY_CARDS, FOUNDER_PLAQUE, LORE_CARD, PLAQUE_CARD, type FlyTarget } from "@/lib/game/arrival/hq/lines";
import { CHECK_IN_ORIGIN } from "@/lib/portal/checkIn";
import s from "./HqCards.module.css";

/** Where a gathering's check-in code goes: the QR at the door, which opens the check-in page. */
export function CheckInCard({ open, onDone }: { open: boolean; onDone: () => void }) {
  const host = CHECK_IN_ORIGIN.replace(/^https?:\/\//, "");
  return <Sheet open={open} onClose={onDone} title={CHECKIN_CARD.title} eyebrow={CHECKIN_CARD.eyebrow} icon={<CalendarCheck size={20} />} size="sm" tone="sage" testId="hq-checkin"
    footer={<Button onClick={onDone} data-testid="hq-checkin-done">{CHECKIN_CARD.done}</Button>}>
    <ol className={s.steps}>
      {CHECKIN_CARD.steps.map((step, i) => <li key={i}>{i === 0 ? <QrCode size={18} aria-hidden /> : <span className={s.num}>{i + 1}</span>}<span>{step.replace("{host}", host)}</span></li>)}
    </ol>
    <p className={s.note}>{CHECKIN_CARD.note}</p>
  </Sheet>;
}

/** The Founder's desk: the plaque. Blank (nothing written for the Founder) until David's words are in FOUNDER_PLAQUE. */
export function PlaqueCard({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Sheet open={open} onClose={onClose} title={PLAQUE_CARD.title} eyebrow={PLAQUE_CARD.eyebrow} icon={<Landmark size={20} />} size="sm" testId="hq-plaque"
    footer={<Button variant="secondary" onClick={onClose}>{PLAQUE_CARD.done}</Button>}>
    <div className={s.plaque} data-blank={FOUNDER_PLAQUE === null || undefined} aria-label={FOUNDER_PLAQUE ?? PLAQUE_CARD.blank}>
      {FOUNDER_PLAQUE && <p>{FOUNDER_PLAQUE}</p>}
    </div>
    {FOUNDER_PLAQUE === null && <p className={s.caption}>{PLAQUE_CARD.blank}</p>}
  </Sheet>;
}

/** The lore overlay (t-hq): Tethos and the island, a page at a time, full screen over the dimmed room. `onDone` after the last. */
export function LoreOverlay({ open, onDone }: { open: boolean; onDone: () => void }) {
  const [page, setPage] = useState(0);
  if (!open) return null;
  const pages = LORE_CARD.pages, p = pages[page], last = page === pages.length - 1;
  const next = () => { AudioManager.playSFX("blip2", { rate: 1.2, gain: 0.35 }); if (last) { setPage(0); onDone(); } else setPage(page + 1); };
  return <div className={`${s.lore} gui`} role="dialog" aria-modal="true" aria-labelledby="hq-lore-title" data-gui-overlay data-testid="hq-lore">
    <div key={page} className={s.lorePage}>
      <p className={s.loreCount} aria-hidden="true">{page + 1} / {pages.length}</p>
      <h2 id="hq-lore-title">{p.title}</h2>
      <p>{p.text}</p>
    </div>
    <div className={s.loreDots} aria-hidden="true">{pages.map((_, i) => <i key={i} data-on={i === page || undefined} />)}</div>
    <Button onClick={next} autoFocus data-testid="hq-lore-next">{last ? LORE_CARD.done : LORE_CARD.next}</Button>
  </div>;
}

const FLY_ICON: Record<FlyTarget, React.ReactNode> = {
  coins: <CurrencyIcon size={64} />, gems: <CurrencyIcon currency="gems" size={64} />,
  menu: <Menu size={52} aria-hidden />, mail: <Mail size={52} aria-hidden />, minimap: <MapIcon size={52} aria-hidden />,
};
/** Where each lives on screen (forced on while it flies there: DefaultIslandWorld), then anywhere in the top right. */
const FLY_TO: Record<FlyTarget, string> = {
  coins: '[data-hud-slot="coins"]', gems: '[data-hud-slot="coins"]', menu: '[data-testid="menu-dock"]',
  mail: '[data-testid="menu-dock"] [aria-label^="Mail"]', minimap: '[aria-label="Minimap"]',
};
/** The fly's beats (ms): up in the middle with its name, then off to its place, then a ring where it lands. */
const FLY = { pop: 1500, fly: 750, land: 650 } as const;
type Flight = { phase: "pop" | "fly" | "land"; dx: number; dy: number; k: number; ring: { x: number; y: number; w: number; h: number } | null };

/**
 * David's v2 review: "the coin icon pops in screen and screen darkens a lil and the coin moves to the coin slot and
 * same with gems ... same for things like menu, mailbox, and minimap". The icon pops up in the middle over a slightly
 * darker room, its name and what it's for under it; then it flies to its place on your screen, which rings once.
 */
export function FlyCard({ target, onDone }: { target: FlyTarget | null; onDone: () => void }) {
  const [f, setF] = useState<Flight>({ phase: "pop", dx: 0, dy: 0, k: 1, ring: null });
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);
  useEffect(() => {
    if (!target) return;
    setF({ phase: "pop", dx: 0, dy: 0, k: 1, ring: null });
    AudioManager.playSFX("blip3", { rate: 1.3, gain: 0.5 });
    const ts = [
      window.setTimeout(() => {
        const el = document.querySelector(FLY_TO[target]) ?? document.querySelector("[data-hud-right]"), r = el?.getBoundingClientRect();
        const cx = window.innerWidth / 2, cy = window.innerHeight * 0.42;
        const ring = r && r.width > 0 ? { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 } : null;
        const tx = r ? r.left + r.width / 2 : window.innerWidth - 80, ty = r ? r.top + r.height / 2 : 60;
        setF({ phase: "fly", dx: tx - cx, dy: ty - cy, k: Math.max(0.28, Math.min(0.6, (r ? Math.min(r.width, r.height) : 40) / 96)), ring });
        AudioManager.playSFX("blip2", { rate: 1.5, gain: 0.4 });
      }, FLY.pop),
      window.setTimeout(() => { setF(x => ({ ...x, phase: "land" })); AudioManager.playSFX("blip4", { rate: 1.4, gain: 0.45 }); }, FLY.pop + FLY.fly),
      window.setTimeout(() => done.current(), FLY.pop + FLY.fly + FLY.land),
    ];
    return () => ts.forEach(t => window.clearTimeout(t));
  }, [target]);
  if (!target) return null;
  const card = FLY_CARDS[target];
  return <div className={`${s.fly} gui`} data-phase={f.phase} data-testid="hq-fly" data-target={target} aria-live="polite">
    <div className={s.flyDim} aria-hidden="true" />
    <div className={s.flyIcon} style={{ "--dx": `${f.dx}px`, "--dy": `${f.dy}px`, "--k": f.k } as CSSProperties} aria-hidden="true"><span>{FLY_ICON[target]}</span></div>
    <p className={s.flyName}><b>{card.name}</b><span>{card.text}</span></p>
    {f.phase === "land" && f.ring && <i className={s.flyRing} style={{ left: f.ring.x, top: f.ring.y, width: f.ring.w, height: f.ring.h }} aria-hidden="true" />}
  </div>;
}
