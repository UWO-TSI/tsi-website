"use client";

/**
 * The orbit camera's input (specs/camera-orbit.md): mouse-look under pointer lock (a canvas click captures, holding
 * right click gives the cursor back, Esc is the browser's release), the arrow keys, the wheel, V back to today's view,
 * and two fingers on a touch screen (drag to turn, a double two-finger tap to snap back). Mounted by the follow
 * camera, so only the village, the home island and the ruins capture; interiors and the applicant island never do.
 */
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { bindGameKeys } from "@/lib/game/keyboardInput";
import { capture, cursorHolds, loadOrbit, lookOrbit, nextCapture, orbit, saveOrbit, setCaptureState, snapBack, subscribeOrbitPrefs, zoomOrbit, type CaptureEvent } from "@/lib/game/orbitCamera";

/** The camera keys held now (the arrows), read by the rig each frame. */
export const orbitKeys: Record<string, boolean> = {};
const ARROWS = ["arrowleft", "arrowright", "arrowup", "arrowdown"];
/** Back to today's view (a fixed key, settings FIXED_KEYS). */
export const RESET_VIEW_KEY = "v";
/** A single mouse event's movement above this is a pointer-lock glitch (Chrome reports jumps of hundreds), not a flick. */
const MAX_STEP = 200;

const TEXT_ENTRY = "input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=button]):not([type=submit]), textarea, select, [contenteditable=\"true\"]";
/** Something wants the cursor: a sheet or dialog, a text field in focus, or a hold the game set (decorating, a greeting). */
function wantsCursor() {
  if (cursorHolds.size || document.querySelector("[role=\"dialog\"], [role=\"alertdialog\"]")) return true;
  const a = document.activeElement;
  return !!a && a !== document.body && a.matches(TEXT_ENTRY);
}

/** Module scope (the react compiler forbids writing through a hook's value): two fingers are the game's, not the page's zoom. */
function setTouchAction(el: HTMLElement, value: string) { const old = el.style.touchAction; el.style.touchAction = value; return old; }

