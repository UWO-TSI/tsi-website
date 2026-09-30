import { notFound } from "next/navigation";

// Dev-only index of the harnesses and the in-world demo flags (in-memory services, no sign-in).
const LINKS: [string, string][] = [
  ["/lab/island", "Member island (?time=, ?weather=, ?season=, ?home=1, ?ruins=1, ...)"],
  ["/lab/island?collections=demo&progression=demo&oracle=demo", "Island with demo journal, museum, monument and temple"],
  ["/student/dashboard/oracle?oracle=demo&family=INTJ&name=Maya", "Oracle reading, finished as INTJ"],
  ["/dev/progression?demo=1&sheet=contribute", "Progression sheets: journal, goals, letters, contribute, notice"],
  ["/dev/economy?view=shop&tab=specials", "Economy sheets: shop, sell, inventory, wallet, merch admin"],
  ["/dev/playground", "UI component playground"],
  ["/student/apply/portal?preview=1", "Applicant island"],
];

export default function DevIndex() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main style={{ padding: 32, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>Dev harnesses</h1>
      <ul style={{ display: "grid", gap: 8 }}>
        {LINKS.map(([href, label]) => <li key={href}><a href={href} style={{ textDecoration: "underline" }}>{href}</a> · {label}</li>)}
      </ul>
    </main>
  );
}
