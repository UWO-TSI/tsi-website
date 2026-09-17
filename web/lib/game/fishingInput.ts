import { isGameControlTarget } from "./keyboardInput";

export interface FishingHeldInput {
  keys: Set<string>;
  pointers: Set<number>;
}

type InputDocument = EventTarget & Pick<Document, "activeElement" | "hidden">;

/** Track each input independently so releasing Space cannot release a held pointer. */
export function bindFishingInput({ onHold, onCancel, onPause, onPointerFocus, initialInput, windowTarget = window, documentTarget = document }: {
  onHold: (holding: boolean) => void;
  onCancel: () => void;
  onPause: (paused: boolean) => void;
  onPointerFocus?: () => void;
  initialInput?: FishingHeldInput;
  windowTarget?: EventTarget;
  documentTarget?: InputDocument;
}) {
  const capture = { capture: true };
  const keys = new Set(initialInput?.keys);
  const pointers = new Set(initialInput?.pointers);
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
  publish();
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

/** The world starts charging synchronously; release events must not wait for React to mount a meter. */
export function bindFishingCastLifecycle({ getPhase, onStart, onRelease, onCancel, heldInput, windowTarget = window, documentTarget = document }: {
  getPhase: () => string;
  onStart: (spot: { x: number; z: number }) => void;
  onRelease: () => void;
  onCancel: () => void;
  heldInput?: FishingHeldInput;
  windowTarget?: EventTarget;
  documentTarget?: EventTarget & Pick<Document, "hidden">;
}) {
  const capture = { capture: true };
  const pending = () => ["charging", "casting", "waiting", "bite"].includes(getPhase());
  const start = (event: Event) => {
    if (getPhase() !== "idle") return;
    const spot = (event as CustomEvent<{ x: number; z: number }>).detail;
    if (!spot || !Number.isFinite(spot.x) || !Number.isFinite(spot.z)) return;
    heldInput?.keys.clear(); heldInput?.pointers.clear();
    onStart({ x: spot.x, z: spot.z });
  };
  const release = (event: Event) => {
    if (event.type === "keyup") heldInput?.keys.delete((event as KeyboardEvent).key.toLowerCase());
    else heldInput?.pointers.delete((event as PointerEvent).pointerId);
    if (getPhase() !== "charging") return;
    if (event.type === "keyup" && (event as KeyboardEvent).key.toLowerCase() !== "e") return;
    if (event.type === "pointerup" && (event as PointerEvent).button !== 0) return;
    onRelease();
  };
  const keyDown = (event: Event) => {
    const e = event as KeyboardEvent;
    if (e.key !== "Escape" || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!pending() && getPhase() !== "caught" && getPhase() !== "missed") return;
    e.preventDefault(); e.stopPropagation(); onCancel();
  };
  const interrupt = () => {
    heldInput?.keys.clear(); heldInput?.pointers.clear();
    if (pending()) onCancel();
  };
  const visibility = () => { if (documentTarget.hidden) interrupt(); };
  windowTarget.addEventListener("tsi:fish-start", start);
  windowTarget.addEventListener("keyup", release, capture);
  windowTarget.addEventListener("keydown", keyDown, capture);
  windowTarget.addEventListener("pointerup", release, capture);
  windowTarget.addEventListener("pointercancel", interrupt, capture);
  windowTarget.addEventListener("blur", interrupt);
  documentTarget.addEventListener("visibilitychange", visibility);
  return () => {
    windowTarget.removeEventListener("tsi:fish-start", start);
    windowTarget.removeEventListener("keyup", release, capture);
    windowTarget.removeEventListener("keydown", keyDown, capture);
    windowTarget.removeEventListener("pointerup", release, capture);
    windowTarget.removeEventListener("pointercancel", interrupt, capture);
    windowTarget.removeEventListener("blur", interrupt);
    documentTarget.removeEventListener("visibilitychange", visibility);
  };
}
