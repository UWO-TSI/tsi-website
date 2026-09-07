export type CounterFrame = { value: number; flashing: boolean };

/** A cancellable display animation. It never changes the underlying balance or XP. */
export function animateCounter(from: number, target: number, gained: boolean, reducedMotion: boolean, update: (frame: CounterFrame) => void) {
  const started = performance.now();
  let frame = 0;
  let stopped = false;
  const step = (now: number) => {
    if (stopped) return;
    const elapsed = Math.max(0, now - started);
    const progress = reducedMotion || from === target ? 1 : Math.min(1, elapsed / 700);
    const flashing = !reducedMotion && gained && from !== target && elapsed < 900;
    update({ value: Math.round(from + (target - from) * (1 - Math.pow(1 - progress, 3))), flashing });
    if (!stopped && (progress < 1 || flashing)) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => { stopped = true; cancelAnimationFrame(frame); };
}
