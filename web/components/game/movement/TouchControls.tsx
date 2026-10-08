"use client";

import { useEffect, useRef } from "react";
import { touchStick as stick } from "./moveFx";

/**
 * Touch (specs/movement.md "Controls"): a joystick (push to the rim to sprint) and jump, dash and slide buttons, into the avatar's touch stick; `left`/`bottom` clear a HUD. Slide is held: crouch at a walk, slide at speed (specs/movement-slide.md).
 * Sized by the page (world audit item 11): `--touch-stick` (132px) and `--touch-scale` (1) shrink them for a phone on its side, and the buttons keep
 * clear of the right safe area through `--hud-edge`.
 */
export default function TouchControls({ left = 24, bottom = 28, walkOnly = false }: { left?: number | string; bottom?: number | string; walkOnly?: boolean }) {
  const base = useRef<HTMLDivElement>(null), knob = useRef<HTMLDivElement>(null);
  // The knob moves through its style, not state: pointermove fires far more often than a render is worth.
  const setKnob = (x: number, y: number) => { if (knob.current) knob.current.style.transform = `translate(${x}px, ${y}px)`; };
  const move = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect(), R = r.width / 2;
    let dx = (e.clientX - (r.left + R)) / R, dy = (e.clientY - (r.top + R)) / R;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    stick.x = dx; stick.z = -dy;
    setKnob(dx * R * 0.6, dy * R * 0.6);
  };
  const end = () => { stick.x = stick.z = 0; setKnob(0, 0); };
  // Unmounted mid-press (entering a building): let go, or the avatar walks or hops on its own when it comes back.
  useEffect(() => () => { stick.x = stick.z = 0; stick.jump = stick.jumpPressed = stick.dashPressed = stick.crouch = false; }, []);
  // Jump and slide are also held (a held jump goes higher, a held slide keeps sliding); a dash is a press.
  const up = () => { stick.jump = false; stick.crouch = false; };
  const button = (kind: "jump" | "dash" | "slide", text: string, size: number) => (
    <button aria-label={text} style={{ width: `calc(${size}px * var(--touch-scale, 1))`, height: `calc(${size}px * var(--touch-scale, 1))`, padding: 0, borderRadius: "50%", border: 0, background: "rgb(255 250 230 / 0.92)", color: "var(--gui-ink-strong, #3a2e22)", boxShadow: "0 3px 0 rgb(114 92 78 / 0.25), 0 6px 16px rgb(41 70 65 / 0.18)", font: "800 14px var(--gui-font, system-ui)", touchAction: "none" }}
      onPointerDown={e => { e.preventDefault(); if (kind === "jump") stick.jump = stick.jumpPressed = true; else if (kind === "slide") stick.crouch = true; else stick.dashPressed = true; }}
      onPointerUp={up} onPointerCancel={up} onPointerLeave={up}>{text}</button>
  );
  return <>
    <div ref={base} data-testid="touch-stick" onPointerDown={e => { (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }} onPointerMove={e => { if (e.buttons) move(e); }} onPointerUp={end} onPointerCancel={end}
      style={{ position: "absolute", left, bottom, width: "var(--touch-stick, 132px)", height: "var(--touch-stick, 132px)", borderRadius: "50%", background: "rgb(255 250 230 / 0.42)", border: "3px solid rgb(255 251 231 / 0.85)", boxShadow: "inset 0 2px 8px rgb(114 92 78 / 0.18)", touchAction: "none", zIndex: 20 }}>
      <div ref={knob} style={{ position: "absolute", left: "calc(50% - 26px * var(--touch-scale, 1))", top: "calc(50% - 26px * var(--touch-scale, 1))", width: "calc(52px * var(--touch-scale, 1))", height: "calc(52px * var(--touch-scale, 1))", borderRadius: "50%", background: "rgb(255 250 230 / 0.95)", boxShadow: "0 3px 0 rgb(114 92 78 / 0.25)", pointerEvents: "none" }} />
    </div>
    <div style={{ position: "absolute", right: "max(24px, var(--hud-edge, 0px))", bottom, display: "flex", gap: "calc(14px * var(--touch-scale, 1))", alignItems: "flex-end", zIndex: 20 }}>
      {!walkOnly && <>{button("slide", "Slide", 60)}{button("dash", "Dash", 64)}{button("jump", "Jump", 84)}</>}
    </div>
  </>;
}
