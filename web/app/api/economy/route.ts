import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

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

  const [{ data: profile }, { data: transactions }] = await Promise.all([
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

  return NextResponse.json({
    balance: profile?.tethos_coins ?? 0,
    xp: profile?.xp ?? 0,
    level: profile?.level ?? 1,
    transactions: transactions ?? [],
  });
}

// POST /api/economy — purchase item or admin award
const PurchaseSchema = z.object({
  action: z.literal("purchase"),
  item_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(10).optional().default(1),
});

const AwardSchema = z.object({
  action: z.literal("award"),
  user_id: z.string().uuid(),
  amount: z.number().int().min(1).max(100000),
  description: z.string().max(200).optional(),
});

const ActionSchema = z.discriminatedUnion("action", [PurchaseSchema, AwardSchema]);

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

  // Get current balance
  const { data: profile } = await supabase
    .from("profiles")
    .select("tethos_coins")
    .eq("id", userId)
    .single();

  if (!profile || profile.tethos_coins < totalCost) {
    return NextResponse.json({ error: "Insufficient coins" }, { status: 409 });
  }

  const newBalance = profile.tethos_coins - totalCost;

  // Atomic-ish: deduct coins, create order, decrement stock, record transaction
  // (Supabase doesn't support multi-table transactions via REST, so we do best-effort ordering)
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ tethos_coins: newBalance })
    .eq("id", userId)
    .gte("tethos_coins", totalCost); // Prevent race condition

  if (updateError) {
    return NextResponse.json({ error: "Failed to deduct coins" }, { status: 500 });
  }

  const { error: orderError } = await supabase
    .from("marketplace_orders")
    .insert({
      user_id: userId,
      item_id: data.item_id,
      quantity: data.quantity,
      total_tc: totalCost,
      status: "pending_pickup",
    });

  if (orderError) {
    // Refund on failure
    await supabase
      .from("profiles")
      .update({ tethos_coins: profile.tethos_coins })
      .eq("id", userId);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  // Decrement stock
  await supabase
    .from("marketplace_items")
    .update({ stock: item.stock - data.quantity })
    .eq("id", data.item_id);

  // Record transaction
  await supabase.from("tc_transactions").insert({
    user_id: userId,
    amount: -totalCost,
    balance_after: newBalance,
    type: "spend_marketplace",
    reference_id: data.item_id,
    description: `Purchased ${data.quantity}x ${item.name}`,
  });

  return NextResponse.json({
    success: true,
    balance: newBalance,
    item_name: item.name,
    total_cost: totalCost,
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

  // Get target's current balance
  const { data: targetProfile } = await supabase
    .from("profiles")
    .select("tethos_coins, display_name")
    .eq("id", data.user_id)
    .single();

  if (!targetProfile) {
    return NextResponse.json({ error: "Target user not found" }, { status: 404 });
  }

  const newBalance = targetProfile.tethos_coins + data.amount;

  await supabase
    .from("profiles")
    .update({ tethos_coins: newBalance })
    .eq("id", data.user_id);

  await supabase.from("tc_transactions").insert({
    user_id: data.user_id,
    amount: data.amount,
    balance_after: newBalance,
    type: "earn_admin",
    description: data.description ?? `Admin award by ${callerId}`,
  });

  return NextResponse.json({
    success: true,
    user: data.user_id,
    awarded: data.amount,
    new_balance: newBalance,
  });
}
