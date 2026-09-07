import { isGameControlTarget } from "./keyboardInput";

type InputDocument = EventTarget & Pick<Document, "activeElement" | "hidden">;

/** Track each input independently so releasing Space cannot release a held pointer. */
export function bindFishingInput({ onHold, onCancel, onPause, onPointerFocus, windowTarget = window, documentTarget = document }: {
  onHold: (holding: boolean) => void;
  onCancel: () => void;
  onPause: (paused: boolean) => void;
  onPointerFocus?: () => void;
  windowTarget?: EventTarget;
  documentTarget?: InputDocument;
}) {
  const capture = { capture: true };
  const keys = new Set<string>();
  const pointers = new Set<number>();
  let blurred = false;
  const publish = () => onHold(keys.size > 0 || pointers.size > 0);
  const reset = () => { keys.clear(); pointers.clear(); publish(); };
  const controlFocused = () => isGameControlTarget(documentTarget.activeElement);
  const updatePause = () => {
    const paused = blurred || documentTarget.hidden || controlFocused();
    if (paused) reset();
    onPause(paused);
  };
  const blocked = () => blurred || documentTarget.hidden || controlFocused();
  const keyDown = (event: Event) => {
    const e = event as KeyboardEvent;
    if (e.metaKey || e.ctrlKey || e.altKey) { reset(); return; }
    if (blocked() || e.defaultPrevented) return;
    const key = e.key.toLowerCase();
    if (key !== "e" && key !== " " && key !== "escape") return;
    e.preventDefault();
    e.stopPropagation();
    if (key === "escape") { reset(); onCancel(); }
    else { keys.add(key); publish(); }
  };
  const keyUp = (event: Event) => { keys.delete((event as KeyboardEvent).key.toLowerCase()); publish(); };
  const pointerDown = (event: Event) => {
    const e = event as PointerEvent;
    const target = e.target as Element | null;
    if (e.button !== 0 || e.defaultPrevented || documentTarget.hidden || blurred) return;
    if (target && typeof target.closest === "function" && isGameControlTarget(target)) return;
    e.preventDefault();
    e.stopPropagation();
    onPointerFocus?.();
    pointers.add(e.pointerId);
    publish();
  };
  const pointerUp = (event: Event) => { pointers.delete((event as PointerEvent).pointerId); publish(); };
  const blur = () => { blurred = true; updatePause(); };
  const focus = () => { blurred = false; updatePause(); };
  windowTarget.addEventListener("keydown", keyDown, capture);
  windowTarget.addEventListener("keyup", keyUp, capture);
  windowTarget.addEventListener("pointerdown", pointerDown, capture);
  windowTarget.addEventListener("pointerup", pointerUp, capture);
  windowTarget.addEventListener("pointercancel", pointerUp, capture);
  windowTarget.addEventListener("blur", blur);
  windowTarget.addEventListener("focus", focus);
  documentTarget.addEventListener("visibilitychange", updatePause);
  documentTarget.addEventListener("focusin", updatePause);
  updatePause();
  return () => {
    windowTarget.removeEventListener("keydown", keyDown, capture);
    windowTarget.removeEventListener("keyup", keyUp, capture);
    windowTarget.removeEventListener("pointerdown", pointerDown, capture);
    windowTarget.removeEventListener("pointerup", pointerUp, capture);
    windowTarget.removeEventListener("pointercancel", pointerUp, capture);
    windowTarget.removeEventListener("blur", blur);
    windowTarget.removeEventListener("focus", focus);
    documentTarget.removeEventListener("visibilitychange", updatePause);
    documentTarget.removeEventListener("focusin", updatePause);
    reset();
  };
}
