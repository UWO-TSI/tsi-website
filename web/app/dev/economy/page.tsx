import { notFound } from "next/navigation";
import EconomyHarness from "./EconomyHarness";

// Dev-only screenshot harness for the economy sheets (in-memory, same service code as /api/economy).
export default function EconomyDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <EconomyHarness />;
}
