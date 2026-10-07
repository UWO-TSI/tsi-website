// The chat log's writer (specs/multiplayer.md §6 "Log"): sent lines queue here and go
// to the database every 2 s in one batch (realtime_log_chat). The queue is bounded and
// a write is never awaited by a room, so the island keeps talking while the database is
// slow or down: failed batches stay queued and retry with backoff, and past the bound
// the oldest lines are dropped (counted, logged once per spell).

/** One line as realtime_log_chat takes it. Member ids and world names, never real names or emails. */
export type ChatLogRow = {
  id: string;
  shard: number;
  room_id: string;
  area: string;
  member_id: string;
  world_name: string;
  body: string;
  created_at: string;
};

/** Writes one batch; rejects on any failure. The signal aborts it at the timeout. */
export type WriteChat = (rows: ChatLogRow[], signal: AbortSignal) => Promise<void>;

export type ChatLogOptions = {
  write: WriteChat;
  log: (event: string, fields: Record<string, unknown>) => void;
  /** Flush period (ms). */
  flushMs?: number;
  /** Most lines held; beyond, the oldest go. */
  max?: number;
  /** Most lines per write (realtime_log_chat takes 500). */
  batch?: number;
  /** A write that takes longer is aborted and retried. */
  timeoutMs?: number;
  /** Longest wait between retries after failures (doubling from flushMs). */
  maxBackoffMs?: number;
  now?: () => number;
};

export type ChatLog = {
  push(row: ChatLogRow): void;
  /** Write what's queued now (one batch at a time), unless a write is in flight or backing off. */
  flush(): Promise<void>;
  /** Start the flush timer (unref'd: it never keeps the process alive). */
  start(): void;
  /** Stop the timer and try a last flush within the timeout. */
  stop(): Promise<void>;
  readonly size: number;
  readonly dropped: number;
};

export function createChatLog(o: ChatLogOptions): ChatLog {
  const flushMs = o.flushMs ?? 2000;
  const max = o.max ?? 5000;
  const batch = Math.min(o.batch ?? 200, 500);
  const timeoutMs = o.timeoutMs ?? 5000;
  const maxBackoffMs = o.maxBackoffMs ?? 30_000;
  const now = o.now ?? Date.now;
  let queue: ChatLogRow[] = [];
  let inflight: Set<ChatLogRow> | null = null;
  let failures = 0;
  let retryAt = 0;
  let dropped = 0;
  let droppedSpell = 0;
  let timer: NodeJS.Timeout | null = null;

  async function writeBatch(rows: ChatLogRow[]): Promise<void> {
    const ac = new AbortController();
    let t: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        o.write(rows, ac.signal),
        new Promise<never>((_, reject) => {
          t = setTimeout(() => {
            ac.abort();
            reject(new Error("timeout"));
          }, timeoutMs);
        }),
      ]);
    } finally {
      clearTimeout(t);
    }
  }

  async function flush(): Promise<void> {
    if (inflight || queue.length === 0 || now() < retryAt) return;
    const rows = queue.slice(0, batch);
    inflight = new Set(rows);
    try {
      await writeBatch(rows);
      const sent = inflight;
      queue = queue.filter((r) => !sent.has(r));
      if (failures > 0) o.log("chat_log_recovered", { after: failures, queued: queue.length });
      failures = 0;
      retryAt = 0;
    } catch (e) {
      failures++;
      retryAt = now() + Math.min(maxBackoffMs, flushMs * 2 ** Math.min(failures, 10));
      // Once when a spell starts, then every 10th failure: never the lines themselves.
      if (failures === 1 || failures % 10 === 0) {
        o.log("chat_log_failed", { failures, queued: queue.length, message: e instanceof Error ? e.message : String(e) });
      }
    } finally {
      inflight = null;
    }
  }

  return {
    push(row) {
      queue.push(row);
      if (queue.length > max) {
        const over = queue.length - max;
        queue.splice(0, over);
        dropped += over;
        if (droppedSpell === 0) o.log("chat_log_dropping", { max, queued: queue.length });
        droppedSpell += over;
      } else if (droppedSpell > 0 && failures === 0) {
        o.log("chat_log_dropped", { lines: droppedSpell });
        droppedSpell = 0;
      }
    },
    flush,
    start() {
      if (timer) return;
      timer = setInterval(() => void flush(), flushMs);
      timer.unref();
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = null;
      retryAt = 0;
      await flush();
    },
    get size() {
      return queue.length;
    },
    get dropped() {
      return dropped;
    },
  };
}
