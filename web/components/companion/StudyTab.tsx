"use client";

/**
 * Companion shell, Study tab: the existing study companion UI plus the
 * small 3D table view (companion.md deliverable 2). One `useStudySession()`
 * instance feeds both. `?demo=` (dev only) reuses the study page's replayed
 * scenarios (lib/study/demo.ts) — the only way to reach a seated, multi-mate
 * table without a live Supabase backend, so evidence/QA can see the 3D view.
 */
import { useEffect, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import { StudyCompanionBody } from "@/components/study/StudyCompanion";
import { studyDemo } from "@/lib/study/demo";
import type { StudyTransport } from "@/lib/study/transport";
import { useStudySession, type StudyHook } from "@/lib/study/useStudySession";
import { useSearch } from "@/lib/game/useMediaQuery";

const CompanionTableScene = dynamic(() => import("./CompanionTableScene"), { ssr: false, loading: () => null });

export default function StudyTab() {
  return <WithStudySession>{(study) => <StudyBody study={study} />}</WithStudySession>;
}

/** The member's study session, or with `?demo=` (dev only) a replayed scenario (lib/study/demo.ts), handed to `children`. */
export function WithStudySession({ children }: { children: (study: StudyHook) => ReactNode }) {
  const search = useSearch();
  const demo = process.env.NODE_ENV !== "production" && search ? new URLSearchParams(search).get("demo") : null;
  if (search === null) return null;
  return demo ? <Demo scenario={demo}>{children}</Demo> : <Live>{children}</Live>;
}

function Live({ children }: { children: (study: StudyHook) => ReactNode }) {
  return children(useStudySession());
}

function Demo({ scenario, children }: { scenario: string; children: (study: StudyHook) => ReactNode }) {
  const [transport, setTransport] = useState<StudyTransport | null>(null);
  useEffect(() => {
    void studyDemo(scenario).then(setTransport);
  }, [scenario]);
  return transport ? <DemoLive transport={transport}>{children}</DemoLive> : null;
}

function DemoLive({ transport, children }: { transport: StudyTransport; children: (study: StudyHook) => ReactNode }) {
  return children(useStudySession({ transport }));
}

function StudyBody({ study }: { study: StudyHook }) {
  return (
    <>
      {study.table ? <CompanionTableScene table={study.table} mates={study.mates} /> : null}
      <StudyCompanionBody study={study} />
    </>
  );
}
