import { notFound } from "next/navigation";
import SystemsHarness from "./SystemsHarness";

// Dev-only view of the homes + collections APIs over in-memory stores. Not served in production.
export default function SystemsDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <SystemsHarness />;
}
