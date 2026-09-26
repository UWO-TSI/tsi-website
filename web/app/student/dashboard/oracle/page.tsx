"use client";

import OracleReading from "@/components/oracle/OracleReading";

// The Oracle reading (64-item engine, /api/oracle/*). Replaces the legacy
// 12- and 16-question quizzes (retired 2026-09-26; 034 migrates old classes).
// Also the OverlaySheet "oracle" target.
export default function OraclePage() {
  return (
    <div style={{ padding: "72px 16px 32px" }}>
      <OracleReading />
    </div>
  );
}
