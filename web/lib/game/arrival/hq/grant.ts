/**
 * Server side of a resident handing you a tool (row 312, teachers.ts): the tool goes into the member's inventory, which
 * is what the catch routes check (lib/game/tools.ts checkHeld, lib/collections/service.ts). Once per member, whatever
 * is asked again. A member whose tools aren't taught (they arrived before row 312) already has the starter: nothing is
 * written. Route: POST /api/world/tools.
 */
import { z } from "zod";
import { isTaughtTool, teacherOf, type TaughtTool } from "./teachers";

export interface ToolGrantStore {
  /** This member's tools are taught (lib/game/arrival/arrivalService.ts ARRIVAL_TAUGHT_KEY). */
  taught(memberId: string): Promise<boolean>;
  /** Put one of a shop item (by slug) in the member's inventory unless it's there already. */
  grant(memberId: string, slug: string): Promise<void>;
}

const Body = z.strictObject({ tool: z.string().max(20) });
export type GiveResult = { ok: true; data: { tool: TaughtTool; key: string; granted: boolean } } | { ok: false; status: number; error: string; code: string };

export async function giveTool(store: ToolGrantStore, memberId: string, body: unknown): Promise<GiveResult> {
  const parsed = Body.safeParse(body);
  if (!parsed.success || !isTaughtTool(parsed.data.tool)) return { ok: false, status: 400, error: "Invalid request", code: "invalid" };
  const t = teacherOf(parsed.data.tool)!;
  if (!(await store.taught(memberId))) return { ok: true, data: { tool: t.tool, key: t.key, granted: false } };
  await store.grant(memberId, t.key);
  return { ok: true, data: { tool: t.tool, key: t.key, granted: true } };
}
