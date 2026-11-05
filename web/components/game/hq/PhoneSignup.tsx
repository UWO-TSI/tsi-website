"use client";

/**
 * A pitch, not shipped (round 13, David on round 12: "what if we scratch the id idea and alice gives them a phone
 * instead which makes them make a profile on the phone and has the other apps? thoughts?"). Dev only, behind
 * ?idphone=1: at the ID's beat Alice hands you the phone instead. It comes up bottom right, starts up, you fill in your
 * profile on its screen (the ID's fields: world name, pronouns, birthday, a line about you; saved the ID's way,
 * `saveId`), it's stamped on the glass, and it shows its home screen with your Profile app before it's put away.
 * Nothing about the ID changes until David picks. Copy: ID_CARD and PHONE_PITCH (lib/game/arrival/hq/lines.ts).
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Phone, box, frame, sprite, text, textWidth, type Ink, type PhoneView } from "@/components/gui/flat";
import { SCREEN } from "@/components/gui/flat/phoneMotion";
import { AudioManager } from "@/lib/game/audio";
import { ID_CARD, PHONE_PITCH } from "@/lib/game/arrival/hq/lines";
import { birthdayLabel, saveId, type Answers } from "./IdCard";

/** Its beats (ms): starting up, the stamp coming down, the home screen, then put away. */
const BOOT_MS = 1900, STAMP_MS = 1400, HOME_MS = 1600, AWAY_MS = 900;
type Phase = "boot" | "form" | "stamp" | "stamped" | "home";
type Field = "name" | "pronouns" | "birthday" | "about";
const FIELDS: { key: Field; label: string; sample: string }[] = [
  { key: "name", label: ID_CARD.name, sample: ID_CARD.noName },
  { key: "pronouns", label: ID_CARD.pronouns, sample: "they/them" },
  { key: "birthday", label: ID_CARD.birthday, sample: "Month day" },
  { key: "about", label: ID_CARD.about, sample: ID_CARD.aboutSample },
];
/** The form's rows in screen pixels: each a label over a field, then the friend code and the button. */
const ROW = (i: number) => 19 + i * 22, FIELD = (i: number): [number, number, number, number] => [6, ROW(i) + 8, SCREEN.w - 12, 13];
const BUTTON: [number, number, number, number] = [26, SCREEN.h - 19, SCREEN.w - 52, 13];
const CLOVER = ["ll.ll", "lldll", "..d..", "lldll", "ll.ll"];

/** A sprite drawn `k` times its size (the start-up's logo growing on the pixel grid). */
function big(g: CanvasRenderingContext2D, rows: readonly string[], cx: number, cy: number, k: number, ink: Ink) {
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    const fill = ink[ch as keyof Ink];
    if (fill) { g.fillStyle = fill; g.fillRect(Math.round(cx - (row.length * k) / 2 + c * k), Math.round(cy - (rows.length * k) / 2 + r * k), k, k); }
  }));
}
/** What a field shows: its value (the end of it while you type), or its sample. */
function shown(f: Field, a: Answers, typing: boolean, room: number) {
  let v = f === "birthday" ? birthdayLabel(a.birthday) : a[f].trim();
  if (!v) return { v: FIELDS.find(x => x.key === f)!.sample, sample: true };
  while (textWidth(v) > room) v = typing ? v.slice(1) : v.slice(0, -1);
  return { v, sample: false };
}

function drawPhase(g: CanvasRenderingContext2D, ink: Ink, t: number, phase: Phase, a: Answers, focus: Field | null, code: string, hot: boolean) {
  const { w: W, h: H } = SCREEN;
  g.setTransform(4, 0, 0, 4, 0, 0);
  g.imageSmoothingEnabled = false;
  frame(g, 1, 1, W - 2, H - 2, [5, 3, 2, 1, 1], ink.o, ink.w, ink.p);
  if (phase === "boot") {
    // Starting up: the clover grows on the pixel grid, then hello, then the island's name types itself in.
    const k = Math.max(0, Math.min(5, Math.floor((t - 0.15) / 0.07)));
    if (k) big(g, CLOVER, W / 2, 58, k, ink);
    const hello = PHONE_PITCH.hello, isle = ID_CARD.island;
    if (t > 0.7) text(g, hello.slice(0, Math.floor((t - 0.7) / 0.06)), W / 2, 84, ink.o, true);
    if (t > 1.05) text(g, isle.slice(0, Math.floor((t - 1.05) / 0.04)), W / 2, 96, ink.d, true);
    return;
  }
  // The shake as the stamp lands.
  const s = phase === "stamp" && t > 0.2 && t < 0.4 ? (Math.floor(t * 40) % 2 ? 1 : -1) : 0;
  g.setTransform(4, 0, 0, 4, s * 4, 0);
  box(g, 4, 4, W - 8, 11, [2, 1], ink.o);
  text(g, PHONE_PITCH.title, W / 2, 6, ink.w, true);
  FIELDS.forEach((f, i) => {
    const [x, y, w, h] = FIELD(i), on = focus === f.key && phase === "form";
    text(g, f.label, x + 1, ROW(i), ink.d);
    frame(g, x, y, w, h, [1], ink.o, on ? ink.l : ink.w, on ? ink.s : ink.w);
    const { v, sample } = shown(f.key, a, on, w - 8);
    text(g, v, x + 3, y + 3, sample ? ink.q : ink.o);
    if (on && Math.floor(t * 2.4) % 2 === 0) { g.fillStyle = ink.o; g.fillRect(x + 3 + (sample ? 0 : textWidth(v) + 1), y + 3, 1, 7); }
  });
  text(g, ID_CARD.code, 7, ROW(4) + 1, ink.d);
  text(g, code, W - 7 - textWidth(code), ROW(4) + 1, ink.o);
  const [bx, by, bw, bh] = BUTTON, done = phase !== "form";
  frame(g, bx, by, bw, bh, [2, 1], ink.o, hot || done ? ink.l : ink.w, hot || done ? ink.s : ink.w);
  text(g, done ? ID_CARD.done : PHONE_PITCH.stampIt, bx + bw / 2, by + 3, ink.o, true);
  if (phase === "stamp" || phase === "stamped") {
    // The stamp: it comes down big and lands, in the phone's deep lime.
    const k = phase === "stamped" || t > 0.2 ? 1 : 1 + (0.2 - Math.max(0, t)) * 6, word = ID_CARD.stamp.toUpperCase();
    const sw = textWidth(word) + 18, sh = 17, cx = W / 2, cy = 70;
    g.save(); g.translate(cx, cy); g.scale(k, k);
    g.globalAlpha = Math.min(1, t * 8);
    box(g, -sw / 2, -sh / 2, sw, sh, [2, 1], ink.d);
    box(g, -sw / 2 + 1, -sh / 2 + 1, sw - 2, sh - 2, [1], ink.w);
    box(g, -sw / 2 + 2, -sh / 2 + 2, sw - 4, sh - 4, [], ink.d);
    sprite(g, CLOVER.map(r => r.replace(/[ld]/g, "w")), Math.round(-sw / 2 + 4), -2, ink);
    text(g, word, Math.round(-sw / 2 + 12), -3, ink.w);
    g.restore();
  }
}

