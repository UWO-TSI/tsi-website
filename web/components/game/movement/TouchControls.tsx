"use client";

import { useRef, useState } from "react";
import { touchStick as stick } from "./moveFx";

/** Touch (specs/movement.md "Controls"): a joystick (push to the rim to sprint) and jump and dash buttons, into the avatar's touch stick. */
export default function TouchControls() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState<[number, number]>([0, 0]);
  const move = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect(), R = r.width / 2;
    let dx = (e.clientX - (r.left + R)) / R, dy = (e.clientY - (r.top + R)) / R;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    stick.x = dx; stick.z = -dy;
    setKnob([dx * R * 0.6, dy * R * 0.6]);
  };
  const end = () => { stick.x = stick.z = 0; setKnob([0, 0]); };
  const button = (kind: "jump" | "dash", text: string, size: number) => (
    <button aria-label={text} style={{ width: size, height: size, borderRadius: "50%", border: "2px solid rgba(255,255,255,0.5)", background: "rgba(15,15,16,0.45)", color: "#fff", font: "700 14px ui-monospace, Menlo, monospace", touchAction: "none" }}
      onPointerDown={e => { e.preventDefault(); stick[kind] = true; stick[kind === "jump" ? "jumpPressed" : "dashPressed"] = true; }}
      onPointerUp={() => { stick[kind] = false; }} onPointerCancel={() => { stick[kind] = false; }} onPointerLeave={() => { stick[kind] = false; }}>{text}</button>
  );
  return <>
    <div ref={base} data-testid="touch-stick" onPointerDown={e => { (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }} onPointerMove={e => { if (e.buttons) move(e); }} onPointerUp={end} onPointerCancel={end}
      style={{ position: "absolute", left: 24, bottom: 28, width: 132, height: 132, borderRadius: "50%", background: "rgba(15,15,16,0.35)", border: "2px solid rgba(255,255,255,0.35)", touchAction: "none", zIndex: 20 }}>
      <div style={{ position: "absolute", left: 66 - 26 + knob[0], top: 66 - 26 + knob[1], width: 52, height: 52, borderRadius: "50%", background: "rgba(255,255,255,0.7)", pointerEvents: "none" }} />
    </div>
    <div style={{ position: "absolute", right: 24, bottom: 28, display: "flex", gap: 14, alignItems: "flex-end", zIndex: 20 }}>
      {button("dash", "Dash", 64)}{button("jump", "Jump", 84)}
    </div>
  </>;
}
