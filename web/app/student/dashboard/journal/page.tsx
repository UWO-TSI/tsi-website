"use client";

import { JournalBody } from "@/components/progression/JournalSheet";
import s from "@/components/progression/progression.module.css";

// Journal as a route: deep link + OverlaySheet target ("/student/dashboard/journal").
export default function JournalPage() {
  return (
    <div className={s.page}>
      <div className={s.pageCard}>
        <h1 style={{ margin: "0 0 12px", fontSize: 22 }}>Journal</h1>
        <JournalBody />
      </div>
    </div>
  );
}
