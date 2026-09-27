"use client";

/** Companion shell, Study tab: the existing study companion UI plus the small 3D table view (companion.md deliverable 2). One `useStudySession()` instance feeds both. */
import dynamic from "next/dynamic";
import { StudyCompanionBody } from "@/components/study/StudyCompanion";
import { useStudySession } from "@/lib/study/useStudySession";

const CompanionTableScene = dynamic(() => import("./CompanionTableScene"), { ssr: false, loading: () => null });

export default function StudyTab() {
  const study = useStudySession();
  return (
    <>
      {study.table ? <CompanionTableScene table={study.table} mates={study.mates} /> : null}
      <StudyCompanionBody study={study} />
    </>
  );
}
