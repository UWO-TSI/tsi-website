import { NextResponse } from "next/server";

// GET /api/shop — stub returning empty product list until shop is wired to Supabase
export async function GET() {
  return NextResponse.json({ products: [] });
}
