import Link from "next/link";
import { BOOTHS } from "@/lib/genesis/booths";
import { stampsOf } from "@/lib/genesis/pass";
import { passContext } from "@/lib/genesis/server";

export const dynamic = "force-dynamic";

/** The pass: the guest's card, the five stamps, the rest of GENESIS. Without a pass, how to start one. */
export default async function PassHome({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { db, pass, href } = await passContext();
  const stamps = pass ? await stampsOf(db, pass.id) : [];
  const { welcome } = await searchParams;
  return (
    <>
      {welcome && pass && <div className="gp-banner">Welcome to GENESIS{pass.name ? `, ${pass.name}` : ""}. Tap the sticker at each booth to collect it.</div>}
      <p className="gp-kicker">GENESIS 2027</p>
      {pass ? (
        <section className="gp-card">
          <h1>{pass.name ?? "Your pass"}</h1>
          {!pass.name && <p><Link href={href("/setup")}>Add your name</Link></p>}
          <p><Link href={href("/me")}>{pass.user_id ? "Saved to your account" : "Save your pass to open it on any device"}</Link></p>
          <p>{stamps.length} of {BOOTHS.length} booths collected</p>
          <div className="gp-stamps">
            {BOOTHS.map((b) => (
              <Link key={b.slug} href={href(`/p/${b.slug}`)} className="gp-stamp" data-on={stamps.includes(b.slug) || undefined} aria-label={`${b.nonprofit}${stamps.includes(b.slug) ? ", collected" : ""}`}>
                <i style={{ ["--logo" as string]: `url(${b.logo})` }} />
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="gp-card">
          <h1>Your GENESIS pass</h1>
          <p>Tap the sticker at the front desk to start your pass, then tap each booth&apos;s sticker to collect its project.</p>
          <Link href={href("/start")} className="gp-btn">Start my pass</Link>
          <p style={{ marginTop: 14 }}><Link href={href("/me")}>Saved your pass before? Sign in</Link></p>
        </section>
      )}
      <h2>The projects</h2>
      <ul className="gp-list">
        {BOOTHS.map((b) => <li key={b.slug}><Link href={href(`/p/${b.slug}`)}>{b.nonprofit}<span>{stamps.includes(b.slug) ? "Collected" : "→"}</span></Link></li>)}
      </ul>
      <h2>GENESIS</h2>
      <ul className="gp-list">
        {["Map", "Schedule", "Sponsors"].map((s) => <li key={s}><a aria-disabled>{s}<span>Coming before GENESIS</span></a></li>)}
      </ul>
    </>
  );
}
