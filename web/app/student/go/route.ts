import { NextResponse } from "next/server";
import { APPLICANT_PORTAL } from "@/lib/recruitment-access";

export function GET(request: Request) {
  const url = new URL(APPLICANT_PORTAL, request.url);
  return NextResponse.redirect(url, { headers: { "Cache-Control": "no-store" } });
}
