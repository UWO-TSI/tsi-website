"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { MAX_ATTEMPTS, NEAR_MISS, ONBOARDING, TIME_LIMIT_SECONDS, teamStep } from "./data";
import { setMuted, sfx, unlockAudio } from "./sfx";
import type { Invite } from "./token";
import { rigged, type Feedback } from "./vault";
import type { VaultMode } from "./VaultScene";

const VaultScene = dynamic(() => import("./VaultScene"), { ssr: false });

const mono = "font-[family-name:var(--font-highlight)]";
const spring = { type: "spring", stiffness: 520, damping: 26 } as const;
const enter = {
  initial: { opacity: 0, y: 18, filter: "blur(6px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  exit: { opacity: 0, y: -12, filter: "blur(6px)" },
  transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
} as const;

function memberNumber(name: string) {
  let h = 0;
  for (const c of name.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `TSI-${String(1000 + (h % 9000))}`;
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

export default function FinalRound({ invite }: { invite?: Invite }) {
  const [phase, setPhase] = useState<VaultMode>("gate");
  const [name, setName] = useState(invite?.name ?? "");
  const [muted, setMutedState] = useState(false);
  const [answer, setAnswer] = useState("");
  const [history, setHistory] = useState<{ guess: string; fb: Feedback }[]>([]);
  const [message, setMessage] = useState("");
  const [shake, setShake] = useState(0);
  const [remaining, setRemaining] = useState(TIME_LIMIT_SECONDS);
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const deadline = useRef(0);
  const ended = useRef(false);
  const captureRef = useRef<(() => string) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const cleanName = name.trim();
  const project = invite?.project ?? "";
  const steps = useMemo(() => {
    const list = [...ONBOARDING];
    list.splice(2, 0, teamStep(project));
    return list;
  }, [project]);

  useEffect(() => {
    try {
      if (localStorage.getItem("fr-muted") === "1") setMutedState(true);
    } catch {}
  }, []);

  useEffect(() => {
    setMuted(muted);
  }, [muted]);

  const toggleMute = () => {
    unlockAudio();
    setMutedState((m) => {
      try {
        localStorage.setItem("fr-muted", m ? "0" : "1");
      } catch {}
      return !m;
    });
  };
  const memberNo = useMemo(() => memberNumber(cleanName), [cleanName]);
  const date = useMemo(
    () =>
      new Date().toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }),
    []
  );

  const fail = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    buzz([80, 60, 80, 60, 200]);
    sfx.deny();
    setPhase("judging");
    window.setTimeout(() => {
      setPhase("reveal");
      sfx.open();
    }, 3600);
  }, []);

  useEffect(() => {
    if (phase !== "test") return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(id);
        fail();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [phase, fail]);

  const onOpened = useCallback(() => {
    setOpened(true);
    buzz([30, 40, 30]);
    sfx.angel();
    const end = Date.now() + 2200;
    const colors = ["#1d9bf0", "#22d3ee", "#ffd166", "#f1ffff"];
    confetti({ particleCount: 140, spread: 100, startVelocity: 55, origin: { y: 0.55 }, colors });
    const burst = () => {
      confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors });
      confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors });
      if (Date.now() < end) requestAnimationFrame(burst);
    };
    burst();
  }, []);

  const begin = () => {
    if (!cleanName) return;
    unlockAudio();
    sfx.clunk();
    deadline.current = Date.now() + TIME_LIMIT_SECONDS * 1000;
    setRemaining(TIME_LIMIT_SECONDS);
    setPhase("test");
    window.setTimeout(() => inputRef.current?.focus(), 450);
  };

  const submit = () => {
    if (answer.length !== 4 || ended.current) return;
    const fb = rigged(answer, history);
    const next = [{ guess: answer, fb }, ...history];
    setHistory(next);
    setShake((s) => s + 1);
    setAnswer("");
    buzz(fb.exact === 3 ? [20, 30, 60] : 25);
    sfx.clunk();
    for (let i = 0; i < fb.exact + fb.misplaced; i++) sfx.lamp(i, i < fb.exact ? "green" : "amber");
    if (fb.exact === 3) sfx.close();
    setMessage(
      fb.exact === 3
        ? NEAR_MISS[next.filter((h) => h.fb.exact === 3).length % NEAR_MISS.length]
        : ""
    );
    if (next.length >= MAX_ATTEMPTS) window.setTimeout(fail, 1100);
  };

  const save = async () => {
    const shot = captureRef.current?.();
    if (!shot) return;
    setSaving(true);
    try {
      const img = new Image();
      img.src = shot;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const body = getComputedStyle(document.documentElement).getPropertyValue("--font-body");
      const s = Math.min(c.width, c.height);
      ctx.textAlign = "center";
      ctx.fillStyle = "#ffd166";
      ctx.font = `800 ${Math.round(s * 0.075)}px ${body}`;
      ctx.fillText("I MADE IT INTO TSI.", c.width / 2, c.height * 0.14);
      ctx.fillStyle = "rgba(241,255,255,0.55)";
      ctx.font = `500 ${Math.round(s * 0.03)}px ${body}`;
      ctx.fillText("tethos.ca", c.width / 2, c.height * 0.93);

      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
      const file = new File([blob], `tsi-acceptance-${memberNo}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "I made it into TSI" }).catch(() => {});
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        URL.revokeObjectURL(a.href);
      }
    } finally {
      setSaving(false);
    }
  };

  const attemptsLeft = MAX_ATTEMPTS - history.length;
  const urgent = phase === "test" && remaining <= 30;
  const latest = history[0]?.fb ?? null;

  return (
    <main className="relative min-h-svh overflow-x-hidden bg-[#0b0c0f] text-[#f1ffff]">
      <style>{`
        @keyframes fr-glitch{0%,100%{transform:translate(0);text-shadow:2px 0 #22d3ee,-2px 0 #ef4444}25%{transform:translate(-3px,2px)}50%{transform:translate(3px,-2px);text-shadow:-3px 0 #22d3ee,3px 0 #ef4444}75%{transform:translate(-2px,-1px)}}
        @keyframes fr-pulse{0%,100%{opacity:.0}50%{opacity:.22}}
        @keyframes fr-caret{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes fr-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
        .fr-panel{padding-top:44svh}
        @media (min-aspect-ratio:1/1){.fr-panel{padding-top:0;margin-left:50%;width:50%;min-height:100svh;display:flex;flex-direction:column;justify-content:center}}
        .fr-shimmer{background:linear-gradient(90deg,#ffd166 0%,#fff3cf 25%,#ffd166 50%,#fff3cf 75%,#ffd166 100%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:fr-shimmer 3s linear infinite}
      `}</style>

      <div className="fixed inset-0 z-0">
        <VaultScene
          mode={phase}
          feedback={latest}
          guessKey={shake}
          name={cleanName}
          project={project}
          memberNo={memberNo}
          date={date}
          onOpened={onOpened}
          captureRef={captureRef}
        />
      </div>

      {(phase === "gate" || phase === "test") && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1] h-[62svh] bg-gradient-to-t from-[#0b0c0f] via-[#0b0c0f]/90 to-transparent [@media(min-aspect-ratio:1/1)]:inset-y-0 [@media(min-aspect-ratio:1/1)]:left-1/2 [@media(min-aspect-ratio:1/1)]:h-auto [@media(min-aspect-ratio:1/1)]:bg-gradient-to-l" />
      )}
      {urgent && (
        <div
          className="pointer-events-none fixed inset-0 z-[2] bg-[#ef4444]"
          style={{ animation: "fr-pulse 1s infinite" }}
        />
      )}

      {phase === "test" && (
        <div className="fixed inset-x-0 top-0 z-20 px-4 pt-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <span className={`${mono} max-w-[45%] truncate text-[11px] tracking-[0.25em] text-white/50`}>
              {cleanName.toUpperCase()}
            </span>
            <motion.span
              key={urgent ? remaining : "calm"}
              initial={urgent ? { scale: 1.25 } : false}
              animate={{ scale: 1 }}
              transition={spring}
              className={`${mono} rounded-lg bg-black/40 px-3 py-1 text-3xl font-bold tabular-nums backdrop-blur ${
                urgent ? "text-[#ef4444]" : "text-[#f1ffff]"
              }`}
              style={urgent ? { animation: "fr-glitch .4s infinite" } : undefined}
            >
              {fmt(remaining)}
            </motion.span>
          </div>
          <div className="mx-auto mt-2 h-1 max-w-5xl overflow-hidden rounded bg-white/10">
            <div
              className={`h-full transition-[width] duration-200 ${urgent ? "bg-[#ef4444]" : "bg-[#1d9bf0]"}`}
              style={{ width: `${(remaining / TIME_LIMIT_SECONDS) * 100}%` }}
            />
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {phase === "gate" && (
          <motion.section key="gate" {...enter} className="fr-panel relative z-10 px-4 pb-10">
            <div className="mx-auto w-full max-w-md">
              <p className={`${mono} text-xs tracking-[0.3em] text-[#22d3ee]`}>
                TETHOS / FINAL ROUND
              </p>
              <h1 className="mt-3 text-[2rem] font-bold leading-[1.05] sm:text-5xl">
                Competence Assessment
              </h1>
              <p className="mt-4 text-[#9ca3af]">
                This is the last stage of your application. Your result on this
                assessment determines your outcome.
              </p>
              <ul className={`${mono} mt-5 space-y-1.5 text-sm text-[#e5e7eb]`}>
                {[
                  "Crack the 4-digit vault code.",
                  `${fmt(TIME_LIMIT_SECONDS)} on the clock. It does not pause.`,
                  `${MAX_ATTEMPTS} guesses. Pure logic, no luck required.`,
                  "No second chances.",
                ].map((r, i) => (
                  <motion.li
                    key={r}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.25 + i * 0.08 }}
                  >
                    <span className="text-white/35">0{i + 1} /</span> {r}
                  </motion.li>
                ))}
              </ul>
              {invite ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring, delay: 0.6 }}
                  className="mt-7 rounded-2xl border border-white/10 bg-[#121418]/90 p-4 backdrop-blur"
                >
                  <p className={`${mono} text-[10px] tracking-[0.3em] text-white/45`}>CANDIDATE</p>
                  <p className="mt-1 text-2xl font-bold">{invite.name}</p>
                  {project && (
                    <>
                      <p className={`${mono} mt-3 text-[10px] tracking-[0.3em] text-white/45`}>APPLIED TO</p>
                      <p className="mt-1 text-[#22d3ee]">{project}</p>
                    </>
                  )}
                </motion.div>
              ) : (
                <>
                  <label className="mt-8 block text-sm text-[#9ca3af]" htmlFor="nm">
                    Full name (as it appears on your application)
                  </label>
                  <input
                    id="nm"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && begin()}
                    maxLength={32}
                    autoComplete="name"
                    className="mt-2 w-full rounded-xl border border-white/15 bg-[#16181d]/90 px-4 py-3 text-lg outline-none backdrop-blur transition focus:border-[#1d9bf0] focus:shadow-[0_0_0_4px_rgba(29,155,240,0.18)]"
                  />
                </>
              )}
              <motion.button
                onClick={begin}
                disabled={!cleanName}
                whileHover={cleanName ? { scale: 1.02 } : undefined}
                whileTap={cleanName ? { scale: 0.96 } : undefined}
                transition={spring}
                className="sticky bottom-4 z-10 mt-5 w-full rounded-xl bg-[#1d9bf0] px-6 py-4 text-lg font-semibold text-white shadow-[0_10px_30px_-10px_rgba(29,155,240,0.8)] disabled:opacity-40 disabled:shadow-none"
              >
                I understand. Begin.
              </motion.button>
            </div>
          </motion.section>
        )}

        {phase === "test" && (
          <motion.section key="test" {...enter} className="fr-panel relative z-10 px-4 pb-10">
            <div className="mx-auto w-full max-w-md">
              <p className={`${mono} text-xs tracking-[0.25em] text-[#22d3ee]`}>
                VAULT / ACCESS CODE
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#cbd5e1]">
                Each guess lights the vault:{" "}
                <span className="text-[#22c55e]">green</span> = right digit, right
                place. <span className="text-[#ffd166]">amber</span> = right digit,
                wrong place. Digits can repeat.
              </p>

              <motion.div
                key={shake}
                className="mt-4"
                animate={shake ? { x: [0, -12, 10, -7, 4, 0] } : undefined}
                transition={{ duration: 0.42 }}
              >
                <div className="relative" onClick={() => inputRef.current?.focus()}>
                  <input
                    ref={inputRef}
                    value={answer}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                      if (v.length > answer.length) {
                        buzz(8);
                        sfx.key();
                      }
                      setAnswer(v);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={attemptsLeft <= 0}
                    aria-label="4-digit code"
                    className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
                  />
                  <div className="grid grid-cols-4 gap-2">
                    {[0, 1, 2, 3].map((i) => {
                      const ch = answer[i];
                      const active = i === answer.length;
                      return (
                        <div
                          key={i}
                          className={`${mono} relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-2xl border text-4xl font-semibold transition-colors duration-150 ${
                            active
                              ? "border-[#1d9bf0] bg-[#1d9bf0]/10 shadow-[0_0_24px_-6px_rgba(29,155,240,0.9)]"
                              : ch
                                ? "border-white/25 bg-[#1b1e24]"
                                : "border-white/10 bg-[#121418]/90"
                          }`}
                        >
                          <AnimatePresence mode="popLayout">
                            {ch ? (
                              <motion.span
                                key={ch + i + answer.length}
                                initial={{ y: 22, scale: 0.6, opacity: 0 }}
                                animate={{ y: 0, scale: 1, opacity: 1 }}
                                exit={{ y: -22, opacity: 0 }}
                                transition={spring}
                              >
                                {ch}
                              </motion.span>
                            ) : active ? (
                              <span
                                className="h-9 w-[3px] rounded bg-[#1d9bf0]"
                                style={{ animation: "fr-caret 1s steps(1) infinite" }}
                              />
                            ) : null}
                          </AnimatePresence>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <motion.button
                  onClick={submit}
                  disabled={answer.length !== 4 || attemptsLeft <= 0}
                  whileTap={{ scale: 0.95 }}
                  transition={spring}
                  className="mt-3 flex w-full items-center justify-center gap-3 rounded-xl bg-[#1d9bf0] px-6 py-4 text-lg font-semibold text-white shadow-[0_10px_30px_-10px_rgba(29,155,240,0.8)] transition-opacity disabled:opacity-40 disabled:shadow-none"
                >
                  Try code
                  <span className={`${mono} rounded-md bg-black/25 px-2 py-0.5 text-sm`}>
                    {attemptsLeft} left
                  </span>
                </motion.button>
              </motion.div>

              <div className="mt-3 h-6 text-center">
                <AnimatePresence mode="wait">
                  {message && (
                    <motion.p
                      key={message + history.length}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={spring}
                      className="text-sm font-semibold text-[#ffd166]"
                    >
                      {message}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <ul className="mt-2 space-y-2">
                <AnimatePresence initial={false}>
                  {history.map((h, i) => (
                    <motion.li
                      key={history.length - i}
                      layout
                      initial={{ opacity: 0, y: -16, scale: 0.96 }}
                      animate={{ opacity: i === 0 ? 1 : 0.6, y: 0, scale: 1 }}
                      transition={spring}
                      className="flex items-center justify-between rounded-xl border border-white/10 bg-[#121418]/90 px-4 py-2.5 backdrop-blur"
                    >
                      <span className={`${mono} text-xs text-white/40`}>
                        #{history.length - i}
                      </span>
                      <span className={`${mono} text-xl tracking-[0.4em]`}>{h.guess}</span>
                      <span className="flex gap-1.5">
                        {[0, 1, 2, 3].map((k) => (
                          <motion.span
                            key={k}
                            initial={i === 0 ? { scale: 0 } : false}
                            animate={{ scale: 1 }}
                            transition={{ ...spring, delay: 0.08 * k }}
                            className={`h-3 w-3 rounded-full ${
                              k < h.fb.exact
                                ? "bg-[#22c55e] shadow-[0_0_10px_#22c55e]"
                                : k < h.fb.exact + h.fb.misplaced
                                  ? "bg-[#ffd166] shadow-[0_0_10px_#ffd166]"
                                  : "bg-white/10"
                            }`}
                          />
                        ))}
                      </span>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
              <p className={`${mono} pt-6 text-center text-[11px] text-white/35`}>
                Only 3% of applicants crack this vault.
              </p>
            </div>
          </motion.section>
        )}

        {phase === "judging" && (
          <motion.section
            key="judging"
            {...enter}
            className="relative z-10 flex min-h-svh flex-col items-center justify-end px-4 pb-[14svh] text-center"
          >
            <p className={`${mono} text-xs tracking-[0.3em] text-[#ef4444]`}>ACCESS DENIED</p>
            <h1
              className="mt-3 text-4xl font-bold sm:text-5xl"
              style={{ animation: "fr-glitch .5s infinite" }}
            >
              Reviewing your result...
            </h1>
            <p className="mt-3 text-[#9ca3af]">Do not close this page.</p>
          </motion.section>
        )}
      </AnimatePresence>

      {phase === "reveal" && (
        <>
          <section className="pointer-events-none relative z-10 flex min-h-svh flex-col items-center justify-between px-4 pb-8 pt-[7svh] text-center">
            <AnimatePresence>
              {opened && (
                <motion.div key="head" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.12 } } }}>
                  {[
                    <p key="a" className={`${mono} text-xs tracking-[0.35em] text-[#22d3ee]`}>
                      PLOT TWIST
                    </p>,
                    <h1 key="b" className="mt-2 text-5xl font-extrabold leading-none tracking-tight sm:text-7xl">
                      JUST KIDDING.
                    </h1>,
                    <h2 key="c" className="fr-shimmer mt-2 text-3xl font-extrabold sm:text-5xl">
                      YOU MADE IT INTO TSI.
                    </h2>,
                  ].map((el) => (
                    <motion.div
                      key={el.key}
                      variants={{
                        h: { opacity: 0, y: 30, scale: 0.9, filter: "blur(10px)" },
                        s: { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", transition: spring },
                      }}
                    >
                      {el}
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {opened && (
                <motion.div
                  key="foot"
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...spring, delay: 0.7 }}
                  className="pointer-events-auto flex flex-col items-center"
                >
                  <p className="max-w-sm text-sm text-[#e5e7eb] [text-shadow:0_1px_14px_rgba(0,0,0,0.95)]">
                    That vault was rigged. Nobody cracks it. You were accepted before
                    you opened this page. Breathe. You&apos;re in.
                  </p>
                  <motion.button
                    onClick={save}
                    disabled={saving}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.95 }}
                    transition={spring}
                    className="mt-4 rounded-full bg-[#ffd166] px-7 py-3 font-bold text-[#0b0c0f] shadow-[0_10px_40px_-8px_rgba(255,209,102,0.8)] disabled:opacity-60"
                  >
                    {saving ? "Saving..." : "Save your ticket"}
                  </motion.button>
                  <a
                    href="#next"
                    className={`${mono} mt-4 text-[11px] tracking-[0.3em] text-white/50`}
                  >
                    YOUR NEXT STEPS ↓
                  </a>
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {opened && (
            <section id="next" className="relative z-10 bg-gradient-to-b from-transparent via-[#0b0c0f] to-[#0b0c0f] px-4 pb-20 pt-24">
              <div className="mx-auto w-full max-w-xl">
                <h3 className={`${mono} text-xs tracking-[0.3em] text-[#22d3ee]`}>
                  YOUR NEXT STEPS
                </h3>
                <ol className="mt-5 space-y-3">
                  {steps.map((s, i) => (
                    <motion.li
                      key={s.title}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ ...spring, delay: i * 0.08 }}
                      whileHover={{ x: 4 }}
                      className="flex gap-4 rounded-2xl border border-white/10 bg-[#121418] p-4"
                    >
                      <span className={`${mono} text-2xl font-bold text-[#ffd166]`}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="font-semibold">
                          {s.href ? (
                            <a href={s.href} target="_blank" rel="noreferrer" className="text-[#1d9bf0] underline">
                              {s.title}
                            </a>
                          ) : (
                            s.title
                          )}
                        </p>
                        <p className="text-sm text-[#9ca3af]">{s.body}</p>
                      </div>
                    </motion.li>
                  ))}
                </ol>
              </div>
            </section>
          )}
        </>
      )}
      <motion.button
        onClick={toggleMute}
        whileTap={{ scale: 0.88 }}
        transition={spring}
        aria-label={muted ? "Unmute sound" : "Mute sound"}
        className="fixed bottom-4 right-4 z-30 flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/80 backdrop-blur"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 5 6 9H2v6h4l5 4V5z" />
          {muted ? (
            <path d="m23 9-6 6M17 9l6 6" />
          ) : (
            <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
          )}
        </svg>
      </motion.button>
    </main>
  );
}
