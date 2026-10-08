"use client";

import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useAnimationControls } from "framer-motion";
import confetti from "canvas-confetti";
import {
  CLOSER,
  CODE_LENGTH,
  MAX_ATTEMPTS,
  MIN_GREENS,
  NEAR_MISS,
  ONBOARDING,
  TIME_LIMIT_SECONDS,
} from "./data";
import { setMuted, sfx, unlockAudio } from "./sfx";
import type { Invite } from "./token";
import type { Progress, ProgressEvent } from "./progress";
import { createRig, greens, type Feedback } from "./vault";
import { renderShareCard, shareCaption, type ShareFormat } from "./shareCard";
import type { VaultMode } from "./VaultScene";

const VaultScene = dynamic(() => import("./VaultScene"), { ssr: false });

// Without WebGL the game still works on the plain page; only the 3D vault is lost.
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

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

function applicationId(name: string) {
  let h = 7;
  for (const c of name.toLowerCase()) h = (h * 131 + c.charCodeAt(0)) >>> 0;
  return `APP-${String(10000 + (h % 90000))}`;
}

// Deadline is 11:59 PM ET on the day they finished (today on a first visit).
function deadlineLabel(revealedAt: string | null) {
  const day = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", weekday: "short", month: "short", day: "numeric" }).format(d);
  if (!revealedAt || day(new Date(revealedAt)) === day(new Date())) return "11:59 PM ET tonight";
  return `11:59 PM ET on ${day(new Date(revealedAt))}`;
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {}
}

type Phase = VaultMode | "countdown" | "status" | "checking";

const startPhase = (p: Progress): Phase => (p === "done" ? "reveal" : p === "started" ? "status" : "gate");