export default function PhoneSignup({ open, name, signedIn, friendCode, onDone }: {
  open: boolean; name: string | null; signedIn: boolean; friendCode: string | null; onDone: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("boot");
  const [a, setA] = useState<Answers>({ name: name ?? "", pronouns: "", birthday: "", about: "" });
  const [focus, setFocus] = useState<Field | null>(null);
  const [hot, setHot] = useState(false);
  useEffect(() => {
    if (!open) return;
    AudioManager.playSFX("blip1", { rate: 1.2, gain: 0.35 });
    const t = window.setTimeout(() => setPhase("form"), BOOT_MS);
    return () => window.clearTimeout(t);
  }, [open]);
  const stamp = () => {
    setPhase("stamp"); setFocus(null);
    void saveId(a, { name: name ?? "", pronouns: "", birthday: "", about: "" }, signedIn);
    window.setTimeout(() => AudioManager.playSFX("click", { rate: 0.6, gain: 0.9 }), 200);
    window.setTimeout(() => { AudioManager.playSFX("confirm", { gain: 0.5 }); setPhase("stamped"); }, STAMP_MS);
  };
  const [gone, setGone] = useState(false);
  // The first field (then Done) takes the keys, without scrolling the game to it (it's laid on the tilted glass).
  const first = useRef<HTMLInputElement & HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus({ preventScroll: true }); }, [phase]);
  const finish = () => {
    setPhase("home");
    window.setTimeout(() => setGone(true), HOME_MS);
    window.setTimeout(onDone, HOME_MS + AWAY_MS);
  };
  const at = ([x, y, w, h]: readonly number[]): CSSProperties => ({ position: "absolute", left: x, top: y, width: w, height: h, opacity: 0, pointerEvents: "auto", padding: 0, border: 0, fontSize: 8 });
  const code = friendCode ?? PHONE_PITCH.noCode;
  const view: PhoneView | undefined = phase === "home" ? undefined : {
    id: phase === "stamped" ? "stamp" : phase,
    moving: phase !== "stamped",
    draw: (g, ink, t) => drawPhase(g, ink, t, phase, a, focus, code, hot),
    controls: phase === "form" ? <>
      {FIELDS.map((f, i) => <input key={f.key} style={at(FIELD(i))} aria-label={f.label} data-testid={`hq-id-${f.key}`} value={a[f.key]}
        type={f.key === "birthday" ? "date" : "text"} maxLength={f.key === "about" ? 80 : 24} ref={i === 0 ? first : undefined}
        onFocus={() => setFocus(f.key)} onBlur={() => setFocus(x => (x === f.key ? null : x))} onChange={e => setA({ ...a, [f.key]: e.target.value })} />)}
      <button type="button" style={at(BUTTON)} aria-label={PHONE_PITCH.stampIt} data-testid="hq-id-print" onClick={stamp} onPointerEnter={() => setHot(true)} onPointerLeave={() => setHot(false)} />
    </> : phase === "stamped" ? <button type="button" style={at(BUTTON)} aria-label={ID_CARD.done} data-testid="hq-id-done" onClick={finish} ref={first} /> : null,
  };
  // After the stamp: its home screen, with your profile among the apps, then it's put away.
  const apps = useMemo(() => [{ id: "profile", label: PHONE_PITCH.app, onOpen: () => {} }], []);
  return <Phone open={open && !gone} apps={apps} view={view} onClose={() => {}} hint="X" testId="phone-signup" />;
}
