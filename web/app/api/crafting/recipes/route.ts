import { NextResponse } from "next/server";
import { jsonResult, memberContext } from "@/lib/server/memberContext";
import { recipeBook } from "@/lib/crafting/service";
import { supabaseCraftingStore } from "@/lib/crafting/supabaseStore";

// GET /api/crafting/recipes: learned recipes with owned/needed ingredient counts, and whether today's bottle is on the beach.
export async function GET() {
  const ctx = await memberContext();
  if (ctx instanceof NextResponse) return ctx;
  return jsonResult(await recipeBook(supabaseCraftingStore(ctx.db), ctx.userId, ctx.now), "book");
}
