"use client";

import { useRef, useState } from "react";

const NOISE = "@#%&*+=01<>/\\";

/** Scrambles a node's text into `to`, every character settling out of noise at its own moment. */
function glitchTo(node: HTMLElement, to: string, ms = 420) {
  const settle = Array.from(to, () => Math.random() * ms);
  const t0 = performance.now();
  const tick = () => {
    const t = performance.now() - t0;
    node.textContent = Array.from(to, (c, k) => (t >= settle[k] ? c : NOISE[Math.floor(Math.random() * NOISE.length)])).join("");
    if (t < ms) setTimeout(tick, 40);
    else node.textContent = to;
  };
  tick();
}

/** The address, big: a click copies it, glitches to "Copied", and glitches back. */
export default function CopyEmail({ email }: { email: string }) {
  const text = useRef<HTMLSpanElement>(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try { await navigator.clipboard.writeText(email); } catch { window.location.href = `mailto:${email}`; return; }
    setCopied(true);
    const node = text.current;
    if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setTimeout(() => setCopied(false), 1600); return; }
    glitchTo(node, "Copied.");
    setTimeout(() => { glitchTo(node, email); setCopied(false); }, 1500);
  };

  return (
    <button type="button" className="ct-email" onClick={copy} aria-label={`Copy ${email}`} data-copied={copied || undefined}>
      <span ref={text} className="ct-email__text">{email}</span>
      <span className="ct-email__hint" aria-live="polite">{copied ? "On your clipboard" : <><span className="ts-hover-only">Click</span><span className="ts-touch-only">Tap</span> to copy</>}</span>
    </button>
  );
}
