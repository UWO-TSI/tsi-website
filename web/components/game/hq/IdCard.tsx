"use client";

/**
 * Your island ID (David's v2 review: "alice asks you for your info, like bday and stuff and she prints and stamps your
 * id"; v3: "the card itself is the overlay and you can hover and it tilts and button bottom that confirms it"). No
 * panel: the card is the overlay, large in the middle (the kit's CardOverlay and PrintedCard), your headshot on it
 * (IdHeadshot: your real avatar). You fill it in on the card itself: your world name, your birthday, where you're
 * from and a line about you (David's playtest: "ask for stuff that matters"), all existing profile fields (the world
 * name through /api/identity/name, the rest through PATCH /api/profile; birthday is private, read back only server side). One button under it: Print, and the card slides out of HQ's
 * printer and a stamp comes down on it; then Done. Hover it and it leans toward the pointer with a sheen. Only your
 * world name is ever on it. Signed out (a preview) nothing is saved. Copy: lib/game/arrival/hq/lines.ts ID_CARD.
 */
import { useEffect, useState, type FormEvent } from "react";
import { CardOverlay, DarkButton, PaperField, PrintedCard, StatusLine } from "@/components/gui/flat";
import { AudioManager } from "@/lib/game/audio";
import { ID_CARD } from "@/lib/game/arrival/hq/lines";
import { refreshIdentity } from "@/lib/game/identity";
import { refreshCard } from "@/lib/net/netStore";
import IdHeadshot from "./IdHeadshot";

/** The print's beats (ms): out of the slot, then the stamp, then Done. */
const PRINT_MS = 1500, STAMP_MS = 1300;
type Phase = "form" | "print" | "stamp" | "card";
interface Answers { name: string; birthday: string; from: string; about: string }

/** "March 14" from YYYY-MM-DD (the year stays off the card). */
export const birthdayLabel = (ymd: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-CA", { month: "long", day: "numeric" }) : "";
};

async function save(a: Answers, was: Answers, signedIn: boolean): Promise<boolean> {
  if (!signedIn) return true;
  try {
    if (a.name.trim() && a.name.trim() !== was.name) {
      const n = await fetch("/api/identity/name", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: a.name.trim() }) });
      if (!n.ok) return false;
      refreshCard(); await refreshIdentity();
    }
    const r = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthday: a.birthday || null, hometown: a.from.trim() || null, bio: a.about.trim() }) });
    return r.ok;
  } catch { return false; }
}

export default function IdCard({ open, name, signedIn, friendCode, onDone }: {
  open: boolean;
  /** Your world name (null signed out: a preview has none). */
  name: string | null; signedIn: boolean;
  /** Your friend code (null: no account to issue one for). */
  friendCode: string | null;
  onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("form");
  const [a, setA] = useState<Answers>({ name: name ?? "", birthday: "", from: "", about: "" });
  const [was, setWas] = useState<Answers>(a);
  const [saved, setSaved] = useState(true);
  // What the account already has (another device, an earlier visit).
  useEffect(() => {
    if (!open || !signedIn) return;
    let live = true;
    void fetch("/api/profile").then(r => (r.ok ? r.json() : null)).then((d: { profile?: { birthday?: string | null; hometown?: string | null; bio?: string | null } } | null) => {
      if (!live || !d?.profile) return;
      const got = { name: name ?? "", birthday: d.profile.birthday?.slice(0, 10) ?? "", from: d.profile.hometown ?? "", about: d.profile.bio ?? "" };
      setA(got); setWas(got);
    }).catch(() => {});
    return () => { live = false; };
  }, [open, signedIn, name]);
  if (!open) return null;

  const print = (e: FormEvent) => {
    e.preventDefault();
    setPhase("print");
    AudioManager.playSFX("blip1", { rate: 0.8, gain: 0.4 });
    void save(a, was, signedIn).then(ok => { setSaved(ok); if (ok) setWas(a); });
    // The stamper comes down; its thump lands with it (moments.module.css: the hit at 0.3 s).
    window.setTimeout(() => setPhase("stamp"), PRINT_MS);
    window.setTimeout(() => AudioManager.playSFX("click", { rate: 0.6, gain: 0.9 }), PRINT_MS + 300);
    window.setTimeout(() => { setPhase("card"); AudioManager.playSFX("confirm", { gain: 0.5 }); }, PRINT_MS + STAMP_MS);
  };
  const shownName = a.name.trim() || name || ID_CARD.noName;
  const form = phase === "form", stamped = phase === "stamp" || phase === "card";
  // Filling in: the rows are write-in lines on the card; printed: what you wrote.
  const rows: [string, React.ReactNode][] = form ? [
    [ID_CARD.name, <PaperField key="n" form="hq-id-form" value={a.name} placeholder={ID_CARD.noName} maxLength={24} autoFocus aria-label={ID_CARD.name} title={ID_CARD.nameHint}
      onChange={e => setA({ ...a, name: e.target.value })} data-testid="hq-id-name" />],
    [ID_CARD.birthday, <PaperField key="b" form="hq-id-form" type="date" value={a.birthday} max={new Date().toISOString().slice(0, 10)} min="1900-01-01" aria-label={ID_CARD.birthday}
      title={ID_CARD.birthdayHint} onChange={e => setA({ ...a, birthday: e.target.value })} data-testid="hq-id-birthday" />],
    [ID_CARD.from, <PaperField key="f" form="hq-id-form" value={a.from} maxLength={60} placeholder={ID_CARD.fromSample} aria-label={ID_CARD.from} title={ID_CARD.fromHint}
      onChange={e => setA({ ...a, from: e.target.value })} data-testid="hq-id-from" />],
    [ID_CARD.about, <PaperField key="a" form="hq-id-form" value={a.about} maxLength={80} placeholder={ID_CARD.aboutSample} aria-label={ID_CARD.about} title={ID_CARD.aboutHint}
      onChange={e => setA({ ...a, about: e.target.value })} data-testid="hq-id-about" />],
  ] : [
    [ID_CARD.name, shownName], [ID_CARD.birthday, birthdayLabel(a.birthday) || ID_CARD.blank], [ID_CARD.from, a.from.trim() || ID_CARD.blank],
    [ID_CARD.about, a.about.trim() || ID_CARD.blank], [ID_CARD.code, <span key="code" data-testid="hq-friend-code">{friendCode ?? ID_CARD.codeLater}</span>],
  ];
  return <CardOverlay open={open} label={ID_CARD.title} testId="hq-id" dataset={{ "data-phase": phase }}
    action={form ? <form id="hq-id-form" onSubmit={print}><DarkButton type="submit" data-testid="hq-id-print">{ID_CARD.print}</DarkButton></form>
      : phase === "card" ? <>
        {!saved && <StatusLine error>{ID_CARD.unsaved}</StatusLine>}
        <DarkButton onClick={() => { setPhase("form"); onDone(); }} autoFocus data-testid="hq-id-done">{ID_CARD.done}</DarkButton>
      </> : null}>
    <PrintedCard large tilt band={ID_CARD.island} kind={ID_CARD.kind} picture={<IdHeadshot />} printing={phase === "print"} testId="hq-id-card"
      stamp={stamped ? { top: ID_CARD.island, word: ID_CARD.stamp } : null} rows={rows} />
  </CardOverlay>;
}
