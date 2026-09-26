import { Suspense } from "react";
import RecruitmentEntry from "@/components/recruit/RecruitmentEntry";

export default function RecruitmentPage() {
  return <Suspense fallback={<main className="min-h-screen p-12" aria-busy="true">Loading applications…</main>}><RecruitmentEntry /></Suspense>;
}
