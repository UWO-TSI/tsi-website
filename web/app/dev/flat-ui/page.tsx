import { notFound } from "next/navigation";
import Harness from "./Harness";

// Dev-only screenshot harness for the flat UI rollout (specs/polish/flat-ui.md): each in-game menu on its own, over the
// in-memory services, shot before and after (specs/evidence/flat-ui).
export default function FlatUiDevPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Harness />;
}
