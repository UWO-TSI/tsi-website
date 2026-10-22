"use client";

/**
 * The hair colour wheel (head-v10, row 311; David: "hair color needs more choices like color wheel picker"): any
 * colour, beside the presets. A disc of hue (round) and saturation (out from the centre) at the chosen value, a value
 * slider under it and the hex. Drag or click the disc; on the keyboard the disc takes the arrows (left and right turn
 * the hue, up and down the saturation) and the slider the value. Only the preview re-tints while you drag (Character
 * defers the new look and merges it once); the hair tiles are static pictures and never redraw. Unlocked by buying the
 * colour wheel in the shop (David, 2026-10-17: a one-time 250-Gem unlock; look.ts customHairUnlocked): locked, it shows
 * greyed with the hint and, where the sheet can open the shop, a way there.
 */
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { Lock } from "lucide-react";
import { Slider } from "@/components/gui";
import { hexToHsv, hsvToHex, wheelPick, wheelPoint, type Hsv } from "@/lib/game/character/colour";
import styles from "./CharacterCreator.module.css";

const HEX_INPUT = /^#?[0-9a-fA-F]{6}$/;

export default function ColourWheel({ value, active, locked = false, onShop, onChange }: {
  /** The colour shown now (sRGB hex): the custom one, or the preset worn. */
  value: string;
  /** The look wears a custom colour (the wheel's marker shows as chosen). */
  active: boolean;
  /** The colour wheel not bought yet: the wheel shows, greyed, with how to unlock it. */
  locked?: boolean;
  /** Opens the shop (the closet and fitting room). */
  onShop?: () => void;
  onChange: (hex: string) => void;
}) {
  // The wheel's own last pick, while the look still wears it (it keeps a grey's hue and the exact saturation); a preset
  // picked elsewhere moves the wheel to that colour, at the last hue for a grey.
  const [own, setOwn] = useState<{ hsv: Hsv; hex: string } | null>(null);
  const hsv = own && own.hex === value ? own.hsv : hexToHsv(value, own?.hsv.h ?? 0);
  const [typed, setTyped] = useState<string | null>(null);
  const disc = useRef<HTMLDivElement>(null);
  const send = (next: Hsv) => {
    if (locked) return;
    const hex = hsvToHex(next);
    setOwn({ hsv: next, hex });
    onChange(hex);
  };
  const pick = (e: PointerEvent<HTMLDivElement>) => {
    const r = disc.current!.getBoundingClientRect(), rad = r.width / 2;
    const { h, s } = wheelPick((e.clientX - r.left - rad) / rad, (e.clientY - r.top - rad) / rad);
    // a pick on a black wheel would show nothing: bring the value up so the hue reads
    send({ h, s, v: Math.max(hsv.v, 0.25) });
  };
  const keys = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 15 : 5;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step / 100], ArrowDown: [0, -step / 100] }[e.key];
    if (!d) return;
    e.preventDefault();
    send({ h: (hsv.h + d[0] + 360) % 360, s: Math.min(1, Math.max(0, hsv.s + d[1])), v: hsv.v });
  };
  const hex = hsvToHex(hsv), at = wheelPoint(hsv.h, hsv.s);
  if (locked) return <div className={styles.wheel} data-locked>
    <div className={styles.wheelDisc} style={{ "--dim": 0 } as CSSProperties} aria-hidden="true"><Lock size={22} strokeWidth={2.6} className={styles.wheelLock} /></div>
    <p className={styles.hint}>Unlock any hair colour with the Hair colour wheel in the shop.{onShop && <> <button type="button" className={styles.hintLink} onClick={onShop}>Visit the shop</button></>}</p>
  </div>;
  return <div className={styles.wheel} data-active={active || undefined}>
    <div ref={disc} className={styles.wheelDisc} role="slider" tabIndex={0} aria-label="Hue and saturation (arrow keys)"
      aria-valuemin={0} aria-valuemax={360} aria-valuenow={Math.round(hsv.h)} aria-valuetext={`${hex}, hue ${Math.round(hsv.h)} degrees, saturation ${Math.round(hsv.s * 100)}%`}
      style={{ "--dim": 1 - hsv.v } as CSSProperties} onKeyDown={keys}
      onPointerDown={e => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
      onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e); }}>
      <i className={styles.wheelMark} style={{ left: `${50 + at.x * 50}%`, top: `${50 + at.y * 50}%`, background: hex }} aria-hidden="true" />
    </div>
    <div className={styles.wheelSide}>
      <Slider className={styles.slider} label="Brightness" min={0} max={100} value={Math.round(hsv.v * 100)} format={v => `${v}%`}
        onChange={v => send({ ...hsv, v: v / 100 })} />
      <label className={styles.wheelHex}>
        <span className={styles.wheelChip} style={{ background: hex }} aria-hidden="true" />
        <input value={typed ?? hex} maxLength={7} spellCheck={false} aria-label="Hex colour" aria-invalid={typed !== null && !HEX_INPUT.test(typed) || undefined}
          onChange={e => {
            const t = e.target.value.trim();
            setTyped(t);
            if (HEX_INPUT.test(t)) send(hexToHsv(`#${t.replace("#", "")}`.toUpperCase(), hsv.h));
          }} onBlur={() => setTyped(null)} />
      </label>
    </div>
  </div>;
}
