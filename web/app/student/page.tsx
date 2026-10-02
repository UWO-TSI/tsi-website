import type { Metadata } from "next";
import { sameOriginPath } from "@/lib/recruitment-access";
import GamePortalLogin from "./GamePortalLogin";

export const metadata: Metadata = { title: "Log in" };

// The game portal login. Signed-in visitors never see it: the middleware sends them to
// /student/go (keeping `?next=`). A safe `?next=` rides through /student/go after sign-in.
export default async function StudentPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const back = sameOriginPath(typeof next === "string" ? next : null);
  return <GamePortalLogin landing={back ? `/student/go?next=${encodeURIComponent(back)}` : "/student/go"} />;
}
