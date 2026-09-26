import { NextResponse } from "next/server";
import { speciesInCategory } from "@/lib/collections/logic";
import { CATEGORIES, ROSTER, type Category } from "@/lib/collections/roster";

const FALLBACK: Partial<Record<Category, string>> = {
  fish: "/assets/acnh/icons/fish.png",
  sea: "/assets/acnh/icons/fish.png",
  bug: "/assets/acnh/icons/insect.png",
  nature: "/assets/acnh/icons/petal.png",
  fruit: "/assets/acnh/icons/apple.png",
};

// GET /api/collections/silhouette/:category/:slot: the icon behind an opaque
// URL so undiscovered journal slots never reveal a species key or name. The
// client renders it as a silhouette (CSS brightness(0)).
export async function GET(request: Request, { params }: { params: Promise<{ category: string; slot: string }> }) {
  const { category, slot } = await params;
  if (!(CATEGORIES as string[]).includes(category) || !/^\d{1,3}$/.test(slot)) return NextResponse.json({ ok: false }, { status: 404 });
  const sp = speciesInCategory(ROSTER, category as Category)[Number(slot) - 1];
  const path = sp?.icon ?? FALLBACK[category as Category];
  if (!sp || !path) return NextResponse.json({ ok: false }, { status: 404 });
  const res = await fetch(new URL(path, request.url));
  if (!res.ok) return NextResponse.json({ ok: false }, { status: 404 });
  return new NextResponse(res.body, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" } });
}
