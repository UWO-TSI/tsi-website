import { NextResponse } from "next/server";
import type { ServiceResult } from "./service";

export async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false, response: NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 }) };
  }
}

export function respond<T>(result: ServiceResult<T>, key: string): NextResponse {
  if (!result.ok) return NextResponse.json({ ok: false, error: result.error, code: result.code }, { status: result.status });
  return NextResponse.json({ ok: true, [key]: result.data });
}

export const badRequest = (error = "Invalid request") => NextResponse.json({ ok: false, error }, { status: 400 });
export const forbidden = () => NextResponse.json({ ok: false, error: "Forbidden: T1/T2 only" }, { status: 403 });
