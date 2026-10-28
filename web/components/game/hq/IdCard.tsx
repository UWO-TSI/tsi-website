"use client";

/**
 * Your island ID (David's v2 review: "this is you making your id, alice asks you for your info, like bday and stuff and
 * she prints and stamps your id and it shows on screen and you can edit or done"). Her form first: your world name,
 * your birthday and a spirit animal, all existing profile fields (the world name through /api/identity/name, the rest
 * through PATCH /api/profile; birthday is private, read back only server side). Print: the card slides out of HQ's
 * printer, a stamp comes down on it, and it's yours on screen with Edit and Done. Only your world name is ever on it.
 * Signed out (a preview) nothing is saved. Copy: lib/game/arrival/hq/lines.ts ID_CARD.
 */
import { useEffect, useState, type FormEvent } from "react";
import { Field } from "@/components/gui";
import { DarkButton, GhostButton, PrintedCard, Spotlight, StatusLine } from "@/components/gui/flat";
import { AudioManager } from "@/lib/game/audio";
import { ID_CARD } from "@/lib/game/arrival/hq/lines";
import { refreshIdentity } from "@/lib/game/identity";
import { refreshCard } from "@/lib/net/netStore";

/** The print's beats (ms): out of the slot, then the stamp, then Edit and Done. */
const PRINT_MS = 1500, STAMP_MS = 650;
type Phase = "form" | "print" | "stamp" | "card";
interface Answers { name: string; birthday: string; spirit: string }

/** "March 14" from YYYY-MM-DD (the year stays off the card). */
export const birthdayLabel = (ymd: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toLocaleDateString("en-CA", { month: "long", day: "numeric" }) : "";
};
const today = () => new Date().toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" });

async function save(a: Answers, was: Answers, signedIn: boolean): Promise<boolean> {
  if (!signedIn) return true;
  try {
    if (a.name.trim() && a.name.trim() !== was.name) {
      const n = await fetch("/api/identity/name", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: a.name.trim() }) });
      if (!n.ok) return false;
      refreshCard(); await refreshIdentity();
    }
    const r = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birthday: a.birthday || null, spirit_animal: a.spirit.trim() || null }) });
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
  const [a, setA] = useState<Answers>({ name: name ?? "", birthday: "", spirit: "" });
  const [was, setWas] = useState<Answers>(a);
  const [saved, setSaved] = useState(true);
  // What the account already has (another device, an earlier visit).
  useEffect(() => {
    if (!open || !signedIn) return;
    let live = true;
    void fetch("/api/profile").then(r => (r.ok ? r.json() : null)).then((d: { profile?: { birthday?: string | null; spirit_animal?: string | null } } | null) => {
      if (!live || !d?.profile) return;
      const got = { name: name ?? "", birthday: d.profile.birthday?.slice(0, 10) ?? "", spirit: d.profile.spirit_animal ?? "" };
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
    window.setTimeout(() => { setPhase("stamp"); AudioManager.playSFX("click", { rate: 0.7, gain: 0.8 }); }, PRINT_MS);
    window.setTimeout(() => { setPhase("card"); AudioManager.playSFX("confirm", { gain: 0.5 }); }, PRINT_MS + STAMP_MS);
  };
  const shownName = a.name.trim() || name || ID_CARD.noName;
  const form = phase === "form", stamped = phase === "stamp" || phase === "card";
  return <Spotlight open={open} label={ID_CARD.title} eyebrow={ID_CARD.eyebrow} title={ID_CARD.title} testId="hq-id" dataset={{ "data-phase": phase }}
    footer={form ? <DarkButton form="hq-id-form" type="submit" data-testid="hq-id-print">{ID_CARD.print}</DarkButton>
      : phase === "card" ? <>
        <GhostButton onClick={() => setPhase("form")} data-testid="hq-id-edit">{ID_CARD.edit}</GhostButton>
        <DarkButton onClick={() => { setPhase("form"); onDone(); }} autoFocus data-testid="hq-id-done">{ID_CARD.done}</DarkButton>
      </> : null}>
    {form ? <form id="hq-id-form" onSubmit={print} style={{ display: "grid", gap: 12, width: "min(340px, calc(100vw - 80px))" }}>
      <Field label={ID_CARD.name} hint={ID_CARD.nameHint} value={a.name} placeholder={ID_CARD.noName} maxLength={24} autoFocus
        onChange={e => setA({ ...a, name: e.target.value })} data-testid="hq-id-name" />
      <Field label={ID_CARD.birthday} hint={ID_CARD.birthdayHint} type="date" value={a.birthday} max={new Date().toISOString().slice(0, 10)} min="1900-01-01"
        onChange={e => setA({ ...a, birthday: e.target.value })} data-testid="hq-id-birthday" />
      <Field label={ID_CARD.spirit} hint={ID_CARD.spiritHint} value={a.spirit} maxLength={40} placeholder="Sea otter"
        onChange={e => setA({ ...a, spirit: e.target.value })} data-testid="hq-id-spirit" />
    </form> : <>
      <PrintedCard band={ID_CARD.island} kind={ID_CARD.kind} picture={shownName.slice(0, 1).toUpperCase()} printing={phase === "print"} testId="hq-id-card"
        stamp={stamped ? { top: ID_CARD.island, word: ID_CARD.stamp } : null}
        rows={[[ID_CARD.name, shownName], [ID_CARD.birthday, birthdayLabel(a.birthday) || "·"], [ID_CARD.spirit, a.spirit.trim() || ID_CARD.spiritNone],
          [ID_CARD.since, today()], [ID_CARD.code, <span key="code" data-testid="hq-friend-code">{friendCode ?? ID_CARD.codeLater}</span>]]} />
      {phase === "card" && !saved && <StatusLine error>{ID_CARD.unsaved}</StatusLine>}
    </>}
  </Spotlight>;
}
