"use client";

import { use } from "react";
import ProfileView from "@/components/portal/ProfileView";

export default function MemberProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <ProfileView profileId={id} />;
}
