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
      {/*
        These pages read --color-text-main etc. from tokens.css, which
        default to the DARK palette unless an ancestor sets data-theme
        (ThemeToggle normally does this on <html>, per the user's setting).
        The companion shell is cream/light regardless of that setting, so
        pin the light palette here — otherwise the dashboard's light-on-dark
        text goes near-invisible on this light card.
      */}
      <div className={s.pageEmbed} data-theme="light">
        {sub === "bounties" ? <BountyPage /> : <CalendarPage />}
      </div>
    </>
  );
}
