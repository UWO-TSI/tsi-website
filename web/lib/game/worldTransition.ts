export type TransitionState = "idle" | "fading-in" | "black" | "fading-out";
export type SceneChange = () => void | Promise<void>;
export const TRANSITION_MS = { fadeIn: 300, hold: 200, fadeOut: 500 } as const;

export function createWorldTransition(onState: (state: TransitionState) => void, onError: (error: unknown) => void) {
  let active = false;
  let disposed = false;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (callback: () => void, delay: number) => {
    const timer = setTimeout(() => { timers.delete(timer); if (!disposed) callback(); }, delay);
    timers.add(timer);
  };
  return {
    trigger(change: SceneChange, reducedMotion = false): boolean {
      if (disposed || active) return false;
      active = true;
      onState("fading-in");
      later(async () => {
        onState("black");
        let failure: { error: unknown } | null = null;
        try { await change(); } catch (error) { failure = { error }; }
        if (disposed) return;
        later(() => {
          onState("fading-out");
          later(() => {
            active = false;
            onState("idle");
            if (failure) onError(failure.error);
          }, reducedMotion ? 0 : TRANSITION_MS.fadeOut);
        }, reducedMotion ? 0 : TRANSITION_MS.hold);
      }, reducedMotion ? 0 : TRANSITION_MS.fadeIn);
      return true;
    },
    dispose() {
      disposed = true; active = false;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
    },
  };
}
