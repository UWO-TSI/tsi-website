import { notFound } from "next/navigation";
import Harness from "./Harness";

// Dev-only screenshot harness for the progression sheets. Not served in production.
export default function ProgressionDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Harness />;
}