export default function FinalRound({
  invite,
  token,
  progress = "new",
  revealedAt = null,
  emailsOn = false,
}: {
  invite?: Invite;
  token?: string;
  progress?: Progress;
  revealedAt?: string | null;
  emailsOn?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>(startPhase(progress));
  const [returning, setReturning] = useState(progress === "done");
  const [count, setCount] = useState(3);
  const [name, setName] = useState(invite?.name ?? "");
  const [muted, setMutedState] = useState(false);
  const [answer, setAnswer] = useState("");
  const [history, setHistory] = useState<{ guess: string; fb: Feedback }[]>([]);
  const [message, setMessage] = useState("");
  const [shake, setShake] = useState(0);
  const [remaining, setRemaining] = useState(TIME_LIMIT_SECONDS);
  const [opened, setOpened] = useState(false);
  const [saving, setSaving] = useState(false);
  const [share, setShare] = useState<{ format: ShareFormat; blob: Blob; url: string } | null>(null);
  const [copied, setCopied] = useState(false);
  // Hidden clock: the display counts down a virtual time whose rate drifts so
  // it hits zero as the last attempt is being typed.
  const vLeft = useRef(TIME_LIMIT_SECONDS * 1000);
  const rate = useRef(1);
  const rateTarget = useRef(1);
  const lastReal = useRef(0);
  const testStart = useRef(0);
  const keyTimes = useRef<number[]>([]);
  const lastAttempt = useRef({ active: false, typed: 0 });
  const lastSubmit = useRef(0);
  const shakeCtl = useAnimationControls();
  const [scrollDark, setScrollDark] = useState(0);
  const [timeUp, setTimeUp] = useState(false);
  const ended = useRef(false);
  const captureRef = useRef<(() => string) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const proxyRef = useRef<HTMLInputElement>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const rig = useRef<ReturnType<typeof createRig> | null>(null);

  const cleanName = name.trim();

  // Progress lives in the database (any device) and in this browser (fallback).
  const memKey = token ? `fr:${token.split(".")[0]}` : null;
  const track = useCallback(
    (event: ProgressEvent) => {
      if (!token) return;
      try {
        if (memKey && (event === "start" || event === "reveal")) localStorage.setItem(memKey, event);
      } catch {}
      fetch("/api/finalround/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, event }),
        keepalive: true,
      }).catch(() => {});
    },
    [token, memKey]
  );

  useEffect(() => {
    track("open");
    if (!memKey || progress === "done") return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(memKey);
    } catch {}
    if (saved === "reveal") {
      setReturning(true);
      setPhase("reveal");
    } else if (saved === "start" && progress === "new") {
      setPhase("status");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page load
  }, []);
  const project = invite?.project ?? "";

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

  // Clock hit zero: hold on a red 0:00 for a beat, then move on.
  const fail = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    track("finish");
    setRemaining(0);
    setTimeUp(true);
    buzz([80, 60, 80, 60, 200]);
    sfx.deny();
    window.setTimeout(() => {
      setPhase("judging");
      window.setTimeout(() => setPhase("status"), 3000);
    }, 1600);
  }, [track]);

  // Nobody gets stranded on the status screen: continue on their behalf after a pause.
  const checkStatusRef = useRef<() => void>(() => {});
  useEffect(() => {
    if (phase !== "status") return;
    const id = window.setTimeout(() => checkStatusRef.current(), 8000);
    return () => window.clearTimeout(id);
  }, [phase]);

  const checkStatus = () => {
    if (phase !== "status") return;
    unlockAudio();
    setPhase("checking");
    window.setTimeout(() => {
      setPhase("reveal");
      sfx.open();
    }, 2600);
  };
  useEffect(() => {
    checkStatusRef.current = checkStatus;
  });

  useEffect(() => {
    if (phase !== "test") return;
    lastReal.current = performance.now();
    let shown = Math.ceil(vLeft.current / 1000);
    const id = window.setInterval(() => {
      const now = performance.now();
      // On the last attempt, don't run out before they start typing.
      const la = lastAttempt.current;
      const crawl = la.active && la.typed === 0 && vLeft.current < 9500;
      const target = crawl ? Math.min(rateTarget.current, 0.35) : rateTarget.current;
      // Drift slowly between attempts so the change isn't noticeable; react fast on the last one.
      rate.current += (target - rate.current) * (la.active ? (crawl ? 0.25 : 0.4) : 0.035);
      vLeft.current -= (now - lastReal.current) * rate.current;
      lastReal.current = now;
      const sec = Math.max(0, Math.ceil(vLeft.current / 1000));
      if (sec !== shown) {
        shown = sec;
        setRemaining(sec);
        if (sec > 0) sfx.tick(sec <= 15);
      }
      if (vLeft.current <= 0) {
        window.clearInterval(id);
        fail();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, fail]);

  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  const calibrate = (done: number, typed: number) => {
    const secsLeft = vLeft.current / 1000;
    const now = performance.now();
    if (done >= MAX_ATTEMPTS - 1) {
      // Final attempt: land on zero right as the last digit goes in.
      const gaps = keyTimes.current.slice(1).map((t, i) => t - keyTimes.current[i]);
      const perKey = clamp((gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 700) / 1000, 0.3, 1.2);
      const avgGuess = (now - testStart.current) / Math.max(1, done) / 1000;
      // Thinking: crawl. Typing: drain so it reaches 0:00 on the 6th digit,
      // speeding up visibly with every keystroke.
      const realLeft = typed === 0 ? Math.max(6, avgGuess) : Math.max(0.3, (CODE_LENGTH - typed) * perKey + 0.15);
      rateTarget.current = clamp(secsLeft / realLeft, typed === 0 ? 0.3 : 1, 14);
    } else if (done >= 1) {
      const avgGuess = (now - testStart.current) / done / 1000;
      // Aim to reach the last attempt with about 10 seconds on the clock,
      // only allowing the clock to get slightly faster after each attempt.
      const lastGuess = (now - (lastSubmit.current || testStart.current)) / 1000;
      const pace = Math.max(avgGuess, lastGuess);
      const attemptsLeft = MAX_ATTEMPTS - done;
      rateTarget.current = clamp((secsLeft - 10) / (pace * (attemptsLeft - 1)), 0.2, Math.min(2.8, 1 + 0.6 * done));
    }
  };

  const onOpened = useCallback(() => {
    setOpened(true);
    track("reveal");
    buzz([30, 40, 30]);
    sfx.angel();
    const end = Date.now() + 2200;
    const colors = ["#1d9bf0", "#22d3ee", "#ffd166", "#f1ffff"];
    confetti({ particleCount: 140, spread: 100, startVelocity: 55, origin: { y: 0.55 }, colors, zIndex: 40 });
    const burst = () => {
      confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors, zIndex: 40 });
      confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors, zIndex: 40 });
      if (Date.now() < end) requestAnimationFrame(burst);
    };
    burst();
  }, [track]);

  const begin = () => {
    // iOS only opens the keyboard for focus inside a tap; hold it on a proxy until the code input mounts.
    proxyRef.current?.focus();
    if (!cleanName || phase !== "gate") return;
    unlockAudio();
    track("start");
    setPhase("countdown");
    setCount(3);
    sfx.count();
    window.setTimeout(() => {
      setCount(2);
      sfx.count();
    }, 1000);
    window.setTimeout(() => {
      setCount(1);
      sfx.count();
    }, 2000);
    window.setTimeout(() => {
      sfx.clunk();
      vLeft.current = TIME_LIMIT_SECONDS * 1000;
      rate.current = 1;
      rateTarget.current = 1;
      testStart.current = performance.now();
      lastSubmit.current = 0;
      setRemaining(TIME_LIMIT_SECONDS);
      setPhase("test");
      window.setTimeout(() => inputRef.current?.focus(), 450);
    }, 3000);
  };

  const finalSet = history.length >= MAX_ATTEMPTS - 1;

  const applyAnswer = (raw: string) => {
    // During the 0:00 hold they can still finish typing, just never submit.
    if (ended.current && (phase !== "test" || raw.length < answer.length)) return;
    const v = raw.replace(/\D/g, "").slice(0, CODE_LENGTH);
    if (v.length > answer.length) {
      buzz(8);
      sfx.key();
      keyTimes.current.push(performance.now());
    }
    setAnswer(v);
    if (ended.current) return;
    lastAttempt.current = { active: finalSet, typed: v.length };
    if (finalSet) {
      calibrate(history.length, v.length);
      // The clock gives out on the last keystroke.
      if (v.length === CODE_LENGTH && vLeft.current > 0) {
        rateTarget.current = rate.current = Math.max(rate.current, vLeft.current / 350);
      }
    }
  };

  const submit = () => {
    if (answer.length !== CODE_LENGTH || ended.current || finalSet) return;
    rig.current ??= createRig(CODE_LENGTH);
    const fb = rig.current(answer, history.length, MIN_GREENS[history.length] ?? CODE_LENGTH - 1);
    const g = greens(fb);
    const best = Math.max(0, ...history.map((h) => greens(h.fb)));
    const next = [{ guess: answer, fb }, ...history];
    setHistory(next);
    setShake((s) => s + 1);
    setAnswer("");
    keyTimes.current = [];
    lastAttempt.current = { active: next.length >= MAX_ATTEMPTS - 1, typed: 0 };
    calibrate(next.length, 0);
    lastSubmit.current = performance.now();
    shakeCtl.start({ x: [0, -12, 10, -7, 4, 0], transition: { duration: 0.42 } });
    inputRef.current?.focus();
    buzz(g === CODE_LENGTH - 1 ? [20, 30, 60] : 25);
    sfx.clunk();
    fb.forEach((m, i) => m && sfx.lamp(i, m === 2 ? "green" : "amber"));
    if (g === CODE_LENGTH - 1) sfx.close();
    setMessage(
      g === CODE_LENGTH - 1
        ? NEAR_MISS[next.filter((h) => greens(h.fb) === CODE_LENGTH - 1).length % NEAR_MISS.length]
        : g > best
          ? CLOSER[history.length % CLOSER.length]
          : ""
    );
  };

  // Typing works even when the hidden input has lost focus.
  const keys = useRef({ applyAnswer, submit, answer });
  useEffect(() => {
    keys.current = { applyAnswer, submit, answer };
  });
  useEffect(() => {
    if (phase !== "test") return;
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement === inputRef.current || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = keys.current;
      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        k.applyAnswer(k.answer + e.key);
        inputRef.current?.focus();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        k.applyAnswer(k.answer.slice(0, -1));
        inputRef.current?.focus();
      } else if (e.key === "Enter") {
        k.submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  // Darken the scene as they scroll down to the next steps.
  // If the 3D ticket never arrives (slow device, no WebGL), show the reveal anyway.
  useEffect(() => {
    if (phase !== "reveal" || opened) return;
    const id = window.setTimeout(onOpened, 3500);
    return () => window.clearTimeout(id);
  }, [phase, opened, onOpened]);

  useEffect(() => {
    if (phase !== "reveal") return;
    const onScroll = () => setScrollDark(clamp(window.scrollY / (window.innerHeight * 0.7), 0, 1));
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [phase]);

  const openShare = async (format: ShareFormat) => {
    setSaving(true);
    try {
      const c = await renderShareCard({ name: cleanName, project, memberNo, date }, format);
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), "image/png"));
      setShare((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { format, blob, url: URL.createObjectURL(blob) };
      });
    } finally {
      setSaving(false);
    }
  };

  const shareFile = () =>
    share ? new File([share.blob], `tsi-${share.format}-${memberNo}.png`, { type: "image/png" }) : null;

  const shareNative = async () => {
    const file = shareFile();
    if (!file) return;
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: shareCaption(project) }).catch(() => {});
    } else downloadShare();
  };

  const downloadShare = () => {
    const file = shareFile();
    if (!file || !share) return;
    const a = document.createElement("a");
    a.href = share.url;
    a.download = file.name;
    a.click();
  };

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(shareCaption(project));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {}
  };

  const attemptsLeft = MAX_ATTEMPTS - history.length;
  const urgent = phase === "test" && remaining <= 15;

  const muteButton = (cls: string) => (
    <motion.button
      onClick={toggleMute}
      whileTap={{ scale: 0.88 }}
      transition={spring}
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      className={`${cls} flex shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/50 text-white/80 backdrop-blur`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 5 6 9H2v6h4l5 4V5z" />
        {muted ? <path d="m23 9-6 6M17 9l6 6" /> : <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />}
      </svg>
    </motion.button>
  );
  const dread = phase === "test" ? 1 - remaining / TIME_LIMIT_SECONDS : 0;
  const latest = history[0]?.fb ?? null;

  return (
    <main className="relative min-h-svh overflow-x-hidden bg-[#0b0c0f] text-[#f1ffff]">
      <style>{`
        @keyframes fr-glitch{0%,100%{transform:translate(0);text-shadow:2px 0 #22d3ee,-2px 0 #ef4444}25%{transform:translate(-3px,2px)}50%{transform:translate(3px,-2px);text-shadow:-3px 0 #22d3ee,3px 0 #ef4444}75%{transform:translate(-2px,-1px)}}
        @keyframes fr-caret{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes fr-blink{0%,100%{opacity:1}50%{opacity:.25}}
        @keyframes fr-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}
        .fr-panel{padding-top:44svh}
        @media (max-aspect-ratio:1/1){.fr-panel.fr-tight{padding-top:35svh}}
        @media (min-aspect-ratio:1/1){.fr-panel{padding-top:0;margin-left:50%;width:50%;min-height:100svh;display:flex;flex-direction:column;justify-content:center}}
        .fr-shimmer{background:linear-gradient(90deg,#ffd166 0%,#fff3cf 25%,#ffd166 50%,#fff3cf 75%,#ffd166 100%);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:fr-shimmer 3s linear infinite}
      `}</style>

      <div className="fixed inset-0 z-0">
        <SceneBoundary>
        <VaultScene
          mode={phase === "countdown" || phase === "status" || phase === "checking" ? "test" : phase}
          feedback={phase === "test" ? latest : null}
          guessKey={shake}
          name={cleanName}
          project={project}
          memberNo={memberNo}
          date={date}
          onOpened={onOpened}
          captureRef={captureRef}
        />
        </SceneBoundary>
      </div>

      {(phase === "gate" || phase === "countdown" || phase === "test") && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[1] h-[62svh] bg-gradient-to-t from-[#0b0c0f] via-[#0b0c0f]/90 to-transparent [@media(min-aspect-ratio:1/1)]:inset-y-0 [@media(min-aspect-ratio:1/1)]:left-1/2 [@media(min-aspect-ratio:1/1)]:h-auto [@media(min-aspect-ratio:1/1)]:bg-gradient-to-l" />
      )}
      {phase === "test" && (
        <div
          className="pointer-events-none fixed inset-0 z-[2] transition-[background] duration-1000"
          style={{
            background: `radial-gradient(ellipse at 50% 45%, transparent ${55 - dread * 25}%, rgba(${
              remaining <= 10 ? "30,0,0" : "0,0,0"
            },${(0.08 + dread * 0.55).toFixed(2)}) 100%)`,
          }}
        />
      )}

      <AnimatePresence>
        {(phase === "judging" || phase === "status" || phase === "checking") && (
          <motion.div
            key="hush"
            initial={{ opacity: 0 }}
            animate={{ opacity: phase === "judging" ? 0.35 : 0.7, transition: { duration: 1.4 } }}
            exit={{ opacity: 0, transition: { duration: 0.8 } }}
            className="pointer-events-none fixed inset-0 z-[3] bg-[#050506]"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {phase === "countdown" && (
          <motion.div
            key="countdown"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.3 } }}
            className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-[#0b0c0f]/70 backdrop-blur-sm"
          >
            <p className={`${mono} text-xs tracking-[0.35em] text-white/50`}>
              ASSESSMENT BEGINS IN
            </p>
            <AnimatePresence mode="popLayout">
              <motion.span
                key={count}
                initial={{ scale: 1.8, opacity: 0, filter: "blur(12px)" }}
                animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                exit={{ scale: 0.6, opacity: 0, filter: "blur(8px)" }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className={`${mono} mt-4 text-[9rem] font-bold leading-none tabular-nums`}
              >
                {count}
              </motion.span>
            </AnimatePresence>
            <p className="mt-6 text-sm text-white/45">One attempt. Make it count.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {phase === "test" && (
        <div className="fixed inset-x-0 top-0 z-20 px-4 pt-4">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <span className={`${mono} max-w-[45%] truncate text-[11px] tracking-[0.25em] text-white/50`}>
              {cleanName.toUpperCase()}
            </span>
            <span className="flex items-center gap-2">
            {muteButton("h-9 w-9")}
            <motion.span
              key={urgent ? remaining : "calm"}
              initial={urgent ? { scale: 1.08 } : false}
              animate={{ scale: 1 }}
              transition={spring}
              className={`${mono} rounded-lg bg-black/40 px-3 py-1 text-3xl font-bold tabular-nums backdrop-blur ${
                urgent ? "text-[#ef4444]" : "text-[#f1ffff]"
              }`}
              style={timeUp ? { animation: "fr-blink .45s steps(1) infinite" } : undefined}
            >
              {fmt(remaining)}
            </motion.span>
            </span>
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
              <p className={`${mono} text-[11px] tracking-[0.2em] text-[#22d3ee] sm:text-xs sm:tracking-[0.3em]`}>
                TECH FOR SOCIAL IMPACT / FINAL ROUND
              </p>
              <h1 className="mt-3 text-[2rem] font-bold leading-[1.05] sm:text-5xl">
                Competence Assessment
              </h1>
              <p className="mt-4 text-[#9ca3af]">
                There is only one attempt at the final round. It is make or
                break: your result here decides your application.
              </p>
              <p className="mt-2 text-sm text-white/45">
                Don&apos;t worry, most applicants complete this with no problem.
              </p>
              <ul className={`${mono} mt-5 space-y-1.5 text-sm text-[#e5e7eb]`}>
                {[
                  `Crack the ${CODE_LENGTH}-digit vault code.`,
                  `${fmt(TIME_LIMIT_SECONDS)} on the clock. It does not pause.`,
                  `${MAX_ATTEMPTS} guesses. Pure logic, no luck required.`,
                  "One attempt only. Results are final.",
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
              {!invite && (
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
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...spring, delay: 0.6 }}
                className={`${invite ? "mt-7" : "mt-4"} rounded-2xl border border-white/10 bg-[#121418]/90 p-4 backdrop-blur`}
              >
                {invite && (
                  <>
                    <p className={`${mono} text-[10px] tracking-[0.3em] text-white/45`}>CANDIDATE</p>
                    <p className="mt-1 text-2xl font-bold">{invite.name}</p>
                    {project && (
                      <>
                        <p className={`${mono} mt-3 text-[10px] tracking-[0.3em] text-white/45`}>APPLIED TO</p>
                        <p className="mt-1 text-[#22d3ee]">{project}</p>
                      </>
                    )}
                  </>
                )}
                <div className={`${invite ? "mt-3 border-t border-white/10 pt-3" : ""} flex items-end justify-between gap-3`}>
                  <div>
                    <p className={`${mono} text-[10px] tracking-[0.3em] text-white/45`}>APPLICATION STATUS</p>
                    <p className={`${mono} mt-1 flex items-center gap-2 text-sm font-semibold text-[#ffd166]`}>
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ffd166] opacity-60" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ffd166]" />
                      </span>
                      PENDING FINAL ROUND
                    </p>
                  </div>
                  {cleanName && (
                    <p className={`${mono} text-right text-xs text-white/45`}>{applicationId(cleanName)}</p>
                  )}
                </div>
              </motion.div>
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
          <motion.section key="test" {...enter} className="fr-panel fr-tight relative z-10 px-4 pb-10">
            <div className="mx-auto w-full max-w-md">
              <p className={`${mono} text-xs tracking-[0.25em] text-[#22d3ee]`}>
                VAULT / ACCESS CODE
              </p>
              {history.length === 0 && (
                <p className="mt-2 text-sm leading-relaxed text-[#cbd5e1]">
                  After each guess, every digit gets a colour. Digits can repeat.
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1.5 text-xs text-[#cbd5e1]">
                {[
                  ["border-[#22c55e] bg-[#22c55e]/20 text-[#4ade80]", "Right spot"],
                  ["border-[#ffd166] bg-[#ffd166]/15 text-[#ffd166]", "Wrong spot"],
                  ["border-white/15 bg-white/5 text-white/40", "Not in code"],
                ].map(([cls, label], i) => (
                  <span key={label} className="flex items-center gap-1.5">
                    <span className={`${mono} flex h-5 w-5 items-center justify-center rounded-[5px] border text-[11px] font-semibold ${cls}`}>
                      {[7, 3, 1][i]}
                    </span>
                    {label}
                  </span>
                ))}
              </div>

              {history.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {[...history].reverse().map((h, idx) => {
                    const latest = idx === history.length - 1;
                    return (
                      <motion.li
                        key={idx}
                        initial={{ opacity: 0, y: 10, scale: 0.97 }}
                        animate={{ opacity: latest ? 1 : 0.55, y: 0, scale: 1 }}
                        transition={spring}
                        className={`flex items-center justify-between rounded-xl border bg-[#121418]/90 px-3 py-2 backdrop-blur ${
                          latest ? "border-white/20" : "border-white/10"
                        }`}
                      >
                        <span className={`${mono} w-6 text-xs text-white/40`}>#{idx + 1}</span>
                        <span className="flex gap-1.5" style={{ perspective: 400 }}>
                          {h.fb.map((m, k) => (
                            <motion.span
                              key={k}
                              initial={latest ? { rotateX: -90, opacity: 0 } : false}
                              animate={{ rotateX: 0, opacity: 1 }}
                              transition={{ ...spring, delay: 0.1 * k }}
                              className={`${mono} flex h-8 w-8 items-center justify-center rounded-[7px] border text-base font-semibold ${
                                m === 2
                                  ? "border-[#22c55e] bg-[#22c55e]/20 text-[#4ade80] shadow-[0_0_14px_-4px_#22c55e]"
                                  : m === 1
                                    ? "border-[#ffd166] bg-[#ffd166]/15 text-[#ffd166]"
                                    : "border-white/10 bg-white/5 text-white/35"
                              }`}
                            >
                              {h.guess[k]}
                            </motion.span>
                          ))}
                        </span>
                        <span className={`${mono} w-8 text-right text-xs text-[#4ade80]`}>
                          {greens(h.fb)}/{CODE_LENGTH}
                        </span>
                      </motion.li>
                    );
                  })}
                </ul>
              )}

              {!inputFocused && !answer && !timeUp && (
                <p
                  className={`${mono} mt-4 text-center text-[11px] tracking-[0.2em] text-[#1d9bf0]`}
                  style={{ animation: "fr-caret 1.4s ease-in-out infinite" }}
                >
                  TAP THE BOXES TO TYPE
                </p>
              )}
              {finalSet && (
                <p className={`${mono} mt-4 text-[11px] tracking-[0.25em] text-[#ef4444]`}>
                  FINAL ATTEMPT
                </p>
              )}
              <motion.div
                className={`${finalSet ? "mt-2" : "mt-4"} transition-opacity duration-300 ${timeUp ? "pointer-events-none opacity-40" : ""}`}
                animate={shakeCtl}
              >
                <div className="relative" onClick={() => inputRef.current?.focus()}>
                  <input
                    ref={inputRef}
                    value={answer}
                    onChange={(e) => applyAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    inputMode="numeric"
                    autoComplete="off"
                    aria-label={`${CODE_LENGTH}-digit code`}
                    className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
                  />
                  <div className="grid grid-cols-6 gap-1.5 sm:gap-2">
                    {Array.from({ length: CODE_LENGTH }, (_, i) => {
                      const ch = answer[i];
                      const active = i === answer.length;
                      return (
                        <div
                          key={i}
                          className={`${mono} relative flex aspect-[3/4] items-center justify-center overflow-hidden rounded-[10px] border text-3xl font-semibold sm:text-4xl transition-colors duration-150 ${
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
                                className="h-7 w-[3px] rounded bg-[#1d9bf0]"
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
                  onPointerDown={(e) => e.preventDefault()}
                  disabled={answer.length !== CODE_LENGTH || attemptsLeft <= 0 || finalSet}
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

              <p className={`${mono} pt-4 text-center text-[11px] tracking-[0.15em] text-[#ef4444]/70`}>
                YOUR APPLICATION DEPENDS ON THIS RESULT.
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
            <p className={`${mono} text-xs tracking-[0.3em] text-[#ef4444]`}>TIME EXPIRED</p>
            <h1
              className="mt-3 text-4xl font-bold sm:text-5xl"
              style={{ animation: "fr-glitch .5s infinite" }}
            >
              Assessment ended.
            </h1>
            <p className="mt-3 text-[#9ca3af]">Submitting your result...</p>
          </motion.section>
        )}

        {phase === "status" && (
          <motion.section
            key="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 1.6, delay: 0.6 } }}
            exit={{ opacity: 0, transition: { duration: 0.4 } }}
            className="relative z-10 flex min-h-svh flex-col items-center justify-end px-4 pb-[12svh] text-center"
          >
            <p className={`${mono} text-xs tracking-[0.3em] text-white/45`}>ASSESSMENT COMPLETE</p>
            <h1 className="mt-3 text-3xl font-bold sm:text-4xl">Your result has been recorded.</h1>
            <p className="mt-3 max-w-sm text-[#9ca3af]">
              A decision has been made on your application.
            </p>
            <motion.button
              onClick={checkStatus}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 1, duration: 0.6 } }}
              whileTap={{ scale: 0.96 }}
              className="relative mt-8 rounded-full bg-[#ffd166] px-8 py-4 text-lg font-bold text-[#0b0c0f] shadow-[0_10px_40px_-8px_rgba(255,209,102,0.9)]"
            >
              <span className="absolute inset-0 animate-ping rounded-full bg-[#ffd166] opacity-30" aria-hidden />
              <span className="relative">Check application status</span>
            </motion.button>
          </motion.section>
        )}

        {phase === "checking" && (
          <motion.section
            key="checking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.6 } }}
            className="relative z-10 flex min-h-svh flex-col items-center justify-end px-4 pb-[14svh] text-center"
          >
            <p className={`${mono} text-xs tracking-[0.3em] text-white/45`}>APPLICATION STATUS</p>
            <p className="mt-4 flex items-center gap-2 text-lg text-white/80">
              Retrieving your result
              <span className="flex gap-1">
                {[0, 1, 2].map((d) => (
                  <motion.span
                    key={d}
                    className="h-1.5 w-1.5 rounded-full bg-white/70"
                    animate={{ opacity: [0.2, 1, 0.2] }}
                    transition={{ duration: 1.1, repeat: Infinity, delay: d * 0.18 }}
                  />
                ))}
              </span>
            </p>
          </motion.section>
        )}
      </AnimatePresence>

      {phase === "reveal" && (
        <>
          <div
            className="pointer-events-none fixed inset-0 z-[5] bg-[#050506]"
            style={{ opacity: scrollDark * 0.88 }}
          />
          <section className="pointer-events-none relative z-10 flex min-h-svh flex-col items-center justify-between px-4 pb-20 pt-[7svh] text-center">
            <AnimatePresence>
              {opened && (
                <motion.div key="head" initial="h" animate="s" variants={{ s: { transition: { staggerChildren: 0.12 } } }} className="relative">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute -inset-x-10 -inset-y-8 -z-10"
                    style={{ background: "radial-gradient(ellipse at center, rgba(5,5,6,0.82) 0%, rgba(5,5,6,0.55) 45%, transparent 75%)" }}
                  />
                  {[
                    <h1
                      key="b"
                      className="text-[clamp(2.1rem,11vw,4.5rem)] font-extrabold leading-none tracking-tight"
                      style={{ textShadow: "0 2px 18px rgba(0,0,0,0.85)" }}
                    >
                      {returning ? "WELCOME BACK." : "JUST KIDDING."}
                    </h1>,
                    <h2
                      key="c"
                      className="fr-shimmer mt-2 text-[clamp(1.3rem,6.6vw,3rem)] font-extrabold"
                      style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.95)) drop-shadow(0 0 14px rgba(0,0,0,0.85))" }}
                    >
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
                  className="pointer-events-auto flex w-full flex-col items-center"
                >
                  <div className="flex w-full max-w-sm gap-3">
                    <motion.button
                      onClick={() => openShare("post")}
                      disabled={saving}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.95 }}
                      transition={spring}
                      className="flex-1 rounded-full border border-[#ffd166]/70 bg-black/40 px-5 py-3 font-bold text-[#ffd166] backdrop-blur disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save ticket"}
                    </motion.button>
                    <motion.button
                      onClick={() => document.getElementById("next")?.scrollIntoView({ behavior: "smooth" })}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.95 }}
                      transition={spring}
                      className="flex-1 rounded-full bg-[#ffd166] px-5 py-3 font-bold text-[#0b0c0f] shadow-[0_10px_40px_-8px_rgba(255,209,102,0.8)]"
                    >
                      Next steps ↓
                    </motion.button>
                  </div>
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
                <p className="mt-3 rounded-xl border border-[#ffd166]/40 bg-[#ffd166]/10 px-4 py-3 text-sm text-[#ffe9b0]">
                  To confirm your position, complete these by <strong>{deadlineLabel(revealedAt)}</strong>.
                  {invite && emailsOn ? " We've also emailed them to you." : ""}
                </p>
                <ol className="mt-5 space-y-3">
                  {ONBOARDING.map((s, i) => (
                    <motion.li
                      key={s.title}
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-40px" }}
                      transition={{ ...spring, delay: i * 0.08 }}
                      className="flex gap-4 rounded-2xl border border-white/10 bg-[#121418] p-4"
                    >
                      <span className={`${mono} text-2xl font-bold text-[#ffd166]`}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{s.title}</p>
                        <p className="mt-0.5 text-sm text-[#9ca3af]">{s.body}</p>
                        {s.href ? (
                          <motion.a
                            href={s.href}
                            target="_blank"
                            rel="noreferrer"
                            whileHover={{ scale: 1.03 }}
                            whileTap={{ scale: 0.96 }}
                            transition={spring}
                            className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#1d9bf0] px-4 py-2 text-sm font-semibold text-white"
                          >
                            {s.cta} <span aria-hidden>→</span>
                          </motion.a>
                        ) : null}
                      </div>
                    </motion.li>
                  ))}
                </ol>
              </div>
            </section>
          )}
        </>
      )}
      {phase !== "test" && muteButton("fixed bottom-4 right-4 z-30 h-11 w-11")}
      <input
        ref={proxyRef}
        aria-hidden
        tabIndex={-1}
        inputMode="numeric"
        className="pointer-events-none fixed left-0 top-0 h-px w-px opacity-0"
        style={{ fontSize: 16 }}
      />

      <AnimatePresence>
        {share && (
          <motion.div
            key="share"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShare(null)}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={spring}
              onClick={(e) => e.stopPropagation()}
              className="flex max-h-[92svh] w-full max-w-md flex-col rounded-t-3xl border border-white/10 bg-[#111317] p-4 sm:rounded-3xl"
            >
              <div className="flex items-center justify-between">
                <div className="flex gap-1 rounded-full bg-white/5 p-1 text-sm">
                  {(["post", "story"] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => openShare(f)}
                      className={`rounded-full px-4 py-1.5 font-semibold transition ${
                        share.format === f ? "bg-white text-black" : "text-white/60"
                      }`}
                    >
                      {f === "post" ? "Post" : "Story"}
                    </button>
                  ))}
                </div>
                <button onClick={() => setShare(null)} aria-label="Close" className="px-2 text-2xl leading-none text-white/50">
                  ×
                </button>
              </div>
              <div className="mt-3 flex min-h-0 flex-1 justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                <img
                  src={share.url}
                  alt="Your acceptance ticket"
                  className={`max-h-full rounded-xl object-contain ${share.format === "story" ? "max-h-[52svh]" : "max-h-[50svh]"}`}
                />
              </div>
              <p className="mt-3 text-center text-xs text-white/45">
                Sized for Instagram, LinkedIn and X. Tag us when you post.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={shareNative} className="rounded-xl bg-[#ffd166] py-3 text-sm font-bold text-black">
                  Share
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={downloadShare} className="rounded-xl border border-white/15 py-3 text-sm font-semibold">
                  Download
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={copyCaption} className="rounded-xl border border-white/15 py-3 text-sm font-semibold">
                  {copied ? "Copied" : "Copy caption"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
