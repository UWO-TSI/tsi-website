import type { Metadata } from "next";
import GamePortalLogin from "./GamePortalLogin";

export const metadata: Metadata = { title: "Log in" };

// The game portal login. Signed-in visitors never see it: the middleware sends them to /student/go.
export default function StudentPage() {
  return <GamePortalLogin />;
}
