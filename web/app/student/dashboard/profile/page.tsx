"use client";

import ProfileView from "@/components/portal/ProfileView";

export default function ProfilePage() {
  // TODO: fetch own profile from /api/profile when Backend API is ready
  return <ProfileView isOwnProfile />;
}
