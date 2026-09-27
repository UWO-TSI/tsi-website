export class PresenceRequestError extends Error {
  constructor(public status: number) {
    super(`Presence request failed (${status})`);
  }
}

/** Bound requests even when a transport ignores abort, and remove listeners on completion. */
export async function presenceRequest<T>(
  request: (signal: AbortSignal) => Promise<T>,
  signal: AbortSignal,
  timeoutMs = 15_000,
): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) controller.abort();
  let interrupt: (() => void) | undefined;
  const interrupted = new Promise<never>((_, reject) => {
    interrupt = () => reject(new DOMException("Presence request interrupted", "AbortError"));
    controller.signal.addEventListener("abort", interrupt, { once: true });
    if (controller.signal.aborted) interrupt();
  });
  const deadline = setTimeout(abort, timeoutMs);
  try {
    if (controller.signal.aborted) return await interrupted;
    return await Promise.race([request(controller.signal), interrupted]);
  } finally {
    clearTimeout(deadline);
    signal.removeEventListener("abort", abort);
    if (interrupt) controller.signal.removeEventListener("abort", interrupt);
  }
}
