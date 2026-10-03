"use client";

/**
 * The Oracle reading as an in-world sheet (rows 205, 206). One statement at a
 * time on a five-step scale (keys 1–5), sent to /api/oracle/answer in batches
 * of ten; the keeper speaks on each beat the route returns (every ~10 items,
 * also shown over the keeper in the temple). Even dichotomies get the
 * route's forced-choice tie-breakers. Unfinished readings resume.
 */
import { useEffect, useRef, useState } from "react";
import { FAMILIES, SCALE, keeperReaction } from "@/lib/game/oracle/family";
import { OracleError, answerBatch, finishReading, oracleStatus, startReading } from "@/lib/game/oracle/client";
import type { AttemptView, OracleStatus, ResultView } from "@/lib/oracle/service";
import type { TieBreaker } from "@/lib/oracle/items";
import IslandSheet from "../IslandSheet";
import { SignInText } from "@/components/gui";
import { Amount } from "@/components/economy/Amount";
import styles from "../DefaultIslandWorld.module.css";

const BATCH = 10;
const INTRO = "Answer as you are on an ordinary day. The crystal does the rest.";

export default function OracleQuizSheet({ open, onClose, onResult, onPath, embedded = false }: {
  open: boolean; onClose: () => void; onResult: (result: ResultView) => void;
  /** Opens the path sheet (level-10 subclass, loadout, stats) once the family is known. */
  onPath?: () => void;
  /** Inside another sheet's chrome (GameWorld's OverlaySheet): no own frame or close button. */
  embedded?: boolean;
}) {
  const [status, setStatus] = useState<OracleStatus | null>(null);
  const [reading, setReading] = useState<AttemptView | null>(null);
  const [answered, setAnswered] = useState<Record<string, number>>({});
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [ties, setTies] = useState<TieBreaker[] | null>(null);
  const [tieAnswers, setTieAnswers] = useState<Record<string, string>>({});
  const [keeper, setKeeper] = useState(INTRO);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    oracleStatus().then(s => { if (alive) setStatus(s); }).catch(e => { if (alive) setNote(e instanceof OracleError ? e.message : null); });
    return () => { alive = false; };
  }, [open]);

  const fail = (e: unknown) => { setNote(e instanceof OracleError ? e.message : "The Oracle is quiet right now."); setBusy(false); };

  const begin = async () => {
    setBusy(true); setNote("The crystal is waking up…");
    try {
      const r = await startReading();
      setReading(r); setAnswered(r.answered); setSent(new Set(Object.keys(r.answered))); setTies(null); setTieAnswers({});
      setKeeper(r.resumed ? "Welcome back. We'll pick up where you left off." : INTRO); setNote(null);
    } catch (e) { fail(e); }
    setBusy(false);
  };

  const finish = async (reading: AttemptView, tieChoice?: Record<string, string>) => {
    setBusy(true); setNote("The crystal is deciding…");
    try {
      const out = await finishReading(reading.attempt_id, tieChoice);
      if (out.status === "needs_tie_breakers") { setTies(out.tie_breakers); setKeeper("Perfectly balanced on a few. Pick the closer one."); setNote(null); }
      else { setReading(null); setTies(null); setNote(null); onResult(out); }
    } catch (e) { fail(e); }
    setBusy(false);
  };

  const answer = async (value: number) => {
    if (!reading || busy) return;
    const item = reading.items.find(i => !(i.id in answered));
    if (!item) return;
    const next = { ...answered, [item.id]: value };
    setAnswered(next);
    const pending = Object.keys(next).filter(id => !sent.has(id));
    const done = Object.keys(next).length === reading.total;
    if (pending.length < BATCH && !done) return;
    setBusy(true);
    try {
      const p = await answerBatch(reading.attempt_id, pending.map(id => ({ item_id: id, value: next[id] })));
      setSent(new Set([...sent, ...pending]));
      const line = keeperReaction(p.keeper_beat);
      if (line) { setKeeper(line); window.dispatchEvent(new CustomEvent("tsi:oracle-keeper", { detail: { line } })); }
      setBusy(false);
      if (p.answered === p.total) await finish(reading);
    } catch (e) { fail(e); }
  };

  const answerRef = useRef(answer);
  useEffect(() => { answerRef.current = answer; });
  useEffect(() => {
    if (!open || !reading || ties) return;
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= 5 && !e.repeat) { e.preventDefault(); void answerRef.current(SCALE[n - 1].value); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, reading, ties]);

  const count = Object.keys(answered).length;
  const item = reading?.items.find(i => !(i.id in answered));
  const lastUnsent = reading ? Object.keys(answered).filter(id => !sent.has(id)).pop() : undefined;
  const next = status?.next_reading;
  // E at the altar opens it and E closes it; the Oracle keeps its lavender (tone) in the kit's paper.
  return <IslandSheet open={open} title="The Oracle" onClose={onClose} embedded={embedded} className={embedded ? styles.oracleEmbedded : undefined} testId="oracle-quiz" keys="e" tone="oracle">
    <div className={styles.keeperLine}><span className={styles.keeperFace} aria-hidden="true" /><p role="status">{note ? <SignInText text={note} /> : !reading && status?.family ? `You're ${status.family}. The light remembers.` : keeper}</p></div>
    {ties && reading ? <>
      {ties.map(t => <fieldset key={t.id} className={styles.tieBreaker}><legend>{t.prompt}</legend>
        {t.options.map(o => <button key={o.pole} aria-pressed={tieAnswers[t.id] === o.pole} onClick={() => setTieAnswers(a => ({ ...a, [t.id]: o.pole }))}>{o.label}</button>)}
      </fieldset>)}
      <button className={styles.oracleBegin} disabled={busy || ties.some(t => !tieAnswers[t.id])} onClick={() => void finish(reading, tieAnswers)}>Reveal</button>
    </> : reading && item ? <>
      <div className={styles.oracleProgress} aria-label={`Question ${count + 1} of ${reading.total}`}><span style={{ width: `${(count / reading.total) * 100}%` }} /></div>
      <p className={styles.oracleCount}>{count + 1} / {reading.total}</p>
      <p className={styles.oracleStatement} data-item={item.id}>{item.text}</p>
      <div className={styles.oracleScale} role="group" aria-label="How much is this like you?">
        {SCALE.map((s, i) => <button key={s.value} onClick={() => void answer(s.value)} disabled={busy}><kbd>{i + 1}</kbd>{s.label}</button>)}
      </div>
      <button className={styles.oracleBack} disabled={!lastUnsent || busy} onClick={() => setAnswered(a => { const n = { ...a }; if (lastUnsent) delete n[lastUnsent]; return n; })}>Back</button>
    </> : status?.family ? <>
      <p className={styles.oracleResult} style={{ ["--family" as string]: FAMILIES[status.family].color }}><b>{status.family}</b> · {status.type}<br /><small>{FAMILIES[status.family].blurb}</small></p>
      {next?.kind === "cooldown"
        ? <small className={styles.hint}>The crystal needs rest. You can ask again {next.available_at ? new Date(next.available_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" }) : "soon"}.</small>
        : <><button className={styles.oracleBegin} onClick={() => void begin()} disabled={busy}>{next?.kind === "resume" ? "Continue your reading" : <>Ask again · <Amount n={next?.fee ?? 0} /></>}</button>
          <small className={styles.hint}>A new reading replaces your family. Auras you&apos;ve unlocked stay.</small></>}
      {onPath && <button className={styles.oracleBegin} data-testid="oracle-path" onClick={onPath}>Your path · subclass, abilities, stats</button>}
    </> : <>
      <p>{status?.open_attempt ? `You're ${status.open_attempt.answered} of ${status.open_attempt.total} in.` : "64 short statements. There are no right answers, and you can take a break any time."}</p>
      <button className={styles.oracleBegin} onClick={() => void begin()} disabled={busy}>{status?.open_attempt ? "Continue" : "Begin"}</button>
    </>}
  </IslandSheet>;
}
