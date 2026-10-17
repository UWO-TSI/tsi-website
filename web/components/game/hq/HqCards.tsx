"use client";

/**
 * The HQ visit's cards (row 312, specs/hq-onboarding.md), paper sheets from the GUI kit over the room: the island
 * register at the front desk (your world name to sign with, then the friend code and the mailbox it issued, real data
 * where there is some), where a real event's check-in code goes (the existing flow: the QR at the door), and the
 * Founder's plaque, blank until David writes it. Copy: lib/game/arrival/hq/lines.ts (drafts).
 */
import { useState } from "react";
import { BookUser, CalendarCheck, Landmark, Mail, QrCode, UserPlus } from "lucide-react";
import { Button, Sheet } from "@/components/gui";
import { AudioManager } from "@/lib/game/audio";
import { CHECKIN_CARD, FOUNDER_PLAQUE, PLAQUE_CARD, REGISTER_CARD } from "@/lib/game/arrival/hq/lines";
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
