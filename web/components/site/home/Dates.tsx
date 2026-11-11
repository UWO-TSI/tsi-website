import RollingRows from "@/components/site/RollingRows";
import { YEAR } from "@/lib/site/config";

export default function Dates() {
  return (
    <RollingRows
      id="dates"
      label="The year"
      title="When to apply, when to show up."
      rows={YEAR.map((d) => ({ when: d.when, title: d.title, detail: d.detail, tag: d.who }))}
    />
  );
}
