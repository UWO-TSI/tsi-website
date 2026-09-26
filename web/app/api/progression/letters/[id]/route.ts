import { NextResponse } from "next/server";
import { z } from "zod";
import { progressionContext } from "@/lib/progression/deps";
import { badRequest, readJson } from "@/lib/progression/http";
import { storeFailure } from "@/lib/progression/service";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read") }),
  z.object({ action: z.literal("report"), reason: z.string().trim().max(200).optional() }),
]);

// PATCH /api/progression/letters/:id: mark read, or report a note (recipient only).
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await progressionContext();
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return badRequest();
  const json = await readJson(request);
  if (!json.ok) return json.response;
  const parsed = Body.safeParse(json.body);
  if (!parsed.success) return badRequest();
  try {
    const at = ctx.now.toISOString();
    const ok =
      parsed.data.action === "read"
        ? await ctx.store.markLetterRead(ctx.userId, id, at)
        : await ctx.store.reportLetter(ctx.userId, id, parsed.data.reason ?? "", at);
    if (!ok) return NextResponse.json({ ok: false, error: "Letter not found." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const f = storeFailure(err);
    return NextResponse.json({ ok: false, error: f.error, code: f.code }, { status: f.status });
  }
}
