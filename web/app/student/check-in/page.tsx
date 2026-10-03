import type { Metadata } from "next";
import CheckIn from "./CheckIn";

export const metadata: Metadata = { title: "Check in" };

// Where an event's door QR lands (lib/portal/checkIn.ts): /student/check-in?event=<id>&code=<code>.
export default async function CheckInPage({ searchParams }: { searchParams: Promise<{ event?: string | string[]; code?: string | string[] }> }) {
  const { event, code } = await searchParams;
  return <CheckIn event={typeof event === "string" ? event : null} code={typeof code === "string" ? code : null} />;
}
