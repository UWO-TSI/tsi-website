/** Oracle transport: /api/oracle/* by default; in-memory for the dev demo. */
import { memoryIdentityStore } from "@/lib/identity/memoryStore";
import * as S from "./service";

export class OracleRequestError extends Error {
  constructor(message: string, public status: number, public code?: string, public extra?: Record<string, unknown>) {
    super(message);
  }
}
export interface OracleTransport {
  me(): Promise<S.OracleStatus>;
  start(startKey: string): Promise<S.AttemptView>;
  answer(attemptId: string, answers: { item_id: string; value: number }[]): Promise<{ answered: number; total: number; keeper_beat: number | null }>;
  finish(attemptId: string, ties?: Record<string, string>): Promise<S.FinishOutcome>;
}

async function call<T>(path: string, key: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/oracle/${path}`, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (!res.ok || !json?.ok) throw new OracleRequestError(typeof json?.error === "string" ? json.error : "Request failed", res.status, typeof json?.code === "string" ? json.code : undefined, json ?? undefined);
  return json[key] as T;
}

export const httpOracleTransport: OracleTransport = {
  me: () => call("me", "oracle"),
  start: (start_key) => call("start", "reading", { start_key }),
  answer: (attempt_id, answers) => call("answer", "progress", { attempt_id, answers }),
  finish: (attempt_id, tie_answers) => call("finish", "result", { attempt_id, tie_answers }),
};

export function memoryOracleTransport(me: string, m = memoryIdentityStore()): OracleTransport {
  const u = async <T>(p: Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; code: string }>) => {
    const r = await p;
    if (!r.ok) throw new OracleRequestError(r.error, r.status, r.code);
    return r.data;
  };
  return {
    me: () => u(S.oracleStatus(m.store, me, new Date())),
    start: (k) => u(S.startReading(m.store, me, k, new Date())),
    answer: (id, a) => u(S.answerBatch(m.store, me, id, a)),
    finish: (id, t) => u(S.finishReading(m.store, me, id, t)),
  };
}
