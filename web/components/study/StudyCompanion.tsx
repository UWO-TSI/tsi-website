"use client";

/**
 * Phone study companion (row 81): same tables, timers and coins as the 3D
 * cafe, through the shared useStudySession hook. Mobile-first, no canvas.
 */
import { useState } from "react";
import { Amount } from "@/components/economy/Amount";
import { Toggle, useSignInHref } from "@/components/gui";
import { useSoundUnlock } from "@/lib/game/useAudio";
import { LIMITS, PRESETS, type Settings } from "@/lib/study/rules";
import type { TableView } from "@/lib/study/service";
import { formatClock, type StudyHook } from "@/lib/study/useStudySession";
import s from "./companion.module.css";

const LOCATION: Record<string, string> = { cafe: "Cafe", "outdoor-plaza": "Plaza", "outdoor-pier": "Pier" };

/**
 * The companion's content, without the full-page `.shell`/`.wrap` chrome —
 * for embedding inside another shell (the `/student/companion` tab bar).
 * `study` comes from the caller so a page that also needs `table`/`mates`
 * elsewhere (the tab shell's 3D table view) shares one hook instance
 * instead of polling the study API twice.
 */
export function StudyCompanionBody({ study }: { study: StudyHook }) {
  const { session } = study;
  // Signing in comes back here (reachability §3).
  const signIn = useSignInHref();
  // Audio pass (row 169 / polish-ownership item 9): the block-end chime
  // goes through AudioManager.playSFX("confirm"), which stays silent until
  // something calls enable(). The companion has no canvas to click into, so
  // the first tap or key anywhere on the page unlocks it.
  useSoundUnlock();
  return (
    <>
      <header className={s.top}>
        <h1>Study</h1>
        <span className={s.coins} title="TC earned this visit">+<Amount n={study.coinsEarned} /></span>
      </header>
      {study.error ? <p className={`${s.note} ${s.err}`} role="alert">{study.error}</p> : null}
      {study.signedOut ? (
        <section className={s.card}>
          <h2>Study with the club</h2>
          <p className={s.muted}>Sit at a cafe table, run your own Pomodoro timer next to other people, and earn coins for every focus minute.</p>
          <div className={s.row} style={{ marginTop: 12 }}>
            <a className={s.btn} href={signIn} style={{ display: "grid", placeItems: "center", textDecoration: "none" }}>Sign in to study</a>
          </div>
        </section>
      ) : null}
      {study.lastEnded && !session ? <Ended study={study} /> : null}
      {!study.loaded && !study.signedOut ? <p className={s.muted}>Finding a table…</p> : null}
      {study.loaded && !session ? <Tables study={study} /> : null}
      {session?.phase === "seated" ? <Setup study={study} /> : null}
      {session && (session.phase === "focus" || session.phase === "break") ? <Timer study={study} /> : null}
      {session ? <Mates study={study} /> : null}
      {session && !study.chatMuted ? <Chat study={study} /> : null}
      <Stats study={study} />
    </>
  );
}

export default function StudyCompanion({ study }: { study: StudyHook }) {
  return (
    <div className={`${s.shell} gui`}>
      <div className={s.wrap}>
        <StudyCompanionBody study={study} />
      </div>
    </div>
  );
}

