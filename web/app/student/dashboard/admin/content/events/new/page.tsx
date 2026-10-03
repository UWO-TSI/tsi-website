"use client";

import { Lock } from "lucide-react";
import { useUser } from "@/components/portal/UserContext";
import EventEditor from "@/components/portal/EventEditor";
import { Empty, Loading } from "@/components/gui";

const PAGE = "mx-auto w-full max-w-6xl px-5 pt-6 pb-16 sm:px-8";

export default function NewEventPage() {
  const { profile, loading } = useUser();

  if (loading) {
    return (
      <div className={PAGE}>
        <Loading label="Opening the event editor…" />
      </div>
    );
  }

  const tier = profile?.tier ?? 5;
  if (tier > 2) {
    return (
      <div className={`${PAGE} flex min-h-[60vh] items-center justify-center`}>
        <Empty icon={<Lock size={32} />} title="Admins only">
          Event admin is only open to the club’s admins.
        </Empty>
      </div>
    );
  }

  return (
    <div className={PAGE}>
      <EventEditor mode="new" />
    </div>
  );
}
