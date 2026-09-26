"use client";

import { LettersBody } from "@/components/progression/LettersSheet";
import s from "@/components/progression/progression.module.css";

// Mailbox as a route: deep link + OverlaySheet target ("/student/dashboard/letters").
export default function LettersPage() {
  return (
    <div className={s.page}>
      <div className={s.pageCard}>
        <h1 style={{ margin: "0 0 12px", fontSize: 22 }}>Mailbox</h1>
        <LettersBody />
      </div>
    </div>
  );
}
