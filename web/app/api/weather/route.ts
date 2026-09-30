import { NextResponse } from "next/server";
import { weatherReport } from "@/lib/server/weather";

/**
 * GET /api/weather — hourly island weather for London, Ontario.
 * Also returns daily sunrise/sunset for the lighting phases.
 * Cached for 30 minutes on the server (lib/server/weather.ts) and at the CDN;
 * any failure returns the seeded fallback with 200.
 */
export async function GET() {
  return NextResponse.json(await weatherReport(), { headers: { "Cache-Control": "public, s-maxage=1800, stale-while-revalidate=3600" } });
}
