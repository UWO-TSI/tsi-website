import Link from "next/link";
import { EVENT } from "@/lib/genesis/event";
import { passContext } from "@/lib/genesis/server";

export const metadata = { title: "Sponsors" };

export default async function SponsorsPage() {
  const { href } = await passContext();
  return (
    <>
      <p className="gp-kicker"><Link href={href("/")}>← Your pass</Link></p>
      <h1>Sponsors</h1>
      <p>GENESIS happens because of them.</p>
      {EVENT.sponsors.length ? (
        <ul className="gp-list">
          {EVENT.sponsors.map((s) => (
            <li key={s.name}>
              {s.site ? <a href={s.site} target="_blank" rel="noopener noreferrer">{s.name}<span>{s.tier ?? "→"}</span></a> : <a aria-disabled>{s.name}<span>{s.tier}</span></a>}
            </li>
          ))}
        </ul>
      ) : <section className="gp-card"><p>This year&apos;s sponsors are announced before GENESIS.</p></section>}
    </>
  );
}
