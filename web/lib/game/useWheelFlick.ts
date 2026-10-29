import { useCallback, useEffect, useRef } from "react";
import { pen } from "./orbitCamera";
import { flickPick, newFlick } from "./toolWheel";

/**
 * The hold-to-pick wheels' mouse (ToolWheel, EmoteWheel). While `active`, the mouse's movement picks the slot in its
 * direction (toolWheel `flickPick`: added up, past a dead zone), the same under pointer lock and with a free cursor
 * (`cursor` false: under the lock only, where the cursor can't reach the petals). Under the lock the camera hands the
 * mouse over (orbitCamera `pen`, after its glitch filter), so the view holds still while a wheel is open.
 * Returns a reset (back to the centre, nothing chosen) for a wheel that swaps its ring.
 */
export function useWheelFlick(active: boolean, cursor: boolean, slots: () => number, onPick: (i: number | null) => void, reach: number, dead: number) {
  const flick = useRef(newFlick());
  const live = useRef({ slots, onPick });
  useEffect(() => { live.current = { slots, onPick }; });
  useEffect(() => {
    if (!active) return;
    flick.current = newFlick();
    const step = (dx: number, dy: number) => {
      const i = flickPick(flick.current, dx, dy, live.current.slots(), reach, dead);
      if (i !== undefined) live.current.onPick(i);
    };
    const prev = pen.move;
    pen.move = step;
    const move = (e: MouseEvent) => { if (cursor && !document.pointerLockElement) step(e.movementX, e.movementY); };
    window.addEventListener("mousemove", move, true);
    return () => {
      if (pen.move === step) pen.move = prev;
      window.removeEventListener("mousemove", move, true);
    };
  }, [active, cursor, reach, dead]);
  return useCallback(() => { flick.current = newFlick(); }, []);
}
