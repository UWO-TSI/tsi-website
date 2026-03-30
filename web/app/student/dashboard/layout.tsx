import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopbar from "@/components/dashboard/DashboardTopbar";
import AnnouncementBanner from "@/components/dashboard/AnnouncementBanner";
import type { Profile, Tier } from "@/lib/supabase/types";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/student/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/student/login");
  }

  if (!profile.onboarding_completed) {
    redirect("/student/onboarding");
  }

  const typedProfile = profile as Profile;

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)]">
      <DashboardSidebar tier={typedProfile.tier as Tier} />

      <div className="ml-56 flex flex-col min-h-screen">
        <AnnouncementBanner userId={user.id} />
        <DashboardTopbar profile={typedProfile} />

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
