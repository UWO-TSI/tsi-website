"use client";

/**
 * Oracle reading (rows 205-207) as a sheet page: 64 statements on a 5-point
 * scale, saved in batches, resumable; tie-breakers when a side is exactly
 * even; the family reveal. The island agent's in-world temple sheet can use
 * the same transport and replace this presentation.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { COINS } from "@/lib/economy";
import type { AttemptView, FinishOutcome, OracleStatus } from "@/lib/oracle/service";
import { httpOracleTransport, OracleRequestError, type OracleTransport } from "@/lib/oracle/transport";
import s from "./oracle.module.css";

const SCALE = [
  { v: -2, label: "Strongly disagree" },
  { v: -1, label: "Disagree" },
  { v: 0, label: "Not sure" },
  { v: 1, label: "Agree" },
  { v: 2, label: "Strongly agree" },
];
const KEEPER = [
  "The mist stirs. Keep going.",
  "Twenty answers. I can see the outline of you.",
  "Thirty. The colours are starting to separate.",
  "Forty. You answer honestly; that makes my work easy.",
  "Fifty. Almost there. The light is gathering.",
  "Sixty. A few more and the Oracle will speak.",
];
const HEX: Record<string, string> = { purple: "#8e6cc9", blue: "#4a8fd4", yellow: "#d9a93a", green: "#5e9e6a" };
const BLURB: Record<string, string> = {
  Arcane: "Patterns, ideas and the long view. You see the shape of a problem before its pieces.",
  Ranger: "Steady, prepared and dependable. The island runs because people like you keep it running.",
  Vanguard: "Quick hands and a bias to action. You learn by doing, and you do it now.",
  Warden: "Warmth and conviction. You notice people, and you stand up for them.",
};
const POLE: Record<string, string> = { E: "Outward", I: "Inward", S: "Concrete", N: "Abstract", T: "Logic", F: "Values", J: "Planned", P: "Open" };
const BATCH = 8;
const KEY_STORE = "tsi.oracle.startKey";

function newKey() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

export default function OracleReading({ transport = httpOracleTransport }: { transport?: OracleTransport }) {
  const [status, setStatus] = useState<OracleStatus | null>(null);
  const [attempt, setAttempt] = useState<AttemptView | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [beat, setBeat] = useState<number | null>(null);
  const [result, setResult] = useState<FinishOutcome | null>(null);
  const [ties, setTies] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ item_id: string; value: number }[]>([]);

  const loadStatus = useCallback(async () => {
    try {
      setStatus(await transport.me());
    } catch (err) {
      setError(err instanceof OracleRequestError && err.status === 401 ? "Sign in to visit the Oracle." : "The Oracle is resting. Try again later.");
    }
  }, [transport]);
  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const flush = useCallback(async () => {
    if (!attempt || pending.current.length === 0) return;
    const batch = pending.current;
    pending.current = [];
    try {
      const p = await transport.answer(attempt.attempt_id, batch);
      if (p.keeper_beat) setBeat(p.keeper_beat);
    } catch {
      pending.current = [...batch, ...pending.current]; // retry with the next batch
    }
  }, [attempt, transport]);

  const begin = async () => {
    setBusy(true);
    setError(null);
    let key: string | null = null;
    try {
      key = localStorage.getItem(KEY_STORE);
    } catch {
      /* private mode */
    }
    key ??= newKey();
    try {
      localStorage.setItem(KEY_STORE, key);
    } catch {
      /* private mode */
    }
    try {
      const a = await transport.start(key);
      setAttempt(a);
      setAnswers(a.answered);
    } catch (err) {
      if (err instanceof OracleRequestError && err.status < 500) {
        try {
          localStorage.removeItem(KEY_STORE);
        } catch {
          /* ignore */
        }
      }
      setError(err instanceof OracleRequestError ? err.message : "Couldn't begin the reading.");
    } finally {
      setBusy(false);
    }
  };

  const pick = async (id: string, v: number) => {
    const next = { ...answers, [id]: v };
    setAnswers(next);
    pending.current.push({ item_id: id, value: v });
    if (pending.current.length >= BATCH || Object.keys(next).length === attempt!.total) await flush();
  };

  const finish = async (withTies?: Record<string, string>) => {
    if (!attempt) return;
    setBusy(true);
    try {
      await flush();
      const r = await transport.finish(attempt.attempt_id, withTies);
      setResult(r);
      if (r.status === "done") {
        try {
          localStorage.removeItem(KEY_STORE);
        } catch {
          /* ignore */
        }
      }
    } catch (err) {
      setError(err instanceof OracleRequestError ? err.message : "Couldn't finish the reading.");
    } finally {
      setBusy(false);
    }
  };

  // ── Reveal ────────────────────────────────────────────────────────────────
  if (result?.status === "done") {
    const hex = HEX[result.color] ?? "#888";
    return (
      <section className={s.card} style={{ textAlign: "center", boxShadow: `0 0 80px ${hex}55` }} aria-live="polite">
        <div className={s.sigil} style={{ background: `radial-gradient(circle, ${hex}, ${hex}33 70%)` }} aria-hidden>{result.family[0]}</div>
        <div className={s.eyebrow} style={{ color: hex }}>{result.color.toUpperCase()} · {result.type}</div>
        <h2 className={s.family}>{result.family}</h2>
        <p className={s.muted}>{BLURB[result.family]}</p>
        <p className={s.muted}>{result.aura_new ? "A new aura is yours." : "Your aura is already yours."}{result.previous_family && result.previous_family !== result.family ? ` You were ${result.previous_family}.` : ""}</p>
        <Axes dichotomies={result.dichotomies} hex={hex} />
      </section>
    );
  }
  if (result?.status === "needs_tie_breakers") {
    const done = result.tie_breakers.every((t) => ties[t.id]);
    return (
      <section className={s.card}>
        <h2 style={{ marginTop: 0 }}>The Oracle hesitates…</h2>
        <p className={s.muted}>One side of you came out exactly even. Choose quickly:</p>
        {result.tie_breakers.map((t) => (
          <div key={t.id} style={{ marginBottom: 12 }}>
            <b>{t.prompt}</b>
            <div className={s.row}>
              {t.options.map((o) => (
                <button key={o.label} className={s.choice} aria-pressed={ties[t.id] === o.pole} onClick={() => setTies({ ...ties, [t.id]: o.pole })}>{o.label}</button>
              ))}
            </div>
          </div>
        ))}
        <button className={s.btn} disabled={!done || busy} onClick={() => finish(ties)}>Let the Oracle speak</button>
      </section>
    );
  }

  // ── Reading ───────────────────────────────────────────────────────────────
  if (attempt) {
    const answered = Object.keys(answers).length;
    const next = attempt.items.find((i) => answers[i.id] === undefined);
    return (
      <section className={s.card}>
        <div className={s.progressLabel}><span>THE ORACLE ASKS</span><span>{answered} / {attempt.total}</span></div>
        <div className={s.bar}><div style={{ width: `${(answered / attempt.total) * 100}%` }} /></div>
        {beat ? <p className={s.keeper}>Keeper: “{KEEPER[Math.min(beat, KEEPER.length) - 1]}”</p> : null}
        {next ? (
          <>
            <h2 className={s.statement}>{next.text}</h2>
            <div className={s.scale} role="radiogroup" aria-label="How much do you agree?">
              {SCALE.map((o) => (
                <button key={o.v} role="radio" aria-checked={false} className={s.choice} onClick={() => pick(next.id, o.v)}>{o.label}</button>
              ))}
            </div>
            <p className={s.muted} style={{ marginTop: 12 }}>There are no right answers. You can leave and come back; your place is saved.</p>
          </>
        ) : (
          <button className={s.btn} disabled={busy} onClick={() => finish()}>{busy ? "…" : "Hear the Oracle"}</button>
        )}
        {error ? <p className={s.error}>{error}</p> : null}
      </section>
    );
  }

  // ── Temple steps (status) ─────────────────────────────────────────────────
  if (!status) return <section className={s.card}><p className={s.muted}>{error ?? "Climbing the temple steps…"}</p></section>;
  const n = status.next_reading;
  const hex = status.color ? HEX[status.color] : "#8e6cc9";
  return (
    <section className={s.card} style={{ textAlign: "center" }}>
      {status.family ? (
        <>
          <div className={s.sigil} style={{ background: `radial-gradient(circle, ${hex}, ${hex}33 70%)` }} aria-hidden>{status.family[0]}</div>
          <h2 className={s.family}>{status.family}{status.type ? <span className={s.muted}> · {status.type}</span> : null}</h2>
          <p className={s.muted}>Auras unlocked: {status.auras.join(", ") || "none yet"}</p>
        </>
      ) : (
        <>
          <h2 className={s.family}>The Oracle</h2>
          <p className={s.muted}>Sixty-four questions. No right answers. At the end, the Oracle names your family: Arcane, Ranger, Vanguard or Warden.</p>
        </>
      )}
      {n.kind === "resume" ? <button className={s.btn} onClick={begin} disabled={busy}>Continue your reading ({status.open_attempt?.answered}/{status.open_attempt?.total})</button> : null}
      {n.kind === "free" ? <button className={s.btn} onClick={begin} disabled={busy}>{status.family ? "Take the full reading (free)" : "Begin the reading"}</button> : null}
      {n.kind === "respec" ? <button className={s.btn} onClick={begin} disabled={busy}>New reading · {n.fee} {COINS.symbol}</button> : null}
      {n.kind === "cooldown" ? <p className={s.muted}>The Oracle can read you again on {new Date(n.available_at!).toLocaleDateString("en-CA")} ({n.fee} {COINS.symbol}).</p> : null}
      {error ? <p className={s.error}>{error}</p> : null}
    </section>
  );
}

function Axes({ dichotomies, hex }: { dichotomies: { dichotomy: string; score: number; max: number; letter: string }[]; hex: string }) {
  return (
    <div className={s.axes}>
      {dichotomies.map((d) => {
        const [a, b] = d.dichotomy.split("");
        const lean = (d.score / d.max) * 50;
        return (
          <div key={d.dichotomy} className={s.axis}>
            <span style={{ fontWeight: d.letter === a ? 800 : 400 }}>{POLE[a]}</span>
            <div className={s.track}>
              <div style={{ left: lean >= 0 ? `${50 - lean}%` : "50%", width: `${Math.abs(lean)}%`, background: hex }} />
              <i />
            </div>
            <span style={{ fontWeight: d.letter === b ? 800 : 400, textAlign: "right" }}>{POLE[b]}</span>
          </div>
        );
      })}
    </div>
  );
}
