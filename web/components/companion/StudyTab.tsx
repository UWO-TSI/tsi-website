"use client";

/**
 * Companion shell, Study tab: the existing study companion UI plus the
 * small 3D table view (companion.md deliverable 2). One `useStudySession()`
 * instance feeds both. `?demo=` (dev only) reuses the study page's replayed
 * scenarios (lib/study/demo.ts) — the only way to reach a seated, multi-mate
 * table without a live Supabase backend, so evidence/QA can see the 3D view.
 */
import { useEffect, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { StudyCompanionBody } from "@/components/study/StudyCompanion";
import { studyDemo } from "@/lib/study/demo";
import type { StudyTransport } from "@/lib/study/transport";
import { useStudySession } from "@/lib/study/useStudySession";

const CompanionTableScene = dynamic(() => import("./CompanionTableScene"), { ssr: false, loading: () => null });
const noSub = () => () => {};

export default function StudyTab() {
  const search = useSyncExternalStore(noSub, () => window.location.search, () => null);
  const demo = process.env.NODE_ENV !== "production" && search ? new URLSearchParams(search).get("demo") : null;
  if (search === null) return null;
  return demo ? <Demo scenario={demo} /> : <Live />;
}

function Live() {
  const study = useStudySession();
  return <StudyBody study={study} />;
}

function Demo({ scenario }: { scenario: string }) {
  const [transport, setTransport] = useState<StudyTransport | null>(null);
  useEffect(() => {
    void studyDemo(scenario).then(setTransport);
  }, [scenario]);
  return transport ? <DemoLive transport={transport} /> : null;
}

function DemoLive({ transport }: { transport: StudyTransport }) {
  const study = useStudySession({ transport });
  return <StudyBody study={study} />;
}

function StudyBody({ study }: { study: ReturnType<typeof useStudySession> }) {
  return (
    <>
      {study.table ? <CompanionTableScene table={study.table} mates={study.mates} /> : null}
      <StudyCompanionBody study={study} />
    </>
  );
}
