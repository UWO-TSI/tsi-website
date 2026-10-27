"use client";

/**
 * The HQ visit's cards (row 312, specs/hq-onboarding.md), paper sheets from the GUI kit over the room: the island
 * register at the front desk (your world name to sign with, then the friend code and the mailbox it issued, real data
 * where there is some), where a real event's check-in code goes (the existing flow: the QR at the door), and the
 * Founder's plaque, blank until David writes it; and t-hq's lore overlay (Tethos, a page at a time, over a dimmed room)
 * and the coins-and-merch card. Copy: lib/game/arrival/hq/lines.ts (drafts).
 */
import { useState } from "react";
import { BookUser, CalendarCheck, Landmark, Mail, QrCode, Shirt, Sparkles, UserPlus } from "lucide-react";
import { Button, Sheet } from "@/components/gui";
import { CurrencyIcon } from "@/components/economy/Amount";
import { AudioManager } from "@/lib/game/audio";
import { CHECKIN_CARD, FOUNDER_PLAQUE, LORE_CARD, MERCH_CARD, PLAQUE_CARD, REGISTER_CARD } from "@/lib/game/arrival/hq/lines";
import { CHECK_IN_ORIGIN } from "@/lib/portal/checkIn";
import s from "./HqCards.module.css";

/** The register: sign as your world name; then what signing issued, a line each. `onDone` once it's signed and closed. */
export function RegisterCard({ open, name, friendCode, letters, onDone }: {
  /** Your world name (null signed out: a preview has none). */
  open: boolean; name: string | null;
  /** Your friend code (null: no account to issue one for). */
  friendCode: string | null;
  /** Letters waiting in your mailbox (null: not known). */
  letters: number | null;
  onDone: () => void;
}) {
  const [signed, setSigned] = useState(false);
  const close = () => { if (signed) { setSigned(false); onDone(); } };
  return <Sheet open={open} onClose={close} title={REGISTER_CARD.title} eyebrow={REGISTER_CARD.eyebrow} icon={<BookUser size={20} />} size="sm" tone="butter" testId="hq-register"
    footer={signed
      ? <Button onClick={close} data-testid="hq-register-done">{REGISTER_CARD.done}</Button>
      : <Button onClick={() => { setSigned(true); AudioManager.playSFX("confirm", { rate: 1.1, gain: 0.4 }); }} data-testid="hq-register-sign">{REGISTER_CARD.sign}</Button>}>
    <div className={s.register}>
      <p className={s.label}>{signed ? REGISTER_CARD.signed : REGISTER_CARD.signAs}</p>
      <p className={s.signature} data-signed={signed || undefined} data-none={name ? undefined : ""}>{name ?? REGISTER_CARD.noName}</p>
      {!signed && <p className={s.note}>{REGISTER_CARD.note}</p>}
      {signed && <ul className={s.issued}>
        <li style={{ animationDelay: "120ms" }}><UserPlus size={17} aria-hidden /><span>{REGISTER_CARD.friendCode}</span><b data-testid="hq-friend-code">{friendCode ?? REGISTER_CARD.friendCodeLater}</b></li>
        <li style={{ animationDelay: "520ms" }}><Mail size={17} aria-hidden /><span>{REGISTER_CARD.mailbox}</span><b>{REGISTER_CARD.mailboxAt}{letters ? ` · ${REGISTER_CARD.letters(letters)}` : ""}</b></li>
      </ul>}
    </div>
  </Sheet>;
}

/** Where a real event's check-in code goes: the QR at the door, which opens the check-in page. */
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

const MERCH_ICONS: Record<string, React.ReactNode> = { coins: <CurrencyIcon size={22} />, gems: <CurrencyIcon currency="gems" size={22} />, xp: <Sparkles size={20} aria-hidden /> };
/** Coins, gems and experience, and that they trade for real merch (t-hq). Never a rate to real money. */
export function MerchCard({ open, onDone }: { open: boolean; onDone: () => void }) {
  return <Sheet open={open} onClose={onDone} title={MERCH_CARD.title} eyebrow={MERCH_CARD.eyebrow} icon={<Shirt size={20} />} size="sm" tone="butter" testId="hq-merch"
    footer={<Button onClick={onDone} data-testid="hq-merch-done">{MERCH_CARD.done}</Button>}>
    <ul className={s.issued}>
      {MERCH_CARD.rows.map((r, i) => <li key={r.icon} className={s.currency} style={{ animationDelay: `${120 + i * 160}ms` }}>{MERCH_ICONS[r.icon]}<span>{r.name}</span><b>{r.text}</b></li>)}
    </ul>
    <p className={s.note}>{MERCH_CARD.note}</p>
  </Sheet>;
}
