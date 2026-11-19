"use client";

import { useEffect, useState } from "react";
import { ErrorNote, Loading } from "@/components/gui";
import { AdminGate } from "@/components/portal/ProgressionAdminShared";
import GameAnalytics from "@/components/portal/GameAnalytics";
import type { Report } from "@/lib/analytics/report";

const PAGE = "mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-8";

// The game's player analytics (specs/analytics.md): T1/T2 only, here and in the route it reads.
export default function AdminGamePage() {
  return <AdminGate><Players /></AdminGate>;
}

function Players() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<Report | null>(null);
  const [failed, setFailed] = useState(false);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let live = true;
    fetch(`/api/admin/game-analytics?days=${days}`)
      .then((r) => r.json())
      .then((j) => { if (live) { setFailed(!j?.ok); if (j?.ok) setReport(j.report); } })
      .catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [days, tries]);

  return <div className={PAGE}>
    {failed ? <ErrorNote onRetry={() => setTries((n) => n + 1)}>The numbers didn’t load.</ErrorNote>
      : report ? <GameAnalytics report={report} days={days} onDays={setDays} />
      : <Loading label="Adding up the island…" />}
  </div>;
}
