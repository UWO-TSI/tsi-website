"use client";

/** Companion shell, Club tab: the existing bounty and calendar/events portal pages, reused (not rebuilt) in the phone shell. */
import { useState } from "react";
import BountyPage from "@/app/student/dashboard/bounty/page";
import CalendarPage from "@/app/student/dashboard/calendar/page";
import { Tabs } from "@/components/gui";
import s from "@/components/study/companion.module.css";

type Sub = "bounties" | "calendar";
const SUBS: { key: Sub; label: string }[] = [
  { key: "bounties", label: "Bounties" },
  { key: "calendar", label: "Calendar & events" },
];

export default function ClubTab() {
  const [sub, setSub] = useState<Sub>("bounties");
  return (
    <>
      <Tabs label="Club tools" value={sub} onChange={setSub} className={s.subtabs} tabs={SUBS.map((t) => ({ id: t.key, label: t.label }))} />
      {/* The portal's bounty and calendar pages, reused: inside the shell's .gui scope their tokens are the GUI sheet's,
          whatever the portal theme setting (it used to pin data-theme="light" here). */}
      <div className={s.pageEmbed}>
        {sub === "bounties" ? <BountyPage /> : <CalendarPage />}
      </div>
    </>
  );
}
