"use client";

import { useEffect, useRef, useState } from "react";
import { AudioManager } from "@/lib/game/audio";

/**
 * The one dialog system (specs/polish/menus.md §1, gui-sheet.md §3). Every sheet and overlay opens through it:
 * focus moves into the dialog and back to where it was when it closes; Escape, and the key that opened it, close the
 * top dialog only; Tab stays inside it; and while any dialog is open the world's hotkeys hold still
 * (`worldKeysBlocked`, which every world key handler checks). Opening and closing make a soft paper sound.
 */
type Focusable = { focus(options?: FocusOptions): void; getClientRects(): ArrayLike<unknown> };
type Panel = Focusable & { contains(node: unknown): boolean; querySelectorAll(selector: string): ArrayLike<Focusable> };
export type DialogEntry = { panel: { current: Panel | null }; close: () => void; keys: readonly string[] };
const stack: DialogEntry[] = [];

/** True while any dialog is open: the world's hotkeys (E, J, M, the map, abilities, the wheel) do nothing. */
export const worldKeysBlocked = () => stack.length > 0;
/** Whether `node` is inside the top dialog (tab keys and the like act only there). */
export const inTopDialog = (node: unknown) => !!node && !!stack[stack.length - 1]?.panel.current?.contains(node);

export type KeyLike = { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean };
/**
 * What a key press does to the top dialog: Escape closes it from anywhere; its own keys close it unless you are
 * typing in a field (or holding a modifier); Tab is kept inside it. Anything else is left to the dialog's controls.
 */
export function routeDialogKey(top: { keys: readonly string[] } | null, e: KeyLike, typing: boolean): "close" | "tab" | null {
  if (!top) return null;
  if (e.key === "Escape") return "close";
  if (e.key === "Tab") return "tab";
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return null;
  return top.keys.includes(e.key.toLowerCase()) ? "close" : null;
}

type ElementLike = { tagName?: string; type?: string; closest?(selector: string): unknown } | null;
/** A text field, where letters are typing, not shortcuts. */
export const isTyping = (el: ElementLike) => !!el && (!!el.closest?.("textarea, select, [contenteditable='true']") ||
  (el.tagName === "INPUT" && !["checkbox", "radio", "range", "button", "submit", "reset", "color", "file"].includes(el.type ?? "text")));

const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]';
const controls = (panel: Panel | null) => Array.from(panel?.querySelectorAll(FOCUSABLE) ?? []).filter(n => n.getClientRects().length > 0);

type KeyEvent = KeyLike & { shiftKey?: boolean; repeat?: boolean; preventDefault(): void; stopImmediatePropagation(): void };
/** The capture-phase key handler while dialogs are open (`active`: the focused element). */
export function dialogKeydown(e: KeyEvent, active: unknown) {
  const top = stack[stack.length - 1];
  const action = routeDialogKey(top ?? null, e, isTyping(active as ElementLike));
  if (!top || !action) return;
  if (action === "close") {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (!e.repeat) top.close();
    return;
  }
  const panel = top.panel.current, items = controls(panel);
  const first = items[0], last = items[items.length - 1];
  if (!first) { e.preventDefault(); panel?.focus({ preventScroll: true }); return; }
  if (!panel?.contains(active) || (e.shiftKey ? active === first || active === panel : active === last)) {
    e.preventDefault();
    (e.shiftKey ? last : first).focus();
  }
}
const onKey = (e: KeyboardEvent) => dialogKeydown(e, document.activeElement);

/** Put a dialog on top; the returned function takes it off (wherever it is in the stack). */
export function openDialog(entry: DialogEntry): () => void {
  if (!stack.length && typeof window !== "undefined") window.addEventListener("keydown", onKey, true);
  stack.push(entry);
  return () => {
    const i = stack.indexOf(entry);
    if (i >= 0) stack.splice(i, 1);
    if (!stack.length && typeof window !== "undefined") window.removeEventListener("keydown", onKey, true);
  };
}

const sound = (opening: boolean) => {
  if (opening) { AudioManager.playSFX("click", { rate: 1.15, gain: 0.35 }); window.setTimeout(() => AudioManager.playSFX("blip1", { gain: 0.3 }), 90); }
  else AudioManager.playSFX("blip1", { rate: 0.82, gain: 0.25 });
};

/**
 * Open a dialog while `open`: returns the ref for its panel (give it tabIndex={-1}). `keys`: the key(s) that opened
 * it, which close it too. `quiet`: no paper sound (the dialog makes its own).
 */
export function useWorldDialog<T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void, keys?: string | readonly string[], quiet = false) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const keyList = (typeof keys === "string" ? [keys] : keys ?? []).map(k => k.toLowerCase()).join(" ");
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = ref.current;
    const close = openDialog({ panel: ref, close: () => closeRef.current(), keys: keyList ? keyList.split(" ") : [] });
    if (!quiet) sound(true);
    // Into the dialog itself (its label is read out; Tab reaches the first control), never straight onto an action.
    const t = window.setTimeout(() => { if (ref.current && !ref.current.contains(document.activeElement)) ref.current.focus({ preventScroll: true }); }, 0);
    return () => {
      window.clearTimeout(t);
      close();
      if (!quiet) sound(false);
      // Back to the opener, unless you have already moved on (clicked the world, say).
      const here = document.activeElement;
      if (previous?.isConnected && (!here || here === document.body || !!panel?.contains(here))) previous.focus({ preventScroll: true });
    };
  }, [open, keyList, quiet]);
  return ref;
}

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
/**
 * Keeps a closing dialog on screen for its exit animation: "open", then "closing" for `exitMs` after `open` goes
 * false, then null (unmount). Reduced motion skips the wait.
 */
export function usePresence(open: boolean, exitMs = 160): "open" | "closing" | null {
  const [prev, setPrev] = useState(open);
  const [lingering, setLingering] = useState(false);
  if (prev !== open) { setPrev(open); setLingering(!open); }
  useEffect(() => {
    if (!lingering) return;
    const t = window.setTimeout(() => setLingering(false), reducedMotion() ? 0 : exitMs);
    return () => window.clearTimeout(t);
  }, [lingering, exitMs]);
  return open ? "open" : lingering ? "closing" : null;
}
