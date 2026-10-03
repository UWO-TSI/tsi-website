"use client";

import { JournalBody } from "@/components/progression/JournalSheet";
import { BookOpen } from "lucide-react";
import { Banner } from "@/components/gui";
import s from "@/components/progression/progression.module.css";

// Journal as a route: deep link + OverlaySheet target ("/student/dashboard/journal").
export default function JournalPage() {
  return (
    <div className={s.page}>
      <Banner title="Journal" icon={<BookOpen size={26} />} tone="sage">Quests, club goals and letters.</Banner>
      <div className={s.pageCard}>
        <JournalBody />
      </div>
    </div>
  );
}
