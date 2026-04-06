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

  // Fetch both marketplace items and avatar items in parallel
  const [marketplaceResult, avatarResult] = await Promise.all([
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

  let products = [...marketplaceProducts, ...avatarProducts];

  if (category) {
    products = products.filter((p) => p.category === category);
  }

  return NextResponse.json({ products });
}
