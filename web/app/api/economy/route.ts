import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseEconomyStore } from "@/lib/wallet/supabaseStore";
import { EconomyError } from "@/lib/wallet/store";
import { z } from "zod";

/** Gems move only through wallet_apply (locked, recorded, one row per key). */
async function applyGems(userId: string, amount: number, type: string, description: string, key: string) {
  try {
    return { balance: (await supabaseEconomyStore(createAdminClient()).credit(userId, "gems", amount, type, description, key)).balance };
  } catch (err) {
    return { error: err instanceof EconomyError && err.code === "insufficient" ? "insufficient" : "failed" };
  }
}

// GET /api/economy — get own balance + recent transactions
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 100);

  const [profileResult, transactionsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("tethos_coins, xp, level")
      .eq("id", user.id)
      .single(),
    supabase
      .from("tc_transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const profile = profileResult.data;
  if (profileResult.error || transactionsResult.error || !profile || typeof profile.tethos_coins !== "number" || !Number.isFinite(profile.tethos_coins) || profile.tethos_coins < 0) {
    return NextResponse.json({ error: "Account balance unavailable" }, { status: 503 });
  }

  return NextResponse.json({
    balance: profile.tethos_coins,
    xp: profile?.xp ?? 0,
    level: profile?.level ?? 1,
    transactions: transactionsResult.data ?? [],
  });
}

// POST /api/economy — purchase item or admin award
const PurchaseSchema = z.object({
  action: z.literal("purchase"),
  item_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(10).optional().default(1),
});

const PurchaseAvatarSchema = z.object({
  action: z.literal("purchase_avatar"),
  item_id: z.string().uuid(),
});

const AwardSchema = z.object({
  action: z.literal("award"),
  user_id: z.string().uuid(),
  amount: z.number().int().min(1).max(100000),
  description: z.string().max(200).optional(),
});

const ActionSchema = z.discriminatedUnion("action", [PurchaseSchema, PurchaseAvatarSchema, AwardSchema]);

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  if (parsed.data.action === "purchase") {
    return handlePurchase(supabase, user.id, parsed.data);
  }

  if (parsed.data.action === "purchase_avatar") {
    return handleAvatarPurchase(supabase, user.id, parsed.data);
  }

  if (parsed.data.action === "award") {
    return handleAward(supabase, user.id, parsed.data);
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

async function handlePurchase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  data: z.infer<typeof PurchaseSchema>
) {
  // Get item details
  const { data: item } = await supabase
    .from("marketplace_items")
    .select("*")
    .eq("id", data.item_id)
    .eq("status", "available")
    .single();

  if (!item) {
    return NextResponse.json({ error: "Item not found or unavailable" }, { status: 404 });
  }

  if (item.stock < data.quantity) {
    return NextResponse.json({ error: "Insufficient stock" }, { status: 409 });
  }

  const totalCost = item.price_tc * data.quantity;
  const key = `marketplace:${data.item_id}:${crypto.randomUUID()}`;

  // Best-effort ordering: charge, create order, decrement stock
  // (Supabase doesn't support multi-table transactions via REST).
  const charged = await applyGems(userId, -totalCost, "spend_marketplace", `Purchased ${data.quantity}x ${item.name}`, key);
  if ("error" in charged) {
    return charged.error === "insufficient"
      ? NextResponse.json({ error: "Insufficient coins" }, { status: 409 })
      : NextResponse.json({ error: "Failed to deduct coins" }, { status: 500 });
  }

  // Orders and stock are server-only (migration 20260926130000).
  const admin = createAdminClient();
  const { error: orderError } = await admin
    .from("marketplace_orders")
    .insert({
      user_id: userId,
      item_id: data.item_id,
      quantity: data.quantity,
      total_tc: totalCost,
      status: "pending_pickup",
    });

  if (orderError) {
    await applyGems(userId, totalCost, "refund", `Refund: ${item.name}`, `refund:${key}`);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  // Decrement stock
  await admin
    .from("marketplace_items")
    .update({ stock: item.stock - data.quantity })
    .eq("id", data.item_id);

  return NextResponse.json({
    success: true,
    balance: charged.balance,
    item_name: item.name,
    total_cost: totalCost,
  });
}

async function handleAvatarPurchase(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  data: z.infer<typeof PurchaseAvatarSchema>
) {
  // Get avatar item details
  const { data: item } = await supabase
    .from("avatar_items")
    .select("*")
    .eq("id", data.item_id)
    .eq("is_available", true)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Avatar item not found or unavailable" }, { status: 404 });
  }

  // Check if user already owns this item
  const { data: existing } = await supabase
    .from("player_inventory")
    .select("id")
    .eq("user_id", userId)
    .eq("item_id", data.item_id)
    .single();

  if (existing) {
    return NextResponse.json({ error: "You already own this item" }, { status: 409 });
  }

  const cost = item.coin_price;
  const key = `avatar:${data.item_id}:${crypto.randomUUID()}`;

  const charged = await applyGems(userId, -cost, "spend_marketplace", `Purchased avatar item: ${item.name}`, key);
  if ("error" in charged) {
    return charged.error === "insufficient"
      ? NextResponse.json({ error: "Insufficient coins" }, { status: 409 })
      : NextResponse.json({ error: "Failed to deduct coins" }, { status: 500 });
  }

  // Add to inventory
  const { error: inventoryError } = await supabase
    .from("player_inventory")
    .insert({
      user_id: userId,
      item_id: data.item_id,
      equipped: false,
    });

  if (inventoryError) {
    await applyGems(userId, cost, "refund", `Refund: ${item.name}`, `refund:${key}`);
    return NextResponse.json({ error: "Failed to add to inventory" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    balance: charged.balance,
    item_name: item.name,
    item_id: data.item_id,
    total_cost: cost,
  });
}

async function handleAward(
  supabase: Awaited<ReturnType<typeof createClient>>,
  callerId: string,
  data: z.infer<typeof AwardSchema>
) {
  // Only T1-T2 can award coins
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", callerId)
    .single();

  if (!callerProfile || callerProfile.tier > 2) {
    return NextResponse.json({ error: "Forbidden — T1-T2 only" }, { status: 403 });
  }

  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", data.user_id)
    .single();

  if (!targetProfile) {
    return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  }

  // Another member's Gems: service role, after the tier check.
  const credited = await applyGems(data.user_id, data.amount, "earn_admin", data.description ?? `Admin award by ${callerId}`, `award:${crypto.randomUUID()}`);
  if ("error" in credited) {
    return NextResponse.json({ error: "Failed to award" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    user: data.user_id,
    awarded: data.amount,
    new_balance: credited.balance,
  });
}
