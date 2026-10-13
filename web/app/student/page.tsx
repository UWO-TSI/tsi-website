import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { islandPhase, parseTimeOverride } from "@/lib/game/islandTime";
import { siteHomeFor } from "@/lib/hosts";
import { memberWorldIsAvailable, sameOriginPath } from "@/lib/recruitment-access";
import { createClient } from "@/lib/supabase/server";
import TitleScreen, { type TitleView } from "./TitleScreen";

export const metadata: Metadata = { title: "Tethos Student Portal", description: "Sign in to Tethos Island, the Tech for Social Impact student portal." };

const PHASE_WORD = { dawn: "dawn", day: "afternoon", evening: "evening", night: "night" } as const;

// The portal's title screen (play.tethos.ca/). A safe `?next=` rides through /student/go after sign-in;
// a member who is already signed in and has somewhere to go skips straight there.
export default async function StudentPortal({ searchParams }: { searchParams: Promise<{ next?: string | string[]; view?: string | string[]; time?: string | string[] }> }) {
  const { next, view, time } = await searchParams;
  const back = sameOriginPath(typeof next === "string" ? next : null);
  const landing = back ? `/student/go?next=${encodeURIComponent(back)}` : "/student/go";
  const user = await createClient().then(s => s.auth.getUser()).then(r => r.data.user, () => null);
  if (user && back) redirect(landing);
  const meta = user?.user_metadata ?? {};
  const name = user ? String(meta.display_name || meta.full_name || meta.name || user.email || "you") : null;
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("en-CA", { weekday: "long", timeZone: "America/Toronto" }).format(now);
  const initialView: TitleView = !user && (view === "signin" || view === "signup") ? view : "menu";
  return (
    <TitleScreen
      landing={landing}
      account={name ? { name } : null}
      open={memberWorldIsAvailable()}
      initialView={initialView}
      when={`${weekday} ${PHASE_WORD[parseTimeOverride(typeof time === "string" ? time : null) ?? islandPhase(now)]} · London, ON`}
      siteHome={siteHomeFor((await headers()).get("host"))}
    />
  );
}
