/** Controls keep their native keyboard behavior while the world listens globally. */
export function isGameControlTarget(element: Element | null): boolean {
  return !!element && (!!element.closest('input, textarea, select, button, summary, a[href], [role="dialog"]') || (element as HTMLElement).isContentEditable);
}

type InputDocument = EventTarget & Pick<Document, "activeElement" | "hidden">;

export function bindGameKeys({ keys, accepted, onPress, onReset, windowTarget = window, documentTarget = document }: {
  keys: Record<string, boolean>;
  accepted: readonly string[];
  onPress?: (event: KeyboardEvent) => void;
  onReset?: () => void;
  windowTarget?: EventTarget;
  documentTarget?: InputDocument;
}) {
  const allowed = new Set(accepted);
  const reset = () => {
    Object.keys(keys).forEach((key) => { keys[key] = false; });
    onReset?.();
  };
  const down = (event: Event) => {
    const e = event as KeyboardEvent;
    if (documentTarget.hidden || isGameControlTarget(documentTarget.activeElement) || e.metaKey || e.ctrlKey || e.altKey) {
      reset();
      return;
    }
    if (e.defaultPrevented || !allowed.has(e.key.toLowerCase())) return;
    keys[e.key.toLowerCase()] = true;
    onPress?.(e);
  };
  const up = (event: Event) => { keys[(event as KeyboardEvent).key.toLowerCase()] = false; };
  const focus = () => { if (isGameControlTarget(documentTarget.activeElement)) reset(); };
  const visibility = () => { if (documentTarget.hidden) reset(); };
  windowTarget.addEventListener("keydown", down);
  windowTarget.addEventListener("keyup", up);
  windowTarget.addEventListener("blur", reset);
  documentTarget.addEventListener("focusin", focus);
  documentTarget.addEventListener("visibilitychange", visibility);
  return () => {
    windowTarget.removeEventListener("keydown", down);
    windowTarget.removeEventListener("keyup", up);
    windowTarget.removeEventListener("blur", reset);
    documentTarget.removeEventListener("focusin", focus);
    documentTarget.removeEventListener("visibilitychange", visibility);
    reset();
  };
}