function Tables({ study }: { study: StudyHook }) {
  const groups = new Map<string, TableView[]>();
  for (const t of study.tables) groups.set(t.location, [...(groups.get(t.location) ?? []), t]);
  return (
    <section className={s.card}>
      <h2>Pick a seat</h2>
      <p className={s.muted}>Your timer is your own; people at the table study alongside you.</p>
      {[...groups.entries()].map(([loc, tables]) => (
        <div key={loc}>
          <div className={s.eyebrow}>{LOCATION[loc] ?? loc}</div>
          {tables.every((t) => t.closed) ? <p className={s.muted} style={{ margin: "0 0 8px" }}>Boarded up for now. The café opens for everyone when the club fills its goal at the monument.</p> : null}
          <div className={s.tables}>
            {tables.map((t) => (
              <div key={t.id} className={s.table}>
                <span className={s.name}>{t.label}</span>
                {t.closed ? <span className={s.lockTag}>Closed</span> : t.is_private && !t.can_join ? <span className={s.lockTag}>Private</span> : <span className={s.muted}>{t.taken.length}/{t.seats}</span>}
                <div className={s.seats}>
                  {Array.from({ length: t.seats }, (_, i) => i + 1).map((seat) => {
                    const taken = t.taken.includes(seat);
                    return (
                      <button key={seat} className={s.seat} disabled={taken || !t.can_join || study.busy} onClick={() => study.sit(t.id, seat)} aria-label={`${t.label}, seat ${seat}${t.closed ? ", closed" : taken ? ", taken" : ""}`}>
                        {taken ? "●" : seat}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

export function Setup({ study }: { study: StudyHook }) {
  const [settings, setSettings] = useState<Settings>({ focus_len: 25, break_len: 5, cycles: 4 });
  const step = (k: keyof Settings, d: number) => {
    const lim = k === "focus_len" ? LIMITS.focus : k === "break_len" ? LIMITS.break : LIMITS.cycles;
    setSettings((x) => ({ ...x, [k]: Math.min(lim[1], Math.max(lim[0], x[k] + d)) }));
  };
  const coins = settings.focus_len * settings.cycles + Math.round((10 * settings.focus_len) / 25) * settings.cycles;
  return (
    <section className={s.card}>
      <h2>{study.table?.label} · seat {study.session?.seat}</h2>
      <div className={s.presets}>
        {PRESETS.map((p) => (
          <button key={p.id} className={s.preset} aria-pressed={p.focus_len === settings.focus_len && p.break_len === settings.break_len && p.cycles === settings.cycles} onClick={() => setSettings({ focus_len: p.focus_len, break_len: p.break_len, cycles: p.cycles })}>
            {p.label}
          </button>
        ))}
      </div>
      {([["focus_len", "Focus", 5, "min"], ["break_len", "Break", 1, "min"], ["cycles", "Cycles", 1, ""]] as const).map(([k, label, d, unit]) => (
        <div key={k} className={s.stepper}>
          <span>{label}</span>
          <button onClick={() => step(k, -d)} aria-label={`Less ${label}`}>−</button>
          <b>{settings[k]}{unit ? ` ${unit}` : ""}</b>
          <button onClick={() => step(k, d)} aria-label={`More ${label}`}>+</button>
        </div>
      ))}
      <p className={s.muted}>Full session: up to <Amount n={coins} />. Leaving early keeps your minutes.</p>
      <div className={s.row} style={{ marginTop: 10 }}>
        <button className={s.ghost} onClick={study.end} disabled={study.busy}>Leave seat</button>
        <button className={s.btn} onClick={() => study.start(settings)} disabled={study.busy}>Start</button>
      </div>
    </section>
  );
}

function Timer({ study }: { study: StudyHook }) {
  const x = study.session!;
  const total = ((x.phase === "focus" ? x.settings!.focus_len : x.settings!.break_len) || 1) * 60;
  const frac = study.remaining === null ? 0 : study.remaining / total;
  const R = 90;
  const C = 2 * Math.PI * R;
  const color = x.phase === "focus" ? "var(--gui-wood-light, #bb813f)" : "var(--gui-success, #6c9a6f)";
  const isHost = study.mates.some((m) => m.me && m.is_host);
  return (
    <section className={s.card}>
      <div className={s.ringWrap}>
        <svg className={s.ring} viewBox="0 0 200 200" role="timer" aria-label={`${x.phase} ${formatClock(study.remaining)} remaining`}>
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--gui-paper-deep, #e4e8dc)" strokeWidth="12" />
          <circle cx="100" cy="100" r={R} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 100 100)" style={{ transition: "stroke-dashoffset 1s linear" }} />
          <text x="100" y="92" textAnchor="middle" className={s.phase} fill={color}>{x.phase === "focus" ? "Focus" : "Break"}</text>
          <text x="100" y="130" textAnchor="middle" className={s.clock} fill="var(--gui-ink-strong, #293e3b)">{formatClock(study.remaining)}</text>
        </svg>
        <p className={s.muted}>Cycle {x.cycle} of {x.settings!.cycles} · {x.minutes_completed} min banked · <Amount n={x.coins_pending} /> so far</p>
      </div>
      <div className={s.row}>
        {x.phase === "focus" ? <button className={s.ghost} onClick={study.takeBreak} disabled={study.busy}>Break now</button> : <button className={s.ghost} onClick={study.resume} disabled={study.busy}>Skip break</button>}
        <button className={s.btn} onClick={study.end} disabled={study.busy}>Leave seat</button>
      </div>
      <Toggle checked={!study.chatMuted} disabled={x.phase === "break"} onChange={(on) => study.setChatOpen(on)}>Table chat {study.chatMuted ? "muted while you focus" : "on"}</Toggle>
      {isHost ? <Toggle checked={!!study.table?.is_private} onChange={(on) => study.lock(on)} hint="Only people already here">Private table</Toggle> : null}
    </section>
  );
}

function Mates({ study }: { study: StudyHook }) {
  const others = study.mates.filter((m) => !m.me);
  return (
    <section className={s.card}>
      <h2>At your table{study.table?.is_private ? " · private" : ""}</h2>
      {others.length === 0 ? <p className={s.muted}>Nobody else yet. Others can sit down any time.</p> : null}
      <ul className={s.mates}>
        {others.map((m) => (
          <li key={m.member_id} className={s.mate}>
            <span className={s.avatar} aria-hidden>{m.name.charAt(0)}</span>
            <span>{m.name}{m.is_host ? <span className={s.muted}> · host</span> : null}</span>
            <span className={s.pill} data-p={m.phase}>{m.phase === "seated" ? "Settling in" : `${m.phase === "focus" ? "Focus" : "Break"} ${formatClock(m.remaining_s)}`}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Ended({ study }: { study: StudyHook }) {
  const e = study.lastEnded!;
  const why = e.end_reason === "finished" ? "Session complete" : e.end_reason === "timeout" ? "Session ended after 5 minutes away" : "You left your seat";
  return (
    <section className={`${s.card}`}>
      <h2>{why}</h2>
      <p className={`${s.note} ${s.ok}`}>+<Amount n={e.coins_paid ?? e.coins_pending} /> · {e.minutes_completed} focus minutes · {e.blocks_completed} full block{e.blocks_completed === 1 ? "" : "s"}</p>
    </section>
  );
}

function Stats({ study }: { study: StudyHook }) {
  const st = study.stats;
  if (!st) return null;
  return (
    <section className={s.card}>
      <h2>This week</h2>
      <div className={s.stats}>
        <div><b>{st.minutes}</b><span>minutes</span></div>
        <div><b>{st.longest_block}</b><span>longest block</span></div>
        <div><b>{st.sessions}</b><span>sessions</span></div>
      </div>
      <Toggle checked={st.on_board} onChange={(on) => study.setBoardOptIn(on)}>Show me on the café board</Toggle>
    </section>
  );
}

export function Chat({ study }: { study: StudyHook }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const send = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    if (await study.sendChat(text)) setText("");
    setSending(false);
  };
  return (
    <section className={s.card} aria-label="Table chat">
      <h2>Table chat</h2>
      {study.chat.length === 0 ? <p className={s.muted}>Quiet so far. Say hi on your break.</p> : null}
      <ul className={s.chat}>
        {study.chat.map((m) => (
          <li key={m.id} className={s.msg} data-mine={m.mine}>
            <b>{m.mine ? "You" : m.name}</b> {m.body}
            {!m.mine ? <button className={s.report} onClick={() => study.reportChat(m.id)} aria-label={`Report message from ${m.name}`}>Report</button> : null}
          </li>
        ))}
      </ul>
      <form className={s.row} style={{ marginTop: 8 }} onSubmit={(e) => { e.preventDefault(); void send(); }}>
        <input className={s.input} value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder="Message your table" aria-label="Message" />
        <button className={s.btn} style={{ flex: "0 0 auto" }} disabled={!text.trim() || sending}>Send</button>
      </form>
    </section>
  );
}
