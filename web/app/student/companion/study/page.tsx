"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import StudyCompanion from "@/components/study/StudyCompanion";
import { studyDemo } from "@/lib/study/demo";
import type { StudyTransport } from "@/lib/study/transport";
import { useStudySession } from "@/lib/study/useStudySession";

const noSub = () => () => {};

// /student/companion/study: phone study companion (no 3D). `?demo=` works in dev only.
export default function StudyCompanionPage() {
  const search = useSyncExternalStore(noSub, () => window.location.search, () => null);
  const demo = process.env.NODE_ENV !== "production" && search ? new URLSearchParams(search).get("demo") : null;
  if (search === null) return null;
  return demo ? <Demo scenario={demo} /> : <Live />;
}

function Live() {
  const study = useStudySession();
  return <StudyCompanion study={study} />;
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
  return <StudyCompanion study={study} />;
}
