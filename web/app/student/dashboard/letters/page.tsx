"use client";

import { LettersBody } from "@/components/progression/LettersSheet";
import { Mail } from "lucide-react";
import { Banner } from "@/components/gui";
import s from "@/components/progression/progression.module.css";

// Mailbox as a route: deep link + OverlaySheet target ("/student/dashboard/letters").
export default function LettersPage() {
  return (
    <div className={s.page}>
      <Banner title="Mailbox" icon={<Mail size={26} />} tone="sage">Notes from members and letters from HQ.</Banner>
      <div className={s.pageCard}>
        <LettersBody />
      </div>
    </div>
  );
}
