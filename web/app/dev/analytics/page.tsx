import { readFile } from "node:fs/promises";
import DemoAnalytics from "./DemoAnalytics";
import { demoSnapshot } from "@/lib/analytics/demo";
import type { Snapshot } from "@/lib/analytics/report";

// Dev only (the /dev layout 404s it in production): the admin game analytics page on made-up players, or with
// ?source=backfill on a snapshot of the local smoke database's made-up rows (ANALYTICS_SNAPSHOT, a JSON file path;
// specs/evidence/analytics/r1/sql-smoke.sh writes it). Never real players.
export default async function DevAnalyticsPage({ searchParams }: { searchParams: Promise<{ source?: string; now?: string }> }) {
  const { source, now } = await searchParams;
  const at = now ? new Date(now) : new Date();
  const file = source === "backfill" ? process.env.ANALYTICS_SNAPSHOT : undefined;
  const snap: Snapshot = file ? JSON.parse(await readFile(file, "utf8")) : demoSnapshot(at);
  return <DemoAnalytics snap={snap} now={at.toISOString()} />;
}
