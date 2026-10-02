"use client";

/**
 * The tool wheel (row 279, specs/game-ui.md §1; David's direction, row 283: an ACNH flower in the cream kit).
 * Hold the wheel key (Tab): after a beat the flower opens round the screen's centre, the world dims a little and
 * slows, and a flick of the mouse (added up under pointer lock, the cursor's direction otherwise) grows the petal it
 * points at, its name below; letting go takes it out, the centre puts things away. A quick tap swaps back to the
 * last thing held. On a touch screen the wheel button opens it and a tap chooses. Esc closes it unchanged.
 * Under pointer lock the wheel keeps the mouse (the camera holds still while it's open).
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Hand } from "lucide-react";
import { AudioManager } from "@/lib/game/audio";
import { flick, slotAt, slotPosition, type WheelItem } from "@/lib/game/toolWheel";
import { keyName } from "@/lib/game/movement/keys";
import { slowMotion } from "@/lib/game/slowMotion";
import styles from "./ToolWheel.module.css";

/** A press shorter than this (with no flick) is the quick tap; the flower opens after it. */
const TAP_MS = 170;
/** The petals' ring and the flick's reach (px); within DEAD of the centre is the centre. */
const RING = 118, REACH = 120, DEAD = 34;
type Choice = number | null | "keep";

const sfx = (name: Parameters<typeof AudioManager.playSFX>[0], rate: number, gain: number) => AudioManager.playSFX(name, { rate, gain });

