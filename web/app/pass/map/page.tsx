import Link from "next/link";
import { EVENT } from "@/lib/genesis/event";
import { passContext } from "@/lib/genesis/server";

export const metadata = { title: "Map" };

/** The venue map: the five booths, the photobooth and the front desk. */
export default async function MapPage() {
  const { href } = await passContext();
  const m = EVENT.map;
  return (
    <>
      <p className="gp-kicker"><Link href={href("/")}>← Your pass</Link></p>
      <h1>Map</h1>
      {EVENT.venue && <p>{EVENT.venue.name}, {EVENT.venue.address}</p>}
      {m ? (
        <div className="gp-map">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.image} alt={`Floor map of ${EVENT.venue?.name ?? "the venue"}`} />
          {m.spots.map((s) => {
            const style = { left: `${s.x}%`, top: `${s.y}%` };
            return s.href
              ? <Link key={s.label} href={href(s.href)} className="gp-spot" style={style}>{s.label}</Link>
              : <span key={s.label} className="gp-spot" style={style}>{s.label}</span>;
          })}
        </div>
      ) : <section className="gp-card"><p>The floor map goes up before GENESIS.</p></section>}
    </>
  );
}
