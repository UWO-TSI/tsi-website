import Link from "next/link";
import { EVENT } from "@/lib/genesis/event";
import { passContext } from "@/lib/genesis/server";

export const metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const { href } = await passContext();
  return (
    <>
      <p className="gp-kicker"><Link href={href("/")}>← Your pass</Link></p>
      <h1>Schedule</h1>
      {EVENT.date && <p>{EVENT.date}</p>}
      {EVENT.schedule.length ? (
        <ol className="gp-sched">
          {EVENT.schedule.map((s) => <li key={s.time + s.title}><time>{s.time}</time><div><b>{s.title}</b>{s.detail && <p>{s.detail}</p>}</div></li>)}
        </ol>
      ) : <section className="gp-card"><p>The run of show goes up before GENESIS.</p></section>}
    </>
  );
}
