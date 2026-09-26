import { notFound } from "next/navigation";
import OracleHarness from "./OracleHarness";

// Dev-only view of the Oracle/identity data contracts (in-memory; same services as /api/oracle and /api/identity).
export default function OracleDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <OracleHarness />;
}
