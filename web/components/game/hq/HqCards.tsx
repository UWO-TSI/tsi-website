"use client";

/**
 * The HQ visit's cards (row 312, specs/hq-onboarding.md), from the GUI kit over the room: where a gathering's check-in
 * code goes (the existing flow: the QR at the door), the Founder's plaque (blank until David writes it), the lore
 * overlay (the island, a page at a time, over a dimmed room) and the fly card (an icon up in the middle, then off to
 * its place on screen; David's v2 review). Your island ID is IdCard.tsx. Copy: lib/game/arrival/hq/lines.ts (drafts).
 */
import { useState } from "react";
import { CalendarCheck, Landmark, Mail, Map as MapIcon, Menu, QrCode } from "lucide-react";
import { Button, Sheet } from "@/components/gui";
import { FlyIn } from "@/components/gui/flat";
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
/** Where each lives on screen (forced on while it flies there: DefaultIslandWorld). */
const FLY_TO: Record<FlyTarget, readonly string[]> = {
  coins: ['[data-hud-slot="coins"]', "[data-hud-right]"], gems: ['[data-hud-slot="coins"]', "[data-hud-right]"], menu: ['[data-testid="menu-dock"]'],
  mail: ['[data-testid="menu-dock"] [aria-label^="Mail"]', '[data-testid="menu-dock"]'], minimap: ['[aria-label="Minimap"]', "[data-hud-right]"],
};
const FLY_SOUND = { pop: ["blip3", 1.3], fly: ["blip2", 1.5], land: ["blip4", 1.4] } as const;

/**
 * David's v2 review: "the coin icon pops in screen and screen darkens a lil and the coin moves to the coin slot and
 * same with gems ... same for things like menu, mailbox, and minimap". The kit's FlyIn: up in the middle with its name
 * and what it's for, then off to its place on your screen, which rings once.
 */
export function FlyCard({ target, onDone }: { target: FlyTarget | null; onDone: () => void }) {
  if (!target) return null;
  const card = FLY_CARDS[target];
  return <FlyIn key={target} icon={FLY_ICON[target]} name={card.name} text={card.text} to={FLY_TO[target]} onDone={onDone} testId="hq-fly"
    onBeat={b => AudioManager.playSFX(FLY_SOUND[b][0], { rate: FLY_SOUND[b][1], gain: 0.45 })} />;
}
