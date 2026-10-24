// Every Supabase read the server makes (a join's card, blocks and friends, and the sanctions poll) goes through
// here: a time budget that aborts the request, one `db_read` log line per attempt with its duration and outcome,
// and `retries` more attempts after 200 to 600 ms each.

export type Log = (event: string, fields: Record<string, unknown>) => void;

export type ReadOptions = { timeoutMs: number; log: Log; retries?: number; fields?: Record<string, unknown> };

export async function timedRead<T>(read: string, o: ReadOptions, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const ac = new AbortController();
    const started = performance.now();
    const done = (fields: Record<string, unknown>) =>
      o.log("db_read", { read, ...o.fields, attempt, ms: Math.round(performance.now() - started), ...fields });
    let timer: NodeJS.Timeout | undefined;
    try {
      const value = await Promise.race([
        run(ac.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            ac.abort();
            reject(new Error("timeout"));
          }, o.timeoutMs);
        }),
      ]);
      done({ ok: true });
      return value;
    } catch (e) {
      done({ ok: false, reason: e instanceof Error ? e.message : String(e) });
      if (attempt >= (o.retries ?? 0)) throw e;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((resolve) => setTimeout(resolve, 200 + Math.random() * 400));
  }
}
