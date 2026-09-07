export interface RecentVisitor {
  user_id: string;
  world_x: number;
  world_z: number;
  display_name?: string;
}

/** Ignore malformed coordinates rather than rendering invalid SVG member dots. */
export function recentVisitors(value: unknown): RecentVisitor[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((row): row is RecentVisitor => {
    if (!row || typeof row !== "object" || typeof row.user_id !== "string" || !row.user_id || seen.has(row.user_id)) return false;
    if (typeof row.world_x !== "number" || !Number.isFinite(row.world_x) || typeof row.world_z !== "number" || !Number.isFinite(row.world_z)) return false;
    seen.add(row.user_id);
    return true;
  }).slice(0, 20).map((row) => ({
    user_id: row.user_id, world_x: row.world_x, world_z: row.world_z,
    ...(typeof row.display_name === "string" ? { display_name: row.display_name } : {}),
  }));
}

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

/** Poll serially and suppress callbacks after leaving lite mode. */
export function pollPresence<T>(
  request: (signal: AbortSignal) => Promise<T>,
  intervalMs: number,
  onValue: (value: T) => void,
  onError: (error: unknown) => void,
  timeoutMs = 15_000,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();
  const run = async () => {
    try {
      const value = await presenceRequest(request, controller.signal, timeoutMs);
      if (!stopped) onValue(value);
    } catch (error) {
      if (!stopped) onError(error);
    } finally {
      if (!stopped) timer = setTimeout(run, intervalMs);
    }
  };
  void run();
  return () => {
    stopped = true;
    clearTimeout(timer);
    controller.abort();
  };
}
