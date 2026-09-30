"use client";

import StudyCompanion from "@/components/study/StudyCompanion";
import { WithStudySession } from "@/components/companion/StudyTab";

// /student/companion/study: phone study companion (no 3D). `?demo=` works in dev only.
export default function StudyCompanionPage() {
  return <WithStudySession>{(study) => <StudyCompanion study={study} />}</WithStudySession>;
}
