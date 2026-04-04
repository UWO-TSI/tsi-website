import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

// GET /api/inventory — list user's owned items (with equipped state) + full item catalog
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const equipped = searchParams.get("equipped");

  // Get user's inventory with item details
  let query = supabase
    .from("player_inventory")
    .select("id, item_id, equipped, acquired_at, avatar_items(id, name, type, category, coin_price, sprite_url, rarity)")
    .eq("user_id", user.id);

  if (equipped === "true") {
    query = query.eq("equipped", true);
  } else if (equipped === "false") {
    query = query.eq("equipped", false);
  }

  const { data: inventory, error } = await query.order("acquired_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter by item type if specified (post-query since it's on the joined table)
  let items = inventory ?? [];
  if (type) {
    items = items.filter((i) => {
      const item = i.avatar_items as unknown as Record<string, unknown> | null;
      return item && item.type === type;
    });
  }

  return NextResponse.json({ inventory: items });
}

// POST /api/inventory — equip or unequip an item
const EquipSchema = z.object({
  action: z.enum(["equip", "unequip"]),
  item_id: z.string().uuid(),
});

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

  const parsed = EquipSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { action, item_id } = parsed.data;

  // Verify user owns this item
  const { data: inventoryItem } = await supabase
    .from("player_inventory")
    .select("id, equipped, avatar_items(id, type, name)")
    .eq("user_id", user.id)
    .eq("item_id", item_id)
    .single();

  if (!inventoryItem) {
    return NextResponse.json(
      { error: "Item not in your inventory" },
      { status: 404 }
    );
  }

  if (action === "equip") {
    if (inventoryItem.equipped) {
      return NextResponse.json(
        { error: "Item already equipped" },
        { status: 409 }
      );
    }

    const itemDetails = inventoryItem.avatar_items as unknown as Record<string, unknown> | null;
    const itemType = itemDetails?.type as string | undefined;

    // Unequip any currently equipped item of the same type (only one per slot)
    if (itemType) {
      // Get all equipped items of this type
      const { data: equippedOfType } = await supabase
        .from("player_inventory")
        .select("id, avatar_items(type)")
        .eq("user_id", user.id)
        .eq("equipped", true);

      const toUnequip = (equippedOfType ?? []).filter(
        (i) => (i.avatar_items as unknown as Record<string, unknown> | null)?.type === itemType
      );

      for (const item of toUnequip) {
        await supabase
          .from("player_inventory")
          .update({ equipped: false })
          .eq("id", item.id);
      }
    }

    // Equip the requested item
    const { error } = await supabase
      .from("player_inventory")
      .update({ equipped: true })
      .eq("id", inventoryItem.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action: "equipped",
      item_id,
      item_name: (inventoryItem.avatar_items as unknown as Record<string, unknown> | null)?.name ?? null,
    });
  }

  // Unequip
  if (!inventoryItem.equipped) {
    return NextResponse.json(
      { error: "Item not equipped" },
      { status: 409 }
    );
  }

  const { error } = await supabase
    .from("player_inventory")
    .update({ equipped: false })
    .eq("id", inventoryItem.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    action: "unequipped",
    item_id,
    item_name: (inventoryItem.avatar_items as unknown as Record<string, unknown> | null)?.name ?? null,
  });
}