export function useOrbitInput() {
  const gl = useThree(s => s.gl), setEvents = useThree(s => s.setEvents);
  useEffect(() => {
    loadOrbit();
    // Dev (evidence scripts): read the angles and the capture state, or set the angles directly.
    if (process.env.NODE_ENV !== "production") Object.assign(window, { __orbit: { orbit, capture } });
    const el = gl.domElement, doc = el.ownerDocument;
    const fine = window.matchMedia("(pointer: fine)").matches;
    let rightUpAt = -Infinity;
    const send = (e: CaptureEvent) => {
      const step = nextCapture(capture.state, e);
      setCaptureState(step.state);
      // In mouse-look a left click does nothing outside combat: no resident or object picks from a hidden pointer.
      setEvents({ enabled: step.state !== "captured" });
      if (step.exit && doc.pointerLockElement === el) doc.exitPointerLock();
      if (step.request) request();
    };
    const request = () => {
      const failed = () => send("failed");
      try {
        el.requestPointerLock({ unadjustedMovement: true })?.catch((err: DOMException) => {
          // Raw mouse input isn't offered everywhere (macOS): the ordinary lock then.
          if (err?.name === "NotSupportedError") el.requestPointerLock()?.catch(failed);
          else failed();
        });
      } catch { failed(); }
    };
    const enable = () => send(orbit.prefs.mouseLook && fine ? "enable" : "disable");
    enable();
    const offPrefs = subscribeOrbitPrefs(enable);

    const lockChange = () => send(doc.pointerLockElement === el ? "locked" : "unlocked");
    const lockError = () => send("failed");
    const look = (e: MouseEvent) => {
      if (doc.pointerLockElement !== el || capture.state !== "captured") return;
      const dx = e.movementX, dy = e.movementY;
      if (Math.abs(dx) > MAX_STEP || Math.abs(dy) > MAX_STEP) return;
      lookOrbit(dx, dy);
    };
    // A canvas click captures, a beat later: a click that opened a dialog (a resident's chat) keeps the cursor.
    let pending = 0;
    const click = (e: MouseEvent) => {
      if (e.button !== 0 || capture.state !== "free") return;
      window.clearTimeout(pending);
      pending = window.setTimeout(() => { if (capture.state === "free" && !wantsCursor()) send("click"); });
    };
    const down = (e: MouseEvent) => { if (e.button === 2 && capture.state === "captured") send("rightDown"); };
    const up = (e: MouseEvent) => { if (e.button === 2 && capture.state === "cursor") { rightUpAt = performance.now(); send("rightUp"); } };
    // The canvas never shows the browser's menu; nor does the end of a right-click hold that began there (Windows opens it on release, wherever the cursor is).
    const menu = (e: Event) => e.preventDefault();
    const holdMenu = (e: Event) => { if (capture.state === "cursor" || performance.now() - rightUpAt < 300) e.preventDefault(); };
    let saveAt = 0;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      zoomOrbit(e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1));
      window.clearTimeout(saveAt);
      saveAt = window.setTimeout(() => saveOrbit(), 300);
    };
    // Sheets, dialogs and text fields take the cursor; closing them leaves it (the next click captures).
    const poll = window.setInterval(() => {
      if (capture.state === "off") return;
      const open = wantsCursor();
      if (open && capture.state !== "menu") send("menuOpen");
      else if (!open && capture.state === "menu") send("menuClose");
    }, 120);

    // Two fingers on a touch screen: drag to turn, two quick two-finger taps to snap back. One finger stays tap-to-walk.
    const touches = new Map<number, { x: number; y: number }>();
    let pair: { x: number; y: number; moved: number; at: number } | null = null, lastPairTap = -Infinity, swallowUntil = -Infinity;
    const middle = () => { let x = 0, y = 0; for (const p of touches.values()) { x += p.x; y += p.y; } return { x: x / touches.size, y: y / touches.size }; };
    const touchDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) pair = { ...middle(), moved: 0, at: performance.now() };
    };
    const touchMove = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!pair || touches.size !== 2) return;
      const m = middle(), dx = m.x - pair.x, dy = m.y - pair.y;
      lookOrbit(dx * 1.6, dy * 1.6);
      pair.moved += Math.hypot(dx, dy); pair.x = m.x; pair.y = m.y;
    };
    const touchUp = (e: PointerEvent) => {
      if (e.pointerType !== "touch" || !touches.delete(e.pointerId) || !pair) return;
      const now = performance.now();
      swallowUntil = now + 400;
      if (pair.moved < 12 && now - pair.at < 300) {
        if (now - lastPairTap < 450) { snapBack(); lastPairTap = -Infinity; } else lastPairTap = now;
      }
      pair = null;
      saveOrbit();
    };
    // A two-finger gesture is never a tap-to-walk (PlayerAvatar skips a click marked handled).
    const swallow = (e: MouseEvent) => { if (performance.now() < swallowUntil) e.preventDefault(); };

    const unbind = bindGameKeys({ keys: orbitKeys, accepted: [...ARROWS, RESET_VIEW_KEY],
      onPress: e => {
        const k = e.key.toLowerCase();
        if (ARROWS.includes(k)) e.preventDefault();
        if (k === RESET_VIEW_KEY && !e.repeat) { snapBack(); saveOrbit(); }
      } });
    const keyUp = (e: KeyboardEvent) => { if (ARROWS.includes(e.key.toLowerCase())) saveOrbit(); };

    const touchAction = setTouchAction(el, "none");
    doc.addEventListener("pointerlockchange", lockChange);
    doc.addEventListener("pointerlockerror", lockError);
    doc.addEventListener("mousemove", look);
    el.addEventListener("click", swallow, true);
    el.addEventListener("click", click);
    el.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    el.addEventListener("contextmenu", menu);
    window.addEventListener("contextmenu", holdMenu, true);
    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("pointerdown", touchDown);
    el.addEventListener("pointermove", touchMove);
    window.addEventListener("pointerup", touchUp);
    window.addEventListener("pointercancel", touchUp);
    window.addEventListener("keyup", keyUp);
    return () => {
      offPrefs(); unbind();
      window.clearInterval(poll); window.clearTimeout(pending); window.clearTimeout(saveAt);
      setTouchAction(el, touchAction);
      doc.removeEventListener("pointerlockchange", lockChange);
      doc.removeEventListener("pointerlockerror", lockError);
      doc.removeEventListener("mousemove", look);
      el.removeEventListener("click", swallow, true);
      el.removeEventListener("click", click);
      el.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
      el.removeEventListener("contextmenu", menu);
      window.removeEventListener("contextmenu", holdMenu, true);
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("pointerdown", touchDown);
      el.removeEventListener("pointermove", touchMove);
      window.removeEventListener("pointerup", touchUp);
      window.removeEventListener("pointercancel", touchUp);
      window.removeEventListener("keyup", keyUp);
      // Leaving the scene (a door, the boat): the lock and the hint go with it.
      if (doc.pointerLockElement === el) doc.exitPointerLock();
      setCaptureState("off");
      setEvents({ enabled: true });
      saveOrbit();
    };
  }, [gl, setEvents]);
}
