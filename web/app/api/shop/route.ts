import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/shop — unified product catalog (marketplace_items + avatar_items)
export async function GET(request: NextRequest) {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return NextResponse.json({ products: [] });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category");

  // Fetch marketplace items, avatar items, and the new content-pipeline
  // shop_items table in parallel. shop_items is the future canonical source
  // (migration 014) but the legacy tables stay live until content is migrated.
  const [marketplaceResult, avatarResult, shopItemsResult] = await Promise.all([
    supabase
      .from("marketplace_items")
      .select("id, name, description, image_url, price_tc, stock, category, status")
      .eq("status", "available")
      .order("created_at", { ascending: false }),
    supabase
      .from("avatar_items")
      .select("id, name, type, category, coin_price, sprite_url, rarity, is_available")
      .eq("is_available", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("shop_items")
      .select("id, slug, display_name, category, description, tc_price, sprite_url, rarity, stock, active, released_at")
      .eq("active", true)
      .order("released_at", { ascending: false }),
  ]);

  // Normalize marketplace items to Product shape
  const marketplaceProducts = (marketplaceResult.data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    price_tc: item.price_tc,
    image_url: item.image_url,
    category: item.category, // merch, theme, accessory, special
    stock: item.stock,
    source: "marketplace" as const,
  }));

  // Normalize avatar items to Product shape
  const avatarProducts = (avatarResult.data ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    description: `${item.rarity} ${item.type} item`,
    price_tc: item.coin_price,
    image_url: item.sprite_url,
    category: item.type, // hair, face, outfit, accessory, effect, emote
    stock: null, // unlimited
    source: "avatar" as const,
  }));

  // Normalize shop_items (content_pipeline migration 014) to Product shape.
  // Map content-pipeline categories onto the existing UI category vocabulary
  // so the existing /shop filter chips still work without a UI rewrite.
  const SHOP_ITEM_CATEGORY_MAP: Record<string, string> = {
    "avatar-outfit": "apparel",
    "avatar-effect": "digital",
    "merch": "merch",
    "profile-customization": "accessories",
  };
  type ShopItemRow = {
    id: string;
    slug: string;
    display_name: string;
    category: string;
    description: string | null;
    tc_price: number;
    sprite_url: string | null;
    rarity: string | null;
    stock: number | null;
  };
  const shopItemProducts = ((shopItemsResult.data ?? []) as ShopItemRow[]).map((item) => ({
    id: item.id,
    name: item.display_name,
    description: item.description ?? undefined,
    price_tc: item.tc_price,
    image_url: item.sprite_url ?? undefined,
    category: SHOP_ITEM_CATEGORY_MAP[item.category] ?? item.category,
    stock: item.stock,
    source: "shop_items" as const,
  }));

  let products = [...shopItemProducts, ...marketplaceProducts, ...avatarProducts];

  if (category) {
    products = products.filter((p) => p.category === category);
  }

  return NextResponse.json({ products });
}
