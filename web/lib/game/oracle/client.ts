/**
 * Oracle client for the island: thin wrappers over the systems routes
 * (/api/oracle/{me,start,answer,finish}). Errors come back as OracleError
 * with the route's own wording (cooldown, sign-in, incomplete…).
 */
import { installOracleDemo } from "./demo";
import { ApiError, apiCall, newKey } from "@/lib/apiClient";
import type { AttemptView, FinishOutcome, OracleStatus } from "@/lib/oracle/service";

export class OracleError extends Error {}

async function call<T>(path: string, key: string, body?: unknown): Promise<T> {
  installOracleDemo();
  try {
    return await apiCall<T>(path, key, body);
  } catch (err) {
    if (!(err instanceof ApiError)) throw new OracleError("The Oracle couldn't be reached. Try again in a moment.");
    if (err.status === 401) throw new OracleError("Sign in to consult the Oracle.");
    const until = typeof err.body?.until === "string" ? ` Come back ${new Date(err.body.until).toLocaleDateString(undefined, { month: "short", day: "numeric" })}.` : "";
    throw new OracleError(`${typeof err.body?.error === "string" ? err.body.error : "The Oracle is quiet right now."}${until}`);
  }
}

export const oracleStatus = () => call<OracleStatus>("/api/oracle/me", "oracle");
export const startReading = () => call<AttemptView>("/api/oracle/start", "reading", { start_key: newKey() });
export const answerBatch = (attemptId: string, answers: { item_id: string; value: number }[]) =>
  call<{ answered: number; total: number; keeper_beat: number | null }>("/api/oracle/answer", "progress", { attempt_id: attemptId, answers });
export const finishReading = (attemptId: string, ties?: Record<string, string>) =>
  call<FinishOutcome>("/api/oracle/finish", "result", ties ? { attempt_id: attemptId, tie_answers: ties } : { attempt_id: attemptId });
