/**
 * Oracle client for the island: thin wrappers over the systems routes
 * (/api/oracle/{me,start,answer,finish}). Errors come back as OracleError
 * with the route's own wording (cooldown, sign-in, incomplete…).
 */
import { installOracleDemo } from "./demo";
import type { AttemptView, FinishOutcome, OracleStatus } from "@/lib/oracle/service";

export class OracleError extends Error {}

async function call<T>(path: string, key: string, body?: unknown): Promise<T> {
  installOracleDemo();
  let res: Response;
  try {
    res = await fetch(path, body === undefined ? undefined : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch { throw new OracleError("The Oracle couldn't be reached. Try again in a moment."); }
  const json = await res.json().catch(() => null);
  if (res.status === 401) throw new OracleError("Sign in to consult the Oracle.");
  if (!res.ok || !json?.ok) {
    const until = typeof json?.until === "string" ? ` Come back ${new Date(json.until).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.` : "";
    throw new OracleError(`${json?.error ?? "The Oracle is quiet right now."}${until}`);
  }
  return json[key] as T;
}

export const oracleStatus = () => call<OracleStatus>("/api/oracle/me", "oracle");
export const startReading = () => call<AttemptView>("/api/oracle/start", "reading", { start_key: `island:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}` });
export const answerBatch = (attemptId: string, answers: { item_id: string; value: number }[]) =>
  call<{ answered: number; total: number; keeper_beat: number | null }>("/api/oracle/answer", "progress", { attempt_id: attemptId, answers });
export const finishReading = (attemptId: string, ties?: Record<string, string>) =>
  call<FinishOutcome>("/api/oracle/finish", "result", ties ? { attempt_id: attemptId, tie_answers: ties } : { attempt_id: attemptId });