export default function ToolWheel({ items, held, wheelKey, enabled, touch, onEquip, onSwap }: {
  items: readonly WheelItem[]; held: string | null; wheelKey: string; enabled: boolean; touch: boolean;
  onEquip: (id: string | null) => void; onSwap: () => void;
}) {
  const [open, setOpen] = useState<false | "key" | "touch">(false);
  const [shown, setShown] = useState(false);
  const [choice, setChoice] = useState<Choice>("keep");
  const live = useRef({ open: false as false | "key" | "touch", at: 0, v: [0, 0] as [number, number], choice: "keep" as Choice, timer: 0, items, held, enabled });
  useEffect(() => { live.current.items = items; live.current.held = held; live.current.enabled = enabled; }, [items, held, enabled]);

  const choose = useCallback((next: Choice) => {
    const l = live.current;
    if (next === l.choice) return;
    l.choice = next;
    setChoice(next);
    if (next !== "keep") sfx("click", 1.55, 0.22);
  }, []);
  const show = useCallback(() => {
    setShown(true);
    slowMotion(true);
    sfx("blip3", 0.82, 0.45);
  }, []);
  const close = useCallback((take: boolean) => {
    const l = live.current;
    window.clearTimeout(l.timer);
    if (!l.open) return;
    const wasShown = performance.now() - l.at >= TAP_MS || l.open === "touch";
    if (take) {
      if (!wasShown && l.choice === "keep") onSwap();
      else if (l.choice !== "keep") {
        const id = l.choice === null ? null : l.items[l.choice]?.id ?? null;
        if (id !== l.held) { onEquip(id); sfx(id ? "confirm" : "exit", id ? 1.15 : 1.2, 0.45); }
      }
    }
    l.open = false; l.choice = "keep";
    setOpen(false); setShown(false); setChoice("keep");
    slowMotion(false);
  }, [onEquip, onSwap]);
  const begin = useCallback((how: "key" | "touch") => {
    const l = live.current;
    if (l.open || !l.enabled || !l.items.length) return;
    l.open = how; l.at = performance.now(); l.v = [0, 0]; l.choice = "keep";
    setOpen(how); setChoice("keep");
    if (how === "touch") show();
    else l.timer = window.setTimeout(show, TAP_MS);
  }, [show]);

  // The wheel key: down opens, up takes out (or swaps back on a tap). Tab never moves focus while in the world.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase(), l = live.current;
      if (l.open && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(false); return; }
      if (k !== wheelKey || e.metaKey || e.ctrlKey || e.altKey) return;
      // Typing, or a sheet open: the key is theirs (a focused HUD button still lets the wheel have Tab).
      if (document.activeElement?.matches("input, textarea, select, [contenteditable='true']") || document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      e.preventDefault();
      if (!e.repeat) begin("key");
    };
    const up = (e: KeyboardEvent) => { if (e.key.toLowerCase() === wheelKey && live.current.open === "key") { e.preventDefault(); close(true); } };
    const blur = () => close(false);
    window.addEventListener("keydown", down, true);
    window.addEventListener("keyup", up, true);
    window.addEventListener("blur", blur);
    return () => { window.removeEventListener("keydown", down, true); window.removeEventListener("keyup", up, true); window.removeEventListener("blur", blur); };
  }, [wheelKey, begin, close]);
  // The flick: under pointer lock the movement adds up (and the camera doesn't see it); with a cursor, its direction from the centre.
  useEffect(() => {
    if (open !== "key") return;
    const move = (e: MouseEvent) => {
      const l = live.current, n = l.items.length;
      if (document.pointerLockElement) {
        e.stopPropagation();
        l.v = flick(l.v, e.movementX, e.movementY, REACH);
      } else l.v = [e.clientX - window.innerWidth / 2, e.clientY - window.innerHeight / 2];
      const d = Math.hypot(...l.v);
      if (l.choice === "keep" && d < DEAD) return; // nothing chosen until the flick leaves the centre
      choose(slotAt(l.v[0], l.v[1], n, DEAD));
    };
    window.addEventListener("mousemove", move, true);
    return () => window.removeEventListener("mousemove", move, true);
  }, [open, choose]);
  useEffect(() => () => { slowMotion(false); window.clearTimeout(live.current.timer); }, []);

  const n = items.length, picked = choice === "keep" ? items.findIndex(i => i.id === held) : choice;
  const label = picked === null ? "Put away" : picked >= 0 ? items[picked].name : held ? "" : "Empty hands";
  const sub = picked !== null && picked >= 0 && items[picked].kind !== "pin" && items[picked].tier ? `Tier ${items[picked].tier}` : null;
  return <>
    {touch && !open && enabled && n > 0 && <button className={styles.touchButton} onClick={() => begin("touch")} aria-label="Open the tool wheel">
      {held ? <ItemIcon item={items.find(i => i.id === held) ?? null} /> : <Hand size={22} aria-hidden />}
    </button>}
    {open && <div className={styles.wheel} data-shown={shown || undefined} role="menu" aria-label="Tool wheel" onClick={open === "touch" ? () => close(false) : undefined}>
      <div className={styles.flower} style={{ "--n": n } as CSSProperties}>
        <span className={styles.base} aria-hidden />
        {items.map((item, i) => {
          const [x, y] = slotPosition(i, n, RING);
          return <button key={item.id} role="menuitem" className={styles.petal} data-chosen={choice === i || undefined} data-held={item.id === held || undefined}
            style={{ "--x": `${x}px`, "--y": `${y}px`, "--a": `${(i / n) * 360}deg`, "--i": i } as CSSProperties}
            onMouseEnter={() => open === "key" && !document.pointerLockElement && choose(i)}
            onClick={e => { e.stopPropagation(); live.current.choice = i; close(true); }} aria-label={item.name}>
            <span className={styles.petalFace}><ItemIcon item={item} />{item.tier && item.kind !== "pin" ? <span className={styles.pips} aria-hidden>{Array.from({ length: item.tier }, (_, k) => <i key={k} />)}</span> : null}</span>
          </button>;
        })}
        <button role="menuitem" className={styles.centre} data-chosen={choice === null || undefined} aria-label="Put away"
          onMouseEnter={() => open === "key" && !document.pointerLockElement && choose(null)}
          onClick={e => { e.stopPropagation(); live.current.choice = null; close(true); }}><Hand size={24} aria-hidden /></button>
      </div>
      <p className={styles.name} aria-live="polite">{label && <b>{label}</b>}{sub && <small>{sub}</small>}</p>
      {open === "key" && <p className={styles.hint}>Let go of <kbd>{keyName(wheelKey)}</kbd> to {choice === null ? "put it away" : "take it out"} · <kbd>Esc</kbd> keeps what you have</p>}
    </div>}
  </>;
}

function ItemIcon({ item }: { item: WheelItem | null }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!item || failed === item.icon) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className={styles.icon} src={item.icon} alt="" draggable={false} onError={() => setFailed(item.icon)} />;
}
