import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Profile } from "@/lib/supabase/types";
import XPWidget from "@/components/dashboard/widgets/XPWidget";
import CoinWidget from "@/components/dashboard/widgets/CoinWidget";
import QuestWidget from "@/components/dashboard/widgets/QuestWidget";
import CalendarWidget from "@/components/dashboard/widgets/CalendarWidget";
import TeamWidget from "@/components/dashboard/widgets/TeamWidget";
import AnnouncementWidget from "@/components/dashboard/widgets/AnnouncementWidget";

export default async function DashboardHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/student/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/student/login");

  const typedProfile = profile as Profile;

  // Fetch dashboard data in parallel
  const [
    { data: quests },
    { data: events },
    { data: team },
    { data: announcements },
  ] = await Promise.all([
    supabase
      .from("quest_progress")
      .select("*, quest:quests(*)")
      .eq("user_id", user.id)
      .eq("status", "accepted")
      .limit(5),
    supabase
      .from("events")
      .select("*")
      .gte("start_time", new Date().toISOString())
      .eq("status", "approved")
      .order("start_time", { ascending: true })
      .limit(5),
    typedProfile.team_id
      ? supabase
          .from("teams")
          .select("*, members:profiles(id, display_name, class, level)")
          .eq("id", typedProfile.team_id)
          .single()
      : Promise.resolve({ data: null }),
    supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(3),
  ]);

  return (
    <div>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
          Welcome back,{" "}
          <span className="text-[var(--color-brand-blue)]">
            {typedProfile.display_name}
          </span>
        </h1>
        <p className="text-sm font-mono text-[var(--color-text-muted)] mt-1">
          {typedProfile.class} · {typedProfile.rank} · Level{" "}
          {typedProfile.level}
        </p>
      </div>

      {/* Widget Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <XPWidget profile={typedProfile} />
        <CoinWidget profile={typedProfile} />
        <QuestWidget quests={quests ?? []} />
        <CalendarWidget events={events ?? []} />
        <TeamWidget team={team} profile={typedProfile} />
        <AnnouncementWidget announcements={announcements ?? []} />
      </div>
    </div>
  );
}
