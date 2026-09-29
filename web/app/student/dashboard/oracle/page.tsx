"use client";

import OracleSheetEmbed from "@/components/game/oracle/OracleSheetEmbed";

// The Oracle reading (64-item engine, /api/oracle/*): the same sheet as the
// island temple and the OverlaySheet "oracle" target.
export default function OraclePage() {
  return (
    <div style={{ padding: "72px 16px 32px" }}>
      <OracleSheetEmbed />
    </div>
  );
}
