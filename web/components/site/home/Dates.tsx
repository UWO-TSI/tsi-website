import RollingRows from "@/components/site/RollingRows";
import { YEAR } from "@/lib/site/config";

export default function Dates() {
  return (
    <RollingRows
      id="dates"
      title="When to apply, when to show up."
      rows={YEAR}
      tone="dark"
    />
  );
}
