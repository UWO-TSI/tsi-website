import { notFound } from "next/navigation";
import CombatHarness from "./CombatHarness";

// Dev-only view of the combat rules and data contracts (in-memory; same services as /api/combat).
export default function CombatDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <CombatHarness />;
}
