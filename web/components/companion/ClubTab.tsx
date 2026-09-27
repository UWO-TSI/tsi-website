"use client";

/** Companion shell, Club tab: the existing bounty and calendar/events portal pages, reused (not rebuilt) in the phone shell. */
import { useState } from "react";
import BountyPage from "@/app/student/dashboard/bounty/page";
import CalendarPage from "@/app/student/dashboard/calendar/page";
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
      <div className={s.subtabs} role="tablist" aria-label="Club tools">
        {SUBS.map((t) => (
          <button key={t.key} role="tab" aria-selected={sub === t.key} className={s.subtab} onClick={() => setSub(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className={s.pageEmbed}>
        {sub === "bounties" ? <BountyPage /> : <CalendarPage />}
      </div>
    </>
  );
}
