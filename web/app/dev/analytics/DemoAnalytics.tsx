"use client";

import { useMemo, useState } from "react";
import GameAnalytics from "@/components/portal/GameAnalytics";
import { buildReport, rangeOf, type Snapshot } from "@/lib/analytics/report";

export default function DemoAnalytics({ snap, now }: { snap: Snapshot; now: string }) {
  const [days, setDays] = useState(30);
  const report = useMemo(() => { const at = new Date(now); return buildReport(snap, { ...rangeOf(days, at), now: at }); }, [snap, now, days]);
  // As the dashboard shell wears it (components/portal/MemberDashboardShell.tsx): the gui scope on the page's ground.
  return <div className="gui min-h-screen pt-11" style={{ background: "var(--color-bg-main)" }}>
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-8"><GameAnalytics report={report} days={days} onDays={setDays} /></div>
  </div>;
}
