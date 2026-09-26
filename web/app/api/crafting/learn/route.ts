import { NextResponse } from "next/server";
import { z } from "zod";
import { badRequest, jsonResult, withStore } from "@/lib/server/memberContext";
import { openBottle } from "@/lib/crafting/service";
import { supabaseCraftingStore } from "@/lib/crafting/supabaseStore";

// Clients can only open today's beach bottle (the server picks the recipe).
// Shop cards teach on purchase (database trigger); resident quests call
// learnFromQuest server-side. Neither is a client-named recipe.
const Body = z.object({ source: z.literal("bottle") });

// POST /api/crafting/learn: open today's message bottle; a retry the same day returns the same recipe.
export async function POST(request: Request) {
  const ctx = await withStore(supabaseCraftingStore);
  if (ctx instanceof NextResponse) return ctx;
  if (!Body.safeParse(await request.json().catch(() => null)).success) return badRequest();
  return jsonResult(await openBottle(ctx.store, ctx.userId), "learned");
}
